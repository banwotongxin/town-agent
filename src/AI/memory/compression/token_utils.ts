/**
 * Token计算工具类
 * 
 * 【功能说明】
 * 提供准确的Token计算功能，优先使用tiktoken库进行精确计算。
 * 当tiktoken不可用时，自动降级到基于字符数的估算方案。
 * 
 * 【使用场景】
 * - 计算对话历史的Token数量
 * - 评估是否需要进行上下文压缩
 * - 控制发送给LLM的消息大小
 */
export class TokenUtils { // Token计算工具类
  private static encoding: any; // tiktoken编码器实例
  private static useFallback: boolean = false; // 是否使用降级方案

  /**
   * 初始化编码
   * 
   * 【工作原理】
   * 尝试动态加载tiktoken库，如果失败则标记为使用降级方案。
   * tiktoken使用cl100k_base编码，适用于GPT-4、GPT-3.5-turbo等模型。
   */
  private static initializeEncoding(): void { // 初始化编码器
    if (!this.encoding && !this.useFallback) {
      try {
        // 尝试动态导入tiktoken库
        const tiktoken = require('tiktoken');
        // 使用cl100k_base编码，适用于gpt-4, gpt-3.5-turbo等模型
        this.encoding = tiktoken.get_encoding('cl100k_base');
      } catch (error) {
        // 如果tiktoken不可用，记录警告并切换到降级方案
        console.warn('tiktoken库不可用，使用fallback方案进行token计算:', (error as any).message);
        this.useFallback = true;
      }
    }
  }

  /**
   * 计算文本的Token数
   * 
   * 【计算方法】
   * 1. 优先使用tiktoken进行精确计算
   * 2. 如果tiktoken失败，使用基于字符数的估算：
   *    - 中文字符：1个字符 ≈ 1个Token
   *    - 英文字符：4个字符 ≈ 1个Token
   * 
   * @param text 要计算的文本内容
   * @returns 估算的Token数量
   */
  public static calculateTokenCount(text: string): number { // 计算文本的Token数
    this.initializeEncoding(); // 确保编码器已初始化
    
    // 如果tiktoken可用，使用精确计算
    if (!this.useFallback && this.encoding) {
      try {
        const tokens = this.encoding.encode(text); // 使用tiktoken编码
        return tokens.length; // 返回Token数量
      } catch (error) {
        // 如果计算出错，记录错误并切换到降级方案
        console.error('Error calculating token count with tiktoken:', error);
        this.useFallback = true;
      }
    }
    
    // 降级方案：基于字符数的粗略估算
    // 粗略估计：1个中文字符≈1个token，4个英文字符≈1个token
    const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length; // 统计中文字符数
    const nonChineseText = text.replace(/[\u4e00-\u9fa5]/g, ''); // 移除中文字符
    const englishTokens = Math.ceil(nonChineseText.length / 4); // 估算英文Token数
    return chineseChars + englishTokens; // 返回总Token数
  }

  /**
   * 计算消息数组的Token总数
   * 
   * 【工作原理】
   * 遍历所有消息，累加每条消息内容的Token数。
   * 
   * @param messages 消息数组，每个消息对象需包含content属性
   * @returns 所有消息的Token总数
   */
  public static calculateMessagesTokenCount(messages: Array<{ content: string }>): number { // 计算消息数组的Token总数
    // 使用reduce累加所有消息的Token数
    return messages.reduce((total, msg) => total + this.calculateTokenCount(msg.content), 0);
  }

  /**
   * 估算消息数组的总字符数
   * 
   * 【用途】
   * 快速估算文本大小，无需进行Token计算。
   * 适用于初步判断是否需要压缩的场景。
   * 
   * @param messages 消息数组
   * @returns 所有消息内容的总字符数
   */
  public static estimateTotalChars(messages: Array<{ content: string }>): number { // 估算消息数组的总字符数
    // 累加所有消息内容的长度
    return messages.reduce((total, msg) => total + msg.content.length, 0);
  }

  /**
   * 计算自适应分块比例（Layer 5 主动压缩需要）
   * 
   * 【工作原理】
   * 根据消息的平均大小动态调整分块比例：
   * - 消息越大，使用越小的分块比例
   * - 消息越小，使用较大的分块比例
   * 
   * 【计算公式】
   * 1. 计算平均每条消息的Token数
   * 2. 计算平均消息占上下文窗口的比例
   * 3. 如果比例超过10%，则减小分块比例
   * 
   * @param messages 消息数组
   * @param contextWindow 上下文窗口大小（tokens）
   * @returns 分块比例（范围：0.15-0.4）
   */
  public static computeAdaptiveChunkRatio(
    messages: Array<{ content: string }>, 
    contextWindow: number
  ): number {
    const BASE_CHUNK_RATIO = 0.4; // 基础分块比例
    const MIN_CHUNK_RATIO = 0.15; // 最小分块比例
    const SAFETY_MARGIN = 1.2; // 安全系数
    
    // 如果消息为空或上下文窗口无效，返回基础比例
    if (messages.length === 0 || contextWindow <= 0) {
      return BASE_CHUNK_RATIO;
    }
    
    // 计算总Token数和平均Token数
    const totalTokens = this.calculateMessagesTokenCount(messages);
    const avgTokens = totalTokens / messages.length;
    // 计算平均消息占上下文的比例（含安全系数）
    const avgRatio = (avgTokens * SAFETY_MARGIN) / contextWindow;
    
    // 如果平均消息超过上下文的10%，减小分块比例
    if (avgRatio > 0.1) {
      // 计算减少量，最大不超过基础比例与最小比例的差值
      const reduction = Math.min(avgRatio * 2, BASE_CHUNK_RATIO - MIN_CHUNK_RATIO);
      // 返回调整后的比例，不低于最小比例
      return Math.max(MIN_CHUNK_RATIO, BASE_CHUNK_RATIO - reduction);
    }
    
    // 如果消息较小，使用基础分块比例
    return BASE_CHUNK_RATIO;
  }
}
