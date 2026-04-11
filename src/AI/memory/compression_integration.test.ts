/**
 * 七层上下文压缩系统 - 集成测试
 * 
 * 测试完整的压缩流程和各层之间的协作
 */

import { describe, it, expect, jest } from '@jest/globals';
import { BaseMessage, HumanMessage, AIMessage, ToolResultMessage } from '../agents/base_agent';
import { TokenUtils } from './token_utils';
import { pruneContext, DEFAULT_PRUNING_SETTINGS } from './context_pruning';
import { truncateAggregateToolResults } from './tool_result_truncation';
import { decideCompactionRoute, CompactionRoute } from './preemptive_compaction';
import { activeCompact } from './active_compaction';
import { auditSummaryQuality } from './summary_audit';

// ==================== 辅助函数 ====================

function createMockLLM(responses?: string[]): any {
  let callCount = 0;
  
  return {
    invoke: jest.fn(async () => {
      const response = responses && responses[callCount] 
        ? responses[callCount]
        : '这是一个对话摘要，包含了关键信息和决策。';
      
      callCount++;
      return { content: response };
    })
  };
}

function createMixedConversation(): BaseMessage[] {
  const messages: BaseMessage[] = [];
  
  // 添加一些普通对话
  for (let i = 0; i < 10; i++) {
    messages.push(new HumanMessage(`用户消息 ${i + 1}`));
    messages.push(new AIMessage(`AI回复 ${i + 1}`));
  }
  
  // 添加工具调用
  for (let i = 0; i < 5; i++) {
    messages.push(new HumanMessage(`执行任务 ${i + 1}`));
    messages.push(new AIMessage('执行中', { 
      tool_calls: [{ id: `call_${i}`, name: 'task' }] 
    }));
    messages.push(new ToolResultMessage(
      'R'.repeat(3000), // 每条 3000 字符
      { tool_call_id: `call_${i}` }
    ));
  }
  
  // 添加最近的对话
  messages.push(new HumanMessage('最近的问题'));
  messages.push(new AIMessage('最近的回答'));
  
  return messages;
}

// ==================== 完整流程测试 ====================

