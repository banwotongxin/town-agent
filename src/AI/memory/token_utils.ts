/**
 * Token计算工具类
 * 使用tiktoken库进行准确的token计算，当tiktoken不可用时使用fallback方案
 */
export class TokenUtils {
  private static encoding: any;
  private static useFallback: boolean = false;

  /**
   * 初始化编码
   */
  private static initializeEncoding(): void {
    if (!this.encoding && !this.useFallback) {
      try {
        // 尝试动态导入tiktoken
        const tiktoken = require('tiktoken');
        // 使用cl100k_base编码，适用于gpt-4, gpt-3.5-turbo等模型
        this.encoding = tiktoken.get_encoding('cl100k_base');
      } catch (error) {
        console.warn('tiktoken库不可用，使用fallback方案进行token计算:', (error as any).message);
        this.useFallback = true;
      }
    }
  }

  /**
   * 计算文本的token数
   * @param text 文本内容
   * @returns token数
   */
  public static calculateTokenCount(text: string): number {
    this.initializeEncoding();
    
    if (!this.useFallback && this.encoding) {
      try {
        const tokens = this.encoding.encode(text);
        return tokens.length;
      } catch (error) {
        console.error('Error calculating token count with tiktoken:', error);
        this.useFallback = true;
      }
    }
    
    // fallback到简单的字符计数
    // 粗略估计：1个中文字符≈1个token，4个英文字符≈1个token
    const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
    const nonChineseText = text.replace(/[\u4e00-\u9fa5]/g, '');
    const englishTokens = Math.ceil(nonChineseText.length / 4);
    return chineseChars + englishTokens;
  }

  /**
   * 计算消息数组的token数
   * @param messages 消息数组
   * @returns token数
   */
  public static calculateMessagesTokenCount(messages: Array<{ content: string }>): number {
    return messages.reduce((total, msg) => total + this.calculateTokenCount(msg.content), 0);
  }

  /**
   * 估算消息数组的总字符数
   * @param messages 消息数组
   * @returns 总字符数
   */
  public static estimateTotalChars(messages: Array<{ content: string }>): number {
    return messages.reduce((total, msg) => total + msg.content.length, 0);
  }

  /**
   * 计算自适应分块比例（Layer 5 需要）
   * 根据消息平均大小自适应调整分块比例，消息越大用越小的块
   * @param messages 消息数组
   * @param contextWindow 上下文窗口大小（tokens）
   * @returns 分块比例（0.15-0.4）
   */
  public static computeAdaptiveChunkRatio(
    messages: Array<{ content: string }>, 
    contextWindow: number
  ): number {
    const BASE_CHUNK_RATIO = 0.4;
    const MIN_CHUNK_RATIO = 0.15;
    const SAFETY_MARGIN = 1.2;
    
    if (messages.length === 0 || contextWindow <= 0) {
      return BASE_CHUNK_RATIO;
    }
    
    const totalTokens = this.calculateMessagesTokenCount(messages);
    const avgTokens = totalTokens / messages.length;
    const avgRatio = (avgTokens * SAFETY_MARGIN) / contextWindow;
    
    // 如果平均消息超过上下文的10%，减小分块比例
    if (avgRatio > 0.1) {
      const reduction = Math.min(avgRatio * 2, BASE_CHUNK_RATIO - MIN_CHUNK_RATIO);
      return Math.max(MIN_CHUNK_RATIO, BASE_CHUNK_RATIO - reduction);
    }
    
    return BASE_CHUNK_RATIO;
  }
}
