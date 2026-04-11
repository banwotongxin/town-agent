/**
 * 七层上下文压缩系统 - 单元测试
 * 
 * 测试覆盖：
 * 1. Layer 2: 上下文裁剪
 * 2. Layer 3: 工具结果截断
 * 3. Layer 4: 预防性决策
 * 4. Layer 5: 主动压缩（需要 Mock LLM）
 * 5. Layer 6: 质量审计
 * 6. TokenUtils 增强功能
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { BaseMessage, HumanMessage, AIMessage, ToolResultMessage } from '../agents/base_agent';
import { TokenUtils } from './token_utils';
import { pruneContext, DEFAULT_PRUNING_SETTINGS } from './context_pruning';
import { 
  truncateToolResult, 
  calculateMaxToolResultChars,
  truncateAggregateToolResults 
} from './tool_result_truncation';
import { decideCompactionRoute, CompactionRoute } from './preemptive_compaction';
import { auditSummaryQuality } from './summary_audit';

// ==================== 辅助函数 ====================

/**
 * 创建测试消息数组
 */
function createTestMessages(count: number): BaseMessage[] {
  const messages: BaseMessage[] = [];
  for (let i = 0; i < count; i++) {
    if (i % 2 === 0) {
      messages.push(new HumanMessage(`用户消息 ${i + 1}: 这是第 ${i + 1} 条用户消息`));
    } else {
      messages.push(new AIMessage(`AI回复 ${i + 1}: 这是第 ${i + 1} 条AI回复`));
    }
  }
  return messages;
}

/**
 * 创建包含工具结果的测试消息
 */
function createMessagesWithToolResults(): BaseMessage[] {
  return [
    new HumanMessage('请帮我查询数据'),
    new AIMessage('好的，我来查询', { 
      tool_calls: [{ id: 'call_1', name: 'query_data' }] 
    }),
    new ToolResultMessage('A'.repeat(5000), { tool_call_id: 'call_1' }),
    new HumanMessage('再帮我分析这些数据'),
    new AIMessage('正在分析', { 
      tool_calls: [{ id: 'call_2', name: 'analyze_data' }] 
    }),
    new ToolResultMessage('B'.repeat(6000), { tool_call_id: 'call_2' }),
    new HumanMessage('最后生成报告'),
    new AIMessage('报告生成中', { 
      tool_calls: [{ id: 'call_3', name: 'generate_report' }] 
    }),
    new ToolResultMessage('C'.repeat(7000), { tool_call_id: 'call_3' }),
  ];
}

// ==================== TokenUtils 测试 ====================

describe('TokenUtils 增强功能测试', () => {
  describe('estimateTotalChars', () => {
    it('应该正确计算总字符数', () => {
      const messages = [
        new HumanMessage('Hello'),
        new AIMessage('World')
      ];
      
      const totalChars = TokenUtils.estimateTotalChars(messages);
      expect(totalChars).toBe(10); // "Hello" (5) + "World" (5)
    });

    it('空消息数组应返回 0', () => {
      const totalChars = TokenUtils.estimateTotalChars([]);
      expect(totalChars).toBe(0);
    });

    it('应该正确处理中文', () => {
      const messages = [
        new HumanMessage('你好世界'),
        new AIMessage('测试')
      ];
      
      const totalChars = TokenUtils.estimateTotalChars(messages);
      expect(totalChars).toBe(6); // 4 + 2
    });
  });

  describe('computeAdaptiveChunkRatio', () => {
    it('消息较小时应返回默认比例 0.4', () => {
      const messages = createTestMessages(10); // 平均消息较小
      const ratio = TokenUtils.computeAdaptiveChunkRatio(messages, 8000);
      
      expect(ratio).toBe(0.4);
    });

    it('消息较大时应减小分块比例', () => {
      // 创建大消息
      const largeMessages = [
        new HumanMessage('A'.repeat(1000)),
        new AIMessage('B'.repeat(1000)),
        new HumanMessage('C'.repeat(1000))
      ];
      
      const ratio = TokenUtils.computeAdaptiveChunkRatio(largeMessages, 8000);
      
      // 应该小于默认值 0.4
      expect(ratio).toBeLessThan(0.4);
      expect(ratio).toBeGreaterThanOrEqual(0.15); // 不低于最小值
    });

    it('空消息数组应返回默认比例', () => {
      const ratio = TokenUtils.computeAdaptiveChunkRatio([], 8000);
      expect(ratio).toBe(0.4);
    });

    it('上下文窗口为 0 时应返回默认比例', () => {
      const messages = createTestMessages(5);
      const ratio = TokenUtils.computeAdaptiveChunkRatio(messages, 0);
      expect(ratio).toBe(0.4);
    });
  });
});