describe('完整压缩流程集成测试', () => {
  it('应能成功执行完整的压缩流程', async () => {
    const messages = createMixedConversation();
    
    console.log(`\n===== 开始完整压缩流程测试 =====`);
    console.log(`初始消息数: ${messages.length}`);
    console.log(`初始 token 数: ${TokenUtils.calculateMessagesTokenCount(messages)}`);
    
    // Step 1: Layer 2 - 上下文裁剪
    console.log('\n[Step 1] Layer 2: 上下文裁剪');
    const pruned = pruneContext(messages, DEFAULT_PRUNING_SETTINGS, 8000);
    console.log(`裁剪后消息数: ${pruned.length}`);
    
    // Step 2: Layer 3 - 工具结果截断
    console.log('\n[Step 2] Layer 3: 工具结果截断');
    const truncated = truncateAggregateToolResults(pruned, 8000);
    const hasTruncated = truncated.some(msg => 
      msg.type === 'tool_result' && msg.content.includes('[Truncated:')
    );
    console.log(`是否有截断: ${hasTruncated}`);
    
    // Step 3: Layer 4 - 预防性决策
    console.log('\n[Step 3] Layer 4: 预防性决策');
    const route = decideCompactionRoute(
      truncated,
      '系统提示词',
      '用户输入',
      8000
    );
    console.log(`决策路由: ${route.route}`);
    console.log(`是否需要压缩: ${route.shouldCompact}`);
    console.log(`预估 token: ${route.estimatedTokens}`);
    
    // Step 4: Layer 5 - 主动压缩（如果需要）
    if (route.shouldCompact || truncated.length > 20) {
      console.log('\n[Step 4] Layer 5: 主动压缩');
      const mockLLM = createMockLLM(['压缩摘要']);
      const result = await activeCompact(truncated, 8000, mockLLM);
      
      console.log(`压缩前 token: ${result.tokensBefore}`);
      console.log(`压缩后 token: ${result.tokensAfter}`);
      console.log(`压缩率: ${Math.round((1 - result.tokensAfter / result.tokensBefore) * 100)}%`);
      console.log(`最终消息数: ${result.keptMessages.length}`);
      
      // 验证压缩效果
      expect(result.tokensAfter).toBeLessThan(result.tokensBefore);
      expect(result.keptMessages.length).toBeLessThan(truncated.length);
      
      // Step 5: Layer 6 - 质量审计
      if (result.summary) {
        console.log('\n[Step 5] Layer 6: 质量审计');
        const audit = auditSummaryQuality(result.summary, truncated);
        console.log(`审计通过: ${audit.passed}`);
        console.log(`问题列表: ${audit.issues.join(', ') || '无'}`);
        
        expect(audit).toBeDefined();
      }
    }
    
    console.log('\n===== 完整压缩流程测试完成 =====\n');
  });

  it('各层应协同工作，不产生冲突', async () => {
    const messages = createMixedConversation();
    
    // 依次应用各层
    let current = messages;
    
    // Layer 2
    current = pruneContext(current, DEFAULT_PRUNING_SETTINGS, 8000);
    
    // Layer 3
    current = truncateAggregateToolResults(current, 8000);
    
    // Layer 4
    const route = decideCompactionRoute(current, '', '', 8000);
    
    // Layer 5（如果需要）
    if (route.shouldCompact || current.length > 25) {
      const mockLLM = createMockLLM(['摘要']);
      const result = await activeCompact(current, 8000, mockLLM);
      current = result.keptMessages;
    }
    
    // 验证最终结果的有效性
    expect(current.length).toBeGreaterThan(0);
    
    // 检查消息类型有效性
    current.forEach(msg => {
      expect(['human', 'ai', 'tool_result']).toContain(msg.type);
    });
    
    // 检查 tool_use/tool_result 配对
    const toolCallIds = new Set<string>();
    current.forEach(msg => {
      if (msg.type === 'ai' && msg.metadata?.tool_calls) {
        msg.metadata.tool_calls.forEach((call: any) => {
          toolCallIds.add(call.id);
        });
      }
    });
    
    const orphanedToolResults = current.filter(msg => {
      if (msg.type === 'tool_result') {
        const callId = msg.metadata?.tool_call_id;
        return callId && !toolCallIds.has(callId);
      }
      return false;
    });
    
    // 不应有孤立的 tool_result
    expect(orphanedToolResults.length).toBe(0);
  });

  it('应在不同负载下正常工作', async () => {
    const testCases = [
      { count: 10, desc: '小负载' },
      { count: 30, desc: '中等负载' },
      { count: 60, desc: '大负载' }
    ];
    
    for (const testCase of testCases) {
      console.log(`\n测试 ${testCase.desc}: ${testCase.count} 条消息`);
      
      const messages: BaseMessage[] = [];
      for (let i = 0; i < testCase.count; i++) {
        messages.push(new HumanMessage(`消息 ${i + 1}`));
        messages.push(new AIMessage(`回复 ${i + 1}`));
      }
      
      // 应用压缩
      let current = messages;
      
      if (current.length > 20) {
        current = pruneContext(current, DEFAULT_PRUNING_SETTINGS, 8000);
        current = truncateAggregateToolResults(current, 8000);
        
        const route = decideCompactionRoute(current, '', '', 8000);
        if (route.shouldCompact || current.length > 25) {
          const mockLLM = createMockLLM([`摘要 ${testCase.count}`]);
          const result = await activeCompact(current, 8000, mockLLM);
          current = result.keptMessages;
        }
      }
      
      expect(current.length).toBeGreaterThan(0);
      console.log(`  处理后: ${current.length} 条消息`);
    }
  });
});

// ==================== 性能测试 ====================

describe('性能测试', () => {
  it('轻量层应在毫秒级完成', () => {
    const messages = createMixedConversation();
    
    // Layer 2: 上下文裁剪
    const start1 = Date.now();
    pruneContext(messages, DEFAULT_PRUNING_SETTINGS, 8000);
    const duration1 = Date.now() - start1;
    
    expect(duration1).toBeLessThan(100); // 100ms 内
    
    // Layer 3: 工具结果截断
    const start2 = Date.now();
    truncateAggregateToolResults(messages, 8000);
    const duration2 = Date.now() - start2;
    
    expect(duration2).toBeLessThan(100); // 100ms 内
    
    // Layer 4: 预防性决策
    const start3 = Date.now();
    decideCompactionRoute(messages, '', '', 8000);
    const duration3 = Date.now() - start3;
    
    expect(duration3).toBeLessThan(50); // 50ms 内
    
    console.log(`Layer 2: ${duration1}ms, Layer 3: ${duration2}ms, Layer 4: ${duration3}ms`);
  });

  it('主动压缩应在秒级完成（含 Mock LLM）', async () => {
    const messages = createMixedConversation();
    const mockLLM = createMockLLM(['摘要']);
    
    const start = Date.now();
    await activeCompact(messages, 8000, mockLLM);
    const duration = Date.now() - start;
    
    // Mock LLM 应该很快
    expect(duration).toBeLessThan(500); // 500ms 内
    
    console.log(`Layer 5 (Mock): ${duration}ms`);
  });
});

// ==================== 容错测试 ====================

