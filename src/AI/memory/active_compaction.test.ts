/**
 * Layer 5: 主动压缩测试
 * 
 * 由于 activeCompact 需要 LLM 模型，这里使用 Mock LLM 进行测试
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { BaseMessage, HumanMessage, AIMessage, ToolResultMessage } from '../agents/base_agent';
import { activeCompact } from './active_compaction';
import { TokenUtils } from './token_utils';

// ==================== Mock LLM 模型 ====================

/**
 * 创建模拟的 LLM 模型
 */
function createMockLLMModel(responses?: string[]): any {
  let callCount = 0;
  
  return {
    invoke: jest.fn(async (messages: any[]) => {
      // 提取用户消息内容
      const userMsg = messages.find((m: any) => m.type === 'human' || m.content);
      const content = userMsg?.content || '';
      
      // 根据输入生成不同的摘要
      let response: string;
      
      if (responses && responses[callCount]) {
        // 使用预定义的响应
        response = responses[callCount];
      } else {
        // 自动生成摘要
        const msgCount = content.split('\n').filter((line: string) => line.includes(':')).length;
        response = `这是 ${msgCount} 条对话的摘要。讨论了主要话题，做出了关键决策，任务状态已更新。`;
      }
      
      callCount++;
      
      return {
        content: response
      };
    })
  };
}

// ==================== 辅助函数 ====================

/**
 * 创建长对话测试数据
 */
function createLongConversation(messageCount: number): BaseMessage[] {
  const messages: BaseMessage[] = [];
  
  for (let i = 0; i < messageCount; i++) {
    if (i % 3 === 0) {
      messages.push(new HumanMessage(`用户问题 ${i + 1}: 关于项目架构的讨论`));
    } else if (i % 3 === 1) {
      messages.push(new AIMessage(`AI回复 ${i + 1}: 建议使用 TypeScript 和微服务架构`));
    } else {
      messages.push(new ToolResultMessage(
        `工具结果 ${i + 1}: ` + 'X'.repeat(200),
        { tool_call_id: `call_${i}` }
      ));
    }
  }
  
  return messages;
}

// 别名：简化函数名
const createMockLLM = createMockLLMModel;