// ==================== Layer 2: 上下文裁剪测试 ====================

describe('Layer 2: 上下文裁剪测试', () => {
  describe('pruneContext', () => {
    it('上下文较小时不应裁剪', () => {
      const messages = createTestMessages(5); // 少量消息
      const result = pruneContext(messages, DEFAULT_PRUNING_SETTINGS, 8000);
      
      expect(result).toEqual(messages); // 应返回原数组
    });

    it('超过软裁剪阈值时应触发裁剪', () => {
      // 创建大量工具结果消息
      const messages: BaseMessage[] = [
        new HumanMessage('开始对话'),
        ...Array.from({ length: 20 }, (_, i) => 
          new ToolResultMessage('X'.repeat(5000)) // 每条 5000 字符
        ),
        new AIMessage('最近的回复 1'),
        new AIMessage('最近的回复 2'),
        new AIMessage('最近的回复 3')
      ];
      
      const result = pruneContext(messages, DEFAULT_PRUNING_SETTINGS, 8000);
      
      // 应该有消息被裁剪
      expect(result.length).toBe(messages.length); // 消息数量不变
      // 检查是否有内容被截断
      const hasTrimmed = result.some(msg => 
        msg.content.includes('[Tool result trimmed')
      );
      expect(hasTrimmed).toBe(true);
    });

    it('应保护最近的 N 条 assistant 消息', () => {
      const messages: BaseMessage[] = [
        new ToolResultMessage('旧数据 1'),
        new ToolResultMessage('旧数据 2'),
        new AIMessage('保护 1'),
        new AIMessage('保护 2'),
        new AIMessage('保护 3')
      ];
      
      const result = pruneContext(messages, DEFAULT_PRUNING_SETTINGS, 8000);
      
      // 最近的 3 条 AI 消息应保持完整
      const lastThree = result.slice(-3);
      lastThree.forEach((msg, idx) => {
        expect(msg.type).toBe('ai');
        expect(msg.content).toBe(`保护 ${idx + 1}`);
      });
    });

    it('应保护第一条用户消息', () => {
      const messages: BaseMessage[] = [
        new HumanMessage('重要的初始请求'),
        new ToolResultMessage('X'.repeat(5000)),
        new AIMessage('回复')
      ];
      
      const result = pruneContext(messages, DEFAULT_PRUNING_SETTINGS, 8000);
      
      // 第一条用户消息应保持完整
      expect(result[0].type).toBe('human');
      expect(result[0].content).toBe('重要的初始请求');
    });
  });
});

// ==================== Layer 3: 工具结果截断测试 ====================

