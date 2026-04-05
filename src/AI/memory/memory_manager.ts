import { BaseMessage } from '../agents/base_agent';
import { DualMemorySystem, createChromaMemorySystem } from './dual_memory';
import { ConversationCompressor } from './conversation_compressor';
import { TokenUtils } from './token_utils';

/**
 * 内存管理器类
 * 负责管理多个智能体的内存系统，提供对话压缩、上下文获取等功能
 */
export class MemoryManager {
  // 存储各个智能体的内存系统
  private memorySystems: Record<string, DualMemorySystem>;
  // 对话压缩器
  private compressor: ConversationCompressor;

  /**
   * 构造函数
   * @param llmModel 可选的大语言模型实例，用于智能压缩
   */
  constructor(llmModel?: any) {
    this.memorySystems = {};
    this.compressor = new ConversationCompressor(llmModel);
  }

  /**
   * 获取智能体的内存系统
   * 如果不存在则创建一个新的
   * @param agentId 智能体ID
   * @returns 智能体的双内存系统
   */
  getMemorySystem(agentId: string): DualMemorySystem {
    if (!this.memorySystems[agentId]) {
      this.memorySystems[agentId] = createChromaMemorySystem(agentId);
    }
    return this.memorySystems[agentId];
  }

  /**
   * 向智能体的内存系统添加消息
   * @param agentId 智能体ID
   * @param message 消息对象
   * @param evaluateImportance 是否评估消息重要性，默认true
   */
  async addMessage(
    agentId: string,
    message: BaseMessage,
    evaluateImportance: boolean = true
  ): Promise<void> {
    const memorySystem = this.getMemorySystem(agentId);
    await memorySystem.addMessage(message, evaluateImportance);
    
    // 检查是否需要压缩
    await this.checkAndCompress(agentId);
  }

  /**
   * 获取智能体的上下文
   * @param agentId 智能体ID
   * @param query 查询字符串（可选）
   * @param includeLongTerm 是否包含长期记忆，默认true
   * @returns 上下文字符串
   */
  async getContext(
    agentId: string,
    query?: string,
    includeLongTerm: boolean = true
  ): Promise<string> {
    const memorySystem = this.getMemorySystem(agentId);
    const context = await memorySystem.getContext(query, includeLongTerm);
    return context;
  }

  /**
   * 检查并执行内存压缩
   * @param agentId 智能体ID
   */
  private async checkAndCompress(agentId: string): Promise<void> {
    const memorySystem = this.getMemorySystem(agentId);
    const shortTermMemory = (memorySystem as any).shortTerm;
    const messages = shortTermMemory.getMessages();
    
    // 计算token数
    const tokenCount = this.calculateTokenCount(messages);
    
    // 检查是否需要压缩
    if (tokenCount > 15000) { // 超过15K tokens时触发压缩
      await this.performCompression(agentId, messages, tokenCount);
    }
  }

  /**
   * 执行压缩操作
   * @param agentId 智能体ID
   * @param messages 消息数组
   * @param tokenCount 当前token数
   */
  private async performCompression(agentId: string, messages: BaseMessage[], tokenCount: number): Promise<void> {
    const memorySystem = this.getMemorySystem(agentId);
    
    try {
      // 第一层：局部清理（已在ShortTermMemory中实现）
      console.log('执行第一层压缩：局部清理');
      
      // 第二层：会话内存压缩
      console.log('执行第二层压缩：会话内存压缩');
      await memorySystem.compactSessionMemory();
      
      // 检查压缩后是否还需要进一步压缩
      const compactedMessages = (memorySystem as any).shortTerm.getMessages();
      const compactedTokenCount = this.calculateTokenCount(compactedMessages);
      
      if (compactedTokenCount > 10000) { // 超过10K tokens时触发第三层压缩
        // 第三层：大模型摘要压缩
        console.log('执行第三层压缩：大模型摘要压缩');
        await this.compressWithLLM(agentId);
      }
    } catch (error) {
      console.error('压缩失败:', error);
    }
  }

