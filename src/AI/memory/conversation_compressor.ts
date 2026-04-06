import { BaseMessage, HumanMessage, AIMessage, ToolMessage, ToolResultMessage } from '../agents/base_agent';
import { TokenUtils } from './token_utils';

/**
 * 对话压缩器类
 * 用于压缩长对话，减少内存使用和提高处理效率
 */
export class ConversationCompressor {
  // 大语言模型实例，用于生成更智能的摘要
  private llmModel?: any;

  /**
   * 构造函数
   * @param llmModel 可选的大语言模型实例
   */
  constructor(llmModel?: any) {
    this.llmModel = llmModel;
  }

  /**
   * 压缩对话消息为文本摘要
   * @param messages 对话消息数组
   * @param existingSummary 现有摘要（如果有）
   * @param maxTokens 最大token数，默认500
   * @returns 压缩后的对话摘要
   */
  compress(
    messages: BaseMessage[],
    existingSummary?: string,
    maxTokens: number = 500
  ): string {
    // 存储格式化后的对话文本
    const conversationText: string[] = [];

    // 遍历消息，根据类型格式化
    for (const msg of messages) {
      if (msg.type === 'human') {
        conversationText.push(`用户：${msg.content}`);
      } else if (msg.type === 'ai') {
        conversationText.push(`助手：${msg.content}`);
      } else if (msg.type === 'tool') {
        conversationText.push(`工具：${msg.content}`);
      } else if (msg.type === 'tool_result') {
        conversationText.push(`工具结果：${msg.content}`);
      }
    }

    // 将所有消息文本连接成一个字符串
    const conversationStr = conversationText.join('\n');

    // 如果有现有摘要，在其基础上添加新对话
    if (existingSummary) {
      return `${existingSummary}\n\n[新对话]\n${conversationStr.substring(0, maxTokens * 4)}`;
    } else {
      // 否则创建新的对话摘要
      return `[对话摘要]\n${conversationStr.substring(0, maxTokens * 4)}`;
    }
  }

  /**
   * 计算文本的token数
   * @param text 文本内容
   * @returns 准确的token数
   */
  calculateTokenCount(text: string): number {
    return TokenUtils.calculateTokenCount(text);
  }

  /**
   * 第一层压缩：删除过期的工具记忆
   * 保留最近的N个工具调用和结果
   * @param messages 原始消息数组
   * @param maxToolCalls 保留的最大工具调用数，默认3
   * @returns 过滤后的消息数组
   */
  private removeExpiredToolMemories(
    messages: BaseMessage[], 
    maxToolCalls: number = 3
  ): BaseMessage[] {
    const filteredMessages: BaseMessage[] = [];
    let toolCallCount = 0;
    
    // 从后往前遍历，保留最近的工具调用
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      
      if (msg.type === 'tool' || msg.type === 'tool_result') {
        if (toolCallCount < maxToolCalls) {
          filteredMessages.unshift(msg);
          toolCallCount++;
        }
        // 超过限制的工具调用被丢弃
      } else {
        // 非工具消息全部保留
        filteredMessages.unshift(msg);
      }
    }
    
    console.log(`[第一层压缩] 删除过期工具记忆: ${messages.length} -> ${filteredMessages.length}`);
    return filteredMessages;
  }

  /**
   * 第二层压缩：提取关键对话
   * 优先保留用户和助手的对话，移除冗余的系统消息
   * @param messages 过滤后的消息数组
   * @returns 关键对话消息数组
   */
  private extractKeyConversations(messages: BaseMessage[]): BaseMessage[] {
    // 策略1：保留所有用户和助手消息
    const keyMessages = messages.filter(msg => 
      msg.type === 'human' || msg.type === 'ai'
    );
    
    // 策略2：如果关键消息太少，保留部分工具消息
    if (keyMessages.length < messages.length * 0.3) {
      // 保留最近的几个工具消息
      const toolMessages = messages
        .filter(msg => msg.type === 'tool' || msg.type === 'tool_result')
        .slice(-2);
      
      return [...keyMessages, ...toolMessages];
    }
    
    console.log(`[第二层压缩] 提取关键对话: ${messages.length} -> ${keyMessages.length}`);
    return keyMessages;
  }

  /**
   * 第三层压缩：使用LLM进行智能压缩
   * 生成语义完整的对话摘要
   * @param messages 关键对话消息数组
   * @param existingSummary 现有摘要（如果有）
   * @returns 压缩后的文本摘要
   */
  async compressWithLLM(
    messages: BaseMessage[], 
    existingSummary?: string
  ): Promise<string> {
    if (!this.llmModel) {
      console.warn('[警告] 未配置LLM模型，使用基础压缩');
      return this.compress(messages, existingSummary);
    }
    
    try {
      // 构建提示词
      const prompt = this.buildSummaryPrompt(messages, existingSummary);
      
      // 调用LLM生成摘要
      const response = await this.llmModel.invoke([
        {
          type: 'system',
          content: '你是一个专业的对话总结助手。请对以下对话进行精炼总结，提取关键信息，保持语义完整性。总结应该简洁但包含所有重要细节。'
        },
        {
          type: 'human',
          content: prompt
        }
      ]);
      
      const summary = response.content || this.compress(messages, existingSummary);
      console.log(`[第三层压缩] AI压缩完成，生成摘要长度: ${summary.length}`);
      
      return summary;
    } catch (error) {
      console.error('[错误] LLM压缩失败，使用基础压缩:', error);
      return this.compress(messages, existingSummary);
    }
  }

  /**
   * 构建摘要提示词
   */
  private buildSummaryPrompt(messages: BaseMessage[], existingSummary?: string): string {
    let prompt = '请对以下对话进行总结：\n\n';
    
    if (existingSummary) {
      prompt += `现有摘要：\n${existingSummary}\n\n`;
    }
    
    prompt += '对话内容：\n';
    for (const msg of messages) {
      if (msg.type === 'human') {
        prompt += `用户：${msg.content}\n`;
      } else if (msg.type === 'ai') {
        prompt += `助手：${msg.content}\n`;
      } else if (msg.type === 'tool') {
        prompt += `工具：${msg.content}\n`;
      } else if (msg.type === 'tool_result') {
        prompt += `工具结果：${msg.content}\n`;
      }
    }
    
    prompt += '\n请生成一个简洁但信息完整的摘要（不超过500字）。';
    return prompt;
  }

  /**
   * 执行三层压缩
   * @param messages 原始消息数组
   * @param useLLM 是否使用LLM进行第三层压缩
   * @returns 压缩后的消息数组或摘要
   */
  async compressThreeLayers(
    messages: BaseMessage[],
    useLLM: boolean = true
  ): Promise<BaseMessage[]> {
    console.log(`[三层压缩开始] 原始消息数: ${messages.length}`);
    
    // 第一层：删除过期工具记忆
    let compressed = this.removeExpiredToolMemories(messages);
    
    // 第二层：提取关键对话
    compressed = this.extractKeyConversations(compressed);
    
    // 第三层：AI压缩（如果需要）
    if (useLLM && compressed.length > 5) {
      try {
        const summary = await this.compressWithLLM(compressed);
        
        // 将摘要转换为单条消息
        return [new AIMessage(`[对话摘要]\n${summary}`, {
          compression_type: 'three_layer',
          original_count: messages.length,
          compressed_count: 1,
          timestamp: Date.now()
        })];
      } catch (error) {
        console.error('[错误] 第三层压缩失败，返回第二层结果:', error);
        return compressed;
      }
    }
    
    console.log(`[三层压缩完成] 最终消息数: ${compressed.length}`);
    return compressed;
  }
}