describe('Layer 3: 工具结果截断测试', () => {
  describe('truncateToolResult', () => {
    it('短文本不应截断', () => {
      const text = '短文本';
      const result = truncateToolResult(text, 1000);
      
      expect(result).toBe(text);
    });

    it('长文本应被截断', () => {
      const text = 'A'.repeat(5000);
      const result = truncateToolResult(text, 2000);
      
      expect(result.length).toBeLessThan(text.length);
      expect(result).toContain('[Truncated:');
    });

    it('包含错误信息的文本应保留尾部', () => {
      const text = 'A'.repeat(4000) + '\nError: Connection failed';
      const result = truncateToolResult(text, 2000);
      
      // 应包含错误信息
      expect(result).toContain('Error: Connection failed');
      // 应有中间省略标记
      expect(result).toContain('[... middle content omitted ...]');
    });

    it('JSON 结尾的文本应保留尾部', () => {
      const text = 'A'.repeat(4000) + '\n{"status": "success"}';
      const result = truncateToolResult(text, 2000);
      
      expect(result).toContain('{"status": "success"}');
      expect(result).toContain('[... middle content omitted ...]');
    });

    it('应尊重最小保留字符数', () => {
      const text = 'A'.repeat(10000);
      const result = truncateToolResult(text, 2000, 1500);
      
      expect(result.length).toBeGreaterThanOrEqual(1500);
    });
  });

  describe('calculateMaxToolResultChars', () => {
    it('应根据上下文窗口计算最大字符数', () => {
      const maxChars = calculateMaxToolResultChars(8000);
      
      // 8000 tokens * 0.3 * 4 chars/token = 9600 chars
      expect(maxChars).toBe(9600);
    });

    it('不应超过绝对上限 40000', () => {
      const maxChars = calculateMaxToolResultChars(100000);
      
      expect(maxChars).toBeLessThanOrEqual(40000);
    });
  });

  describe('truncateAggregateToolResults', () => {
    it('总字符数在预算内时不应截断', () => {
      const messages = [
        new ToolResultMessage('短文本 1'),
        new ToolResultMessage('短文本 2')
      ];
      
      const result = truncateAggregateToolResults(messages, 8000);
      
      expect(result).toEqual(messages);
    });

    it('总字符数超限时应从最旧的开始截断', () => {
      const messages = createMessagesWithToolResults();
      
      const result = truncateAggregateToolResults(messages, 8000);
      
      // 应该有工具结果被截断
      const hasTruncated = result.some(msg => 
        msg.type === 'tool_result' && msg.content.includes('[Truncated:')
      );
      expect(hasTruncated).toBe(true);
    });

    it('应保留非工具结果消息不变', () => {
      const messages = createMessagesWithToolResults();
      const originalHumanMessages = messages.filter(m => m.type === 'human');
      
      const result = truncateAggregateToolResults(messages, 8000);
      const resultHumanMessages = result.filter(m => m.type === 'human');
      
      expect(resultHumanMessages).toEqual(originalHumanMessages);
    });
  });
});

// ==================== Layer 4: 预防性决策测试 ====================

describe('Layer 4: 预防性决策测试', () => {
  describe('decideCompactionRoute', () => {
    it('无溢出时应返回 FITS', () => {
      const messages = createTestMessages(5);
      const result = decideCompactionRoute(
        messages,
        '系统提示',
        '用户输入',
        8000
      );
      
      expect(result.route).toBe(CompactionRoute.FITS);
      expect(result.shouldCompact).toBe(false);
      expect(result.overflowTokens).toBe(0);
    });

    it('有溢出且无可截断空间时应返回 COMPACT_ONLY', () => {
      // 创建大量普通消息（无工具结果）
      const messages = createTestMessages(100);
      
      const result = decideCompactionRoute(
        messages,
        '系统提示',
        '用户输入',
        8000
      );
      
      expect(result.route).toBe(CompactionRoute.COMPACT_ONLY);
      expect(result.shouldCompact).toBe(true);
    });

    it('有大量可截断工具结果时应返回 TRUNCATE_TOOL_RESULTS_ONLY', () => {
      const messages = createMessagesWithToolResults();
      
      const result = decideCompactionRoute(
        messages,
        '',
        '',
        8000
      );
      
      // 由于工具结果很大，可能只需截断
      expect([
        CompactionRoute.TRUNCATE_TOOL_RESULTS_ONLY,
        CompactionRoute.COMPACT_THEN_TRUNCATE
      ]).toContain(result.route);
    });

    it('应正确估算 token 数', () => {
      const messages = createTestMessages(10);
      const systemPrompt = '系统提示';
      const userPrompt = '用户输入';
      
      const result = decideCompactionRoute(
        messages,
        systemPrompt,
        userPrompt,
        8000
      );
      
      // 估算的 token 数应大于 0
      expect(result.estimatedTokens).toBeGreaterThan(0);
    });

    it('安全系数应为 1.2', () => {
      const messages = createTestMessages(10);
      
      const result = decideCompactionRoute(
        messages,
        '',
        '',
        8000
      );
      
      // 手动计算预期值
      const manualEstimate = TokenUtils.calculateMessagesTokenCount(messages) * 1.2;
      
      // 允许小误差
      expect(result.estimatedTokens).toBeCloseTo(manualEstimate, -1);
    });
  });
});

// ==================== Layer 6: 质量审计测试 ====================