  /**
   * 使用大语言模型压缩对话
   * @param agentId 智能体ID
   */
  private async compressWithLLM(agentId: string): Promise<void> {
    const memorySystem = this.getMemorySystem(agentId);
    const shortTermMemory = (memorySystem as any).shortTerm;
    const messages = shortTermMemory.getMessages();
    
    // 使用大模型生成摘要
    const summary = await this.compressor.compressWithLLM(messages);
    
    // 创建压缩边界消息
    const boundaryMessage: BaseMessage = {
      type: 'compact_boundary',
      content: '',
      metadata: {
        compactType: 'llm_summary',
        preCompactTokenCount: this.calculateTokenCount(messages),
        lastUserMessageUuid: this.getLastUserMessageId(messages)
      }
    };
    
    // 创建摘要消息
    const summaryMessage: BaseMessage = {
      type: 'system',
      content: `[LLM 对话摘要]\n${summary}`,
      metadata: {
        type: 'llm_summary'
      }
    };
    
    // 清空短期记忆并添加压缩后的消息
    shortTermMemory.clear();
    shortTermMemory.addMessage(boundaryMessage);
    shortTermMemory.addMessage(summaryMessage);
    
    // 保留最近的几条消息
    const recentMessages = messages.slice(-5); // 保留最近的5条消息
    for (const msg of recentMessages) {
      shortTermMemory.addMessage(msg);
    }
  }

  /**
   * 计算消息数组的token数
   * @param messages 消息数组
   * @returns token数
   */
  private calculateTokenCount(messages: BaseMessage[]): number {
    return TokenUtils.calculateMessagesTokenCount(messages);
  }

  /**
   * 获取最后一条用户消息的ID
   * @param messages 消息数组
   * @returns 最后一条用户消息的ID
   */
  private getLastUserMessageId(messages: BaseMessage[]): string {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].type === 'human') {
        return messages[i].metadata?.id || `msg_${Date.now()}_${Math.random().toString(16).substr(2, 8)}`;
      }
    }
    return '';
  }

  /**
   * 压缩对话
   * @param agentId 智能体ID
   * @param messages 消息数组
   * @param existingSummary 现有摘要（可选）
   * @returns 压缩后的对话
   */
  compressConversation(
    agentId: string,
    messages: BaseMessage[],
    existingSummary?: string
  ): string {
    return this.compressor.compress(messages, existingSummary);
  }

  /**
   * 使用大语言模型压缩对话
   * @param agentId 智能体ID
   * @param messages 消息数组
   * @param existingSummary 现有摘要（可选）
   * @returns 压缩后的对话
   */
  async compressConversationWithLLM(
    agentId: string,
    messages: BaseMessage[],
    existingSummary?: string
  ): Promise<string> {
    return this.compressor.compressWithLLM(messages, existingSummary);
  }

  /**
   * 从长期记忆中召回相关记忆
   * @param agentId 智能体ID
   * @param query 查询字符串
   * @param nResults 返回结果数量，默认5
   * @returns 相关记忆数组
   */
  async recall(
    agentId: string,
    query: string,
    nResults: number = 5
  ): Promise<Array<Record<string, any>>> {
    const memorySystem = this.getMemorySystem(agentId);
    const memories = await (memorySystem as any).longTerm.search(query, nResults);

    return memories.map((mem: any) => ({
      content: mem.content,
      importance: mem.importance,
      metadata: mem.metadata
    }));
  }

  /**
   * 保存重要事件到长期记忆
   * @param agentId 智能体ID
   * @param eventDescription 事件描述
   * @param importance 重要性，默认0.8
   * @returns 记忆ID
   */
  async saveImportantEvent(
    agentId: string,
    eventDescription: string,
    importance: number = 0.8
  ): Promise<string> {
    const memorySystem = this.getMemorySystem(agentId);
    return await memorySystem.saveImportantEvent(eventDescription, importance);
  }

  /**
   * 获取智能体的内存状态
   * @param agentId 智能体ID
   * @returns 内存状态对象
   */
  async getMemoryState(agentId: string): Promise<Record<string, any>> {
    const memorySystem = this.getMemorySystem(agentId);
    return await memorySystem.getState();
  }

  /**
   * 清空智能体的内存
   * @param agentId 智能体ID
   */
  async clearMemory(agentId: string): Promise<void> {
    const memorySystem = this.getMemorySystem(agentId);
    await memorySystem.clear();
  }

  /**
   * 获取所有智能体的ID
   * @returns 智能体ID数组
   */
  getAllAgents(): string[] {
    return Object.keys(this.memorySystems);
  }
}
