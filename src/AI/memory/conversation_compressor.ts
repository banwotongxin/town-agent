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
   * 使用大语言模型压缩对话
   * @param messages 对话消息数组
   * @param existingSummary 现有摘要（如果有）
   * @returns 压缩后的对话摘要
   */
  async compressWithLLM(
    messages: BaseMessage[],
    existingSummary?: string
  ): Promise<string> {
    // 构建摘要提示词
    const prompt = this.buildSummaryPrompt(messages, existingSummary);
    
    // 如果有大语言模型，使用它生成摘要
    if (this.llmModel) {
      try {
        const response = await this.llmModel.invoke([
          {
            type: 'system',
            content: '请对以下对话进行总结，提取关键信息，保持语义完整。'
          },
          {
            type: 'human',
            content: prompt
          }
        ]);
        
        // 返回模型生成的摘要，如果没有内容则使用默认压缩
        return response.content || this.compress(messages, existingSummary);
      } catch (error) {
        console.error('LLM 摘要压缩失败，使用默认压缩:', error);
        // 出错时使用默认压缩
        return this.compress(messages, existingSummary);
      }
    } else {
      // 如果没有大语言模型，使用默认压缩
      return this.compress(messages, existingSummary);
    }
  }

  /**
   * 构建摘要提示词
   * @param messages 对话消息数组
   * @param existingSummary 现有摘要（如果有）
   * @returns 构建好的提示词
   */
  private buildSummaryPrompt(messages: BaseMessage[], existingSummary?: string): string {
    let prompt = '请对以下对话进行总结，提取关键信息，保持语义完整：\n\n';
    
    // 添加现有摘要（如果有）
    if (existingSummary) {
      prompt += `现有摘要：\n${existingSummary}\n\n`;
    }
    
    // 添加对话内容
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
    
    prompt += '\n请生成一个简洁但信息完整的摘要。';
    return prompt;
  }

  /**
   * 判断是否需要压缩对话
   * @param messages 对话消息数组
   * @param threshold 阈值，默认10条消息
   * @returns 是否需要压缩
   */
  shouldCompress(
    messages: BaseMessage[],
    threshold: number = 10
  ): boolean {
    return messages.length >= threshold;
  }

  /**
   * 计算压缩率
   * @param original 原始文本
   * @param compressed 压缩后的文本
   * @returns 压缩率（压缩后长度/原始长度）
   */
  getCompressionRatio(original: string, compressed: string): number {
    if (!original) {
      return 0.0;
    }
    return compressed.length / original.length;
  }

  /**
   * 计算文本的token数
   * @param text 文本内容
   * @returns 准确的token数
   */
  calculateTokenCount(text: string): number {
    return TokenUtils.calculateTokenCount(text);
  }
}