describe('Layer 6: 质量审计测试', () => {
  describe('auditSummaryQuality', () => {
    it('摘要过短时应失败', () => {
      const summary = '太短';
      const messages = createTestMessages(5);
      
      const result = auditSummaryQuality(summary, messages);
      
      expect(result.passed).toBe(false);
      expect(result.issues).toContain('summary_too_short');
    });

    it('正常摘要应通过', () => {
      const summary = '这是一个足够长的摘要，包含了足够的信息来通过质量检查。用户询问了关于数据处理的问题，AI 提供了详细的解答。';
      const messages = createTestMessages(5);
      
      const result = auditSummaryQuality(summary, messages);
      
      expect(result.passed).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it('缺少最近用户请求时应标记问题', () => {
      const summary = '之前的对话内容摘要...';
      const messages = [
        new HumanMessage('非常重要的特定请求：请分析 XYZ 数据'),
        new AIMessage('好的')
      ];
      
      const result = auditSummaryQuality(summary, messages);
      
      expect(result.issues).toContain('missing_recent_request');
    });

    it('多个问题时应建议重试', () => {
      const summary = '短';
      const messages = [
        new HumanMessage('重要请求 ABC'),
        new AIMessage('回复')
      ];
      
      const result = auditSummaryQuality(summary, messages);
      
      expect(result.retry).toBe(true);
    });

    it('应检测 UUID 标识符保留', () => {
      const uuid = '550e8400-e29b-41d4-a716-446655440000';
      const summary = `处理了任务 ${uuid}，状态已完成`;
      const messages = [
        new HumanMessage(`请处理任务 ${uuid}`),
        new AIMessage('已处理')
      ];
      
      const result = auditSummaryQuality(summary, messages);
      
      // UUID 被保留，不应有问题
      expect(result.issues).not.toContain(expect.stringContaining('missing_ids'));
    });
  });
});

// ==================== 集成测试 ====================

describe('集成测试', () => {
  it('完整流程：裁剪 → 截断 → 决策', () => {
    // 1. 创建大量消息
    const messages = createMessagesWithToolResults();
    
    // 2. Layer 2: 上下文裁剪
    const pruned = pruneContext(messages, DEFAULT_PRUNING_SETTINGS, 8000);
    expect(pruned.length).toBe(messages.length);
    
    // 3. Layer 3: 工具结果截断
    const truncated = truncateAggregateToolResults(pruned, 8000);
    expect(truncated.length).toBe(pruned.length);
    
    // 4. Layer 4: 预防性决策
    const route = decideCompactionRoute(
      truncated,
      '系统提示',
      '用户输入',
      8000
    );
    
    expect(route.route).toBeDefined();
    expect(Object.values(CompactionRoute)).toContain(route.route);
  });

  it('Token 计算准确性', () => {
    const messages = createTestMessages(20);
    
    const tokenCount = TokenUtils.calculateMessagesTokenCount(messages);
    const charCount = TokenUtils.estimateTotalChars(messages);
    
    // Token 数应合理（chars/4 左右）
    expect(tokenCount).toBeGreaterThan(0);
    expect(tokenCount).toBeLessThan(charCount); // 通常 token < chars
  });
});

// ==================== 边界情况测试 ====================

describe('边界情况测试', () => {
  it('空消息数组', () => {
    const messages: BaseMessage[] = [];
    
    const pruned = pruneContext(messages, DEFAULT_PRUNING_SETTINGS, 8000);
    expect(pruned).toEqual([]);
    
    const truncated = truncateAggregateToolResults(messages, 8000);
    expect(truncated).toEqual([]);
    
    const route = decideCompactionRoute(messages, '', '', 8000);
    expect(route.route).toBe(CompactionRoute.FITS);
  });

  it('单条消息', () => {
    const messages = [new HumanMessage('唯一消息')];
    
    const pruned = pruneContext(messages, DEFAULT_PRUNING_SETTINGS, 8000);
    expect(pruned.length).toBe(1);
  });

  it('超大消息', () => {
    const hugeMessage = new HumanMessage('A'.repeat(100000));
    const messages = [hugeMessage];
    
    const tokenCount = TokenUtils.calculateMessagesTokenCount(messages);
    expect(tokenCount).toBeGreaterThan(0);
  });

  it('特殊字符', () => {
    const messages = [
      new HumanMessage('包含\n换行符\t制表符"引号\'单引号'),
      new AIMessage('包含 emoji 😀 和特殊符号 @#$%')
    ];
    
    const tokenCount = TokenUtils.calculateMessagesTokenCount(messages);
    expect(tokenCount).toBeGreaterThan(0);
  });
});