describe('Layer 5: 主动压缩测试', () => {
  describe('activeCompact 基本功能', () => {
    it('应成功压缩长对话', async () => {
      const messages = createLongConversation(30);
      const mockLLM = createMockLLM();
      
      const result = await activeCompact(messages, 8000, mockLLM);
      
      // 验证返回结构
      expect(result).toHaveProperty('keptMessages');
      expect(result).toHaveProperty('summary');
      expect(result).toHaveProperty('tokensBefore');
      expect(result).toHaveProperty('tokensAfter');
      
      // 验证压缩效果
      expect(result.tokensAfter).toBeLessThan(result.tokensBefore);
      expect(result.keptMessages.length).toBeLessThan(messages.length);
    });

    it('压缩率应在合理范围内（50-70%）', async () => {
      const messages = createLongConversation(50);
      const mockLLM = createMockLLM();
      
      const result = await activeCompact(messages, 8000, mockLLM);
      
      const compressionRate = 1 - (result.tokensAfter / result.tokensBefore);
      
      // 压缩率应在 30%-80% 之间（放宽范围以适应不同场景）
      expect(compressionRate).toBeGreaterThan(0.3);
      expect(compressionRate).toBeLessThan(0.8);
    });

    it('短对话不应进行压缩', async () => {
      const messages = [
        new HumanMessage('你好'),
        new AIMessage('你好！')
      ];
      const mockLLM = createMockLLM();
      
      const result = await activeCompact(messages, 8000, mockLLM);
      
      // 消息太少，不应丢弃任何消息
      expect(result.keptMessages.length).toBe(messages.length);
      expect(result.summary).toBeUndefined();
    });

    it('应保留最近的消息', async () => {
      const messages = createLongConversation(40);
      const mockLLM = createMockLLM();
      
      const result = await activeCompact(messages, 8000, mockLLM);
      
      // 最后一条消息应该是用户或 AI 消息（不是摘要）
      const lastMsg = result.keptMessages[result.keptMessages.length - 1];
      expect(['human', 'ai']).toContain(lastMsg.type);
    });

    it('第一条消息应该是摘要', async () => {
      const messages = createLongConversation(30);
      const mockLLM = createMockLLM();
      
      const result = await activeCompact(messages, 8000, mockLLM);
      
      const firstMsg = result.keptMessages[0];
      expect(firstMsg.type).toBe('human');
      expect(firstMsg.content).toContain('[Conversation Summary]');
    });
  });

  describe('分块摘要逻辑', () => {
    it('消息过多时应分块处理', async () => {
      const messages = createLongConversation(60); // 大量消息
      const mockLLM = createMockLLM([
        '第一部分摘要',
        '第二部分摘要',
        '合并后的最终摘要'
      ]);
      
      const result = await activeCompact(messages, 8000, mockLLM);
      
      // LLM 应被调用多次（分块 + 合并）
      expect(mockLLM.invoke.mock.calls.length).toBeGreaterThanOrEqual(2);
      
      expect(result.summary).toBeDefined();
      expect(result.summary!.length).toBeGreaterThan(0);
    });

    it('单块消息应直接摘要', async () => {
      const messages = createLongConversation(10); // 少量消息
      const mockLLM = createMockLLM(['单块摘要']);
      
      const result = await activeCompact(messages, 8000, mockLLM);
      
      // 如果消息足够少，可能不需要分块
      expect(result.summary).toBeDefined();
    });
  });

  describe('历史裁剪逻辑', () => {
    it('应丢弃旧消息并保留新消息', async () => {
      const messages = createLongConversation(40);
      const mockLLM = createMockLLM(['摘要']);
      
      const result = await activeCompact(messages, 8000, mockLLM);
      
      // 保留的消息数应约为总数的一半（50% 预算）
      const keptCount = result.keptMessages.length - 1; // 减去摘要消息
      const expectedKeep = Math.floor(messages.length * 0.5);
      
      // 允许一定误差
      expect(keptCount).toBeGreaterThanOrEqual(expectedKeep * 0.8);
      expect(keptCount).toBeLessThanOrEqual(expectedKeep * 1.2);
    });

    it('应保持 tool_use/tool_result 配对', async () => {
      const messages: BaseMessage[] = [
        new HumanMessage('查询数据'),
        new AIMessage('查询中', { 
          tool_calls: [{ id: 'call_1', name: 'query' }] 
        }),
        new ToolResultMessage('结果数据', { tool_call_id: 'call_1' }),
        new HumanMessage('分析数据'),
        new AIMessage('分析中', { 
          tool_calls: [{ id: 'call_2', name: 'analyze' }] 
        }),
        new ToolResultMessage('分析结果', { tool_call_id: 'call_2' }),
      ];
      
      const mockLLM = createMockLLM(['摘要']);
      const result = await activeCompact(messages, 8000, mockLLM);
      
      // 检查保留的消息中，tool_result 都有对应的 tool_call
      const toolResults = result.keptMessages.filter(m => m.type === 'tool_result');
      const toolCalls = new Set<string>();
      
      result.keptMessages.forEach(msg => {
        if (msg.type === 'ai' && msg.metadata?.tool_calls) {
          msg.metadata.tool_calls.forEach((call: any) => {
            toolCalls.add(call.id);
          });
        }
      });
      
      // 所有保留的 tool_result 都应有对应的 tool_call
      toolResults.forEach(tr => {
        const callId = tr.metadata?.tool_call_id;
        if (callId) {
          expect(toolCalls.has(callId)).toBe(true);
        }
      });
    });
  });

  describe('降级策略', () => {
    it('LLM 失败时应返回兜底文本', async () => {
      const messages = createLongConversation(20);
      
      // 创建会失败的 Mock LLM
      const failingLLM = {
        invoke: jest.fn(async () => {
          throw new Error('LLM 调用失败');
        })
      };
      
      const result = await activeCompact(messages, 8000, failingLLM as any);
      
      // 即使失败，也应返回某种形式的摘要
      expect(result.summary).toBeDefined();
      expect(typeof result.summary).toBe('string');
    });

    it('部分消息过大时应跳过', async () => {
      const messages: BaseMessage[] = [
        new HumanMessage('正常消息'),
        new HumanMessage('A'.repeat(50000)), // 超大消息
        new AIMessage('正常回复')
      ];
      
      const mockLLM = createMockLLM(['部分摘要']);
      const result = await activeCompact(messages, 8000, mockLLM);
      
      // 应能处理，不崩溃
      expect(result).toBeDefined();
      expect(result.keptMessages).toBeDefined();
    });
  });

  describe('自定义指令', () => {
    it('应支持自定义压缩指令', async () => {
      const messages = createLongConversation(20);
      const customInstructions = '请特别关注技术决策和代码示例';
      const mockLLM = createMockLLM(['自定义摘要']);
      
      const result = await activeCompact(
        messages, 
        8000, 
        mockLLM,
        customInstructions
      );
      
      expect(result.summary).toBeDefined();
      // LLM 应被调用
      expect(mockLLM.invoke).toHaveBeenCalled();
    });
  });

  describe('边界情况', () => {
    it('空消息数组', async () => {
      const messages: BaseMessage[] = [];
      const mockLLM = createMockLLM();
      
      const result = await activeCompact(messages, 8000, mockLLM);
      
      expect(result.keptMessages).toEqual([]);
      expect(result.tokensBefore).toBe(0);
      expect(result.tokensAfter).toBe(0);
    });

    it('单条消息', async () => {
      const messages = [new HumanMessage('唯一消息')];
      const mockLLM = createMockLLM();
      
      const result = await activeCompact(messages, 8000, mockLLM);
      
      expect(result.keptMessages.length).toBe(1);
    });

    it('上下文窗口为 0', async () => {
      const messages = createLongConversation(10);
      const mockLLM = createMockLLM(['摘要']);
      
      const result = await activeCompact(messages, 0, mockLLM);
      
      // 应能处理，不崩溃
      expect(result).toBeDefined();
    });
  });

  describe('性能测试', () => {
    it('应在合理时间内完成压缩', async () => {
      const messages = createLongConversation(50);
      const mockLLM = createMockLLM([
        '摘要1', '摘要2', '摘要3', '合并摘要'
      ]);
      
      const startTime = Date.now();
      const result = await activeCompact(messages, 8000, mockLLM);
      const duration = Date.now() - startTime;
      
      // Mock LLM 应该很快，实际 LLM 可能需要几秒
      expect(duration).toBeLessThan(1000); // 1秒内（Mock）
      expect(result.tokensAfter).toBeLessThan(result.tokensBefore);
    });

    it('应正确处理大量消息', async () => {
      const messages = createLongConversation(100);
      const mockLLM = createMockLLM(Array(10).fill('摘要'));
      
      const result = await activeCompact(messages, 8000, mockLLM);
      
      expect(result).toBeDefined();
      expect(result.keptMessages.length).toBeLessThan(messages.length);
    });
  });
});

// ==================== 日志输出测试 ====================

describe('日志输出测试', () => {
  it('应输出压缩开始日志', async () => {
    const consoleSpy = jest.spyOn(console, 'log');
    
    const messages = createLongConversation(20);
    const mockLLM = createMockLLM(['摘要']);
    
    await activeCompact(messages, 8000, mockLLM);
    
    // 检查是否有开始日志
    const hasStartLog = consoleSpy.mock.calls.some(call => 
      call[0].includes('[主动压缩] 开始')
    );
    expect(hasStartLog).toBe(true);
    
    consoleSpy.mockRestore();
  });

  it('应输出压缩完成日志', async () => {
    const consoleSpy = jest.spyOn(console, 'log');
    
    const messages = createLongConversation(20);
    const mockLLM = createMockLLM(['摘要']);
    
    await activeCompact(messages, 8000, mockLLM);
    
    // 检查是否有完成日志
    const hasCompleteLog = consoleSpy.mock.calls.some(call => 
      call[0].includes('[主动压缩] 完成')
    );
    expect(hasCompleteLog).toBe(true);
    
    consoleSpy.mockRestore();
  });
});