describe('容错测试', () => {
  it('某一层失败不应影响其他层', async () => {
    const messages = createMixedConversation();
    
    // Layer 2 和 3 应该正常工作
    let current = pruneContext(messages, DEFAULT_PRUNING_SETTINGS, 8000);
    current = truncateAggregateToolResults(current, 8000);
    
    expect(current.length).toBeGreaterThan(0);
    
    // 即使 Layer 5 失败，也不应崩溃
    try {
      const failingLLM = {
        invoke: jest.fn(async () => {
          throw new Error('LLM 失败');
        })
      };
      
      const result = await activeCompact(current, 8000, failingLLM as any);
      
      // 应有降级处理
      expect(result).toBeDefined();
      expect(result.keptMessages).toBeDefined();
    } catch (error) {
      // 即使抛出错误，也不应影响之前的层
      expect(current.length).toBeGreaterThan(0);
    }
  });

  it('异常输入应被优雅处理', async () => {
    // 空数组
    expect(() => pruneContext([], DEFAULT_PRUNING_SETTINGS, 8000)).not.toThrow();
    expect(() => truncateAggregateToolResults([], 8000)).not.toThrow();
    expect(() => decideCompactionRoute([], '', '', 8000)).not.toThrow();
    
    // 单条消息
    const singleMsg = [new HumanMessage('唯一消息')];
    expect(() => pruneContext(singleMsg, DEFAULT_PRUNING_SETTINGS, 8000)).not.toThrow();
    
    // 超大消息
    const hugeMsg = [new HumanMessage('A'.repeat(100000))];
    expect(() => TokenUtils.calculateMessagesTokenCount(hugeMsg)).not.toThrow();
  });
});

// ==================== 数据一致性测试 ====================

describe('数据一致性测试', () => {
  it('压缩后应保持消息顺序', async () => {
    const messages = createMixedConversation();
    const mockLLM = createMockLLM(['摘要']);
    
    const result = await activeCompact(messages, 8000, mockLLM);
    
    // 摘要应该在最前面
    expect(result.keptMessages[0].content).toContain('[Conversation Summary]');
    
    // 保留的消息应保持相对顺序
    const keptNonSummary = result.keptMessages.slice(1);
    const originalRecent = messages.slice(-keptNonSummary.length);
    
    // 检查最后几条消息是否匹配
    for (let i = 0; i < Math.min(3, keptNonSummary.length); i++) {
      const keptIdx = keptNonSummary.length - 1 - i;
      const origIdx = originalRecent.length - 1 - i;
      
      if (keptNonSummary[keptIdx] && originalRecent[origIdx]) {
        expect(keptNonSummary[keptIdx].type).toBe(originalRecent[origIdx].type);
      }
    }
  });

  it('压缩后 token 数应减少', async () => {
    const messages = createMixedConversation();
    const mockLLM = createMockLLM(['摘要']);
    
    const beforeTokens = TokenUtils.calculateMessagesTokenCount(messages);
    const result = await activeCompact(messages, 8000, mockLLM);
    
    expect(result.tokensBefore).toBe(beforeTokens);
    expect(result.tokensAfter).toBeLessThan(beforeTokens);
  });

  it('多次压缩应保持稳定', async () => {
    let messages = createMixedConversation();
    const mockLLM = createMockLLM(['摘要']);
    
    // 第一次压缩
    const result1 = await activeCompact(messages, 8000, mockLLM);
    messages = result1.keptMessages;
    
    // 第二次压缩
    const result2 = await activeCompact(messages, 8000, mockLLM);
    
    // 两次压缩后仍应有有效结果
    expect(result2.keptMessages.length).toBeGreaterThan(0);
    expect(result2.tokensAfter).toBeGreaterThan(0);
  });
});

// ==================== 配置参数测试 ====================

describe('配置参数测试', () => {
  it('不同的上下文窗口应产生不同的压缩策略', async () => {
    const messages = createMixedConversation();
    const mockLLM = createMockLLM(['摘要']);
    
    // 小窗口
    const result1 = await activeCompact(messages, 4000, mockLLM);
    
    // 大窗口
    const result2 = await activeCompact(messages, 16000, mockLLM);
    
    // 小窗口应该压缩更多
    expect(result1.tokensAfter).toBeLessThanOrEqual(result2.tokensAfter);
  });

  it('安全系数应防止溢出', () => {
    const messages = createMixedConversation();
    
    const route = decideCompactionRoute(messages, '', '', 8000);
    
    // 估算的 token 数应包含安全系数
    const manualEstimate = TokenUtils.calculateMessagesTokenCount(messages) * 1.2;
    
    // 允许小误差
    expect(route.estimatedTokens).toBeCloseTo(manualEstimate, -1);
  });
});
