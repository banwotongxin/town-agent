// 导入必要的类和接口
import { BaseMessage, ToolResultMessage } from '../agents/base_agent';
import { SessionMemory } from './session_memory';
import { PGLongTermMemory } from './pg_long_term_memory';
import { ChromaLongTermMemory } from './chroma_long_term_memory';
import { TokenUtils } from './token_utils';

/**
 * 记忆项接口，定义了记忆的基本属性和方法
 */
export interface MemoryItem {
  id: string;                    // 记忆ID
  content: string;               // 记忆内容
  importance: number;            // 记忆重要性（0-1）
  timestamp: number;             // 记忆时间戳
  metadata: Record<string, any>;  // 记忆元数据
  toDict(): Record<string, any>;  // 转换为字典的方法
}

/**
 * 长期记忆接口，定义了长期记忆的基本操作
 */
export interface LongTermMemoryInterface {
  addMemory(content: string, importance?: number, metadata?: Record<string, any>): Promise<string>; // 添加记忆
  search(query: string, topK?: number, minImportance?: number): Promise<MemoryItem[]>; // 搜索记忆
  getAllMemories(): Promise<MemoryItem[]>; // 获取所有记忆
  count(): Promise<number>; // 获取记忆数量
  clear(): Promise<void>; // 清空记忆
}

/**
 * 记忆项实现类
 */
export class MemoryItemImpl implements MemoryItem {
  /**
   * 构造函数
   * @param id 记忆ID（默认自动生成）
   * @param content 记忆内容（默认空字符串）
   * @param importance 记忆重要性（默认0.5）
   * @param timestamp 记忆时间戳（默认当前时间）
   * @param metadata 记忆元数据（默认空对象）
   */
  constructor(
    public id: string = Math.random().toString(16).substring(2, 10),
    public content: string = "",
    public importance: number = 0.5,
    public timestamp: number = Date.now() / 1000,
    public metadata: Record<string, any> = {}
  ) {}

  /**
   * 转换为字典
   * @returns 记忆项的字典表示
   */
  toDict(): Record<string, any> {
    return {
      id: this.id,
      content: this.content,
      importance: this.importance,
      timestamp: this.timestamp,
      metadata: this.metadata
    };
  }
}

/**
 * 短期记忆类，存储最近的对话消息
 */
export class ShortTermMemory {
  private windowSize: number; // 窗口大小
  private messages: BaseMessage[]; // 消息列表
  private summary: string; // 对话摘要
  private conversationRounds: number; // 对话轮数
  private toolResultsLRU: Map<string, { message: BaseMessage, timestamp: number }>; // 工具结果LRU缓存
  private maxToolResults: number = 5; // 最大工具结果数量

  /**
   * 构造函数
   * @param windowSize 窗口大小（默认5）
   */
  constructor(windowSize: number = 5) {
    this.windowSize = windowSize;
    this.messages = [];
    this.summary = "";
    this.conversationRounds = 0;
    this.toolResultsLRU = new Map<string, { message: BaseMessage, timestamp: number }>();
  }

  /**
   * 添加消息
   * @param message 消息对象
   */
  addMessage(message: BaseMessage): void {
    this.messages.push(message);
    if (message.type === 'human') {
      this.conversationRounds++;
    } else if (message.type === 'tool_result') {
      this.updateToolResultsLRU(message);
      this.performLocalCleanup();
    }
  }

  /**
   * 更新工具结果LRU缓存
   * @param message 工具结果消息
   */
  private updateToolResultsLRU(message: BaseMessage): void {
    const toolName = message.metadata?.tool_name || 'unknown';
    const timestamp = Date.now();
    const key = `${toolName}_${timestamp}`;

    // 检查键是否已存在（时间戳相同的边缘情况）
    if (this.toolResultsLRU.has(key)) {
      this.toolResultsLRU.delete(key);
    }

    // 添加到LRU缓存
    this.toolResultsLRU.set(key, { message, timestamp });

    // 如果超过最大大小，删除最旧的条目
    if (this.toolResultsLRU.size > this.maxToolResults) {
      // 查找并删除最旧的条目
      let oldestKey: string | null = null;
      let oldestTimestamp = Infinity;

      const entries = Array.from(this.toolResultsLRU.entries());
      for (const [k, v] of entries) {
        if (v.timestamp < oldestTimestamp) {
          oldestTimestamp = v.timestamp;
          oldestKey = k;
        }
      }

      if (oldestKey) {
        this.toolResultsLRU.delete(oldestKey);
      }
    }
  }

  /**
   * 执行本地清理
   */
  private performLocalCleanup(): void {
    // 从Map中获取值，避免Set引用比较问题
    const toolResultsToKeep = Array.from(this.toolResultsLRU.values()).map(entry => entry.message);

    // 过滤消息，将旧的工具结果替换为占位符
    this.messages = this.messages.map(msg => {
      if (msg.type === 'tool_result') {
        const shouldKeep = toolResultsToKeep.some(kept => kept === msg);
        if (!shouldKeep) {
          // 替换为占位符
          return new ToolResultMessage('[Old tool result content cleared]', msg.metadata);
        }
      }
      return msg;
    });
  }

  /**
   * 获取消息列表
   * @returns 消息列表
   */
  getMessages(): BaseMessage[] {
    const totalTokens = this.calculateTokenCount(this.messages);
    const maxTokens = this.windowSize * 1000; // 估计：每个窗口单位1000个token

    if (totalTokens > maxTokens * 1.5) {
      const overflow = this.messages.slice(0, this.messages.length - this.windowSize);
      this.compress(overflow);
    }
    return this.messages;
  }

  /**
   * 计算token数量
   * @param messages 消息列表
   * @returns token数量
   */
  private calculateTokenCount(messages: BaseMessage[]): number {
    return TokenUtils.calculateMessagesTokenCount(messages);
  }

  /**
   * 压缩消息
   * @param messagesToCompress 要压缩的消息
   */
  private compress(messagesToCompress: BaseMessage[]): void {
    const compressedText = messagesToCompress.map(msg => {
      return `${msg.type}: ${msg.content}`;
    }).join('\n');

    if (this.summary) {
      this.summary += `\n[旧对话]\n${compressedText}`;
    } else {
      this.summary = `[历史对话摘要]\n${compressedText}`;
    }

    this.messages = this.messages.slice(messagesToCompress.length);
  }

  /**
   * 获取上下文
   * @returns 上下文字符串
   */
  getContext(): string {
    const contextParts: string[] = [];

    if (this.summary) {
      contextParts.push(this.summary);
    }

    for (const msg of this.messages) {
      if (msg.type === 'human') {
        contextParts.push(`用户：${msg.content}`);
      } else if (msg.type === 'ai') {
        contextParts.push(`助手：${msg.content}`);
      } else if (msg.type === 'system') {
        contextParts.push(`系统：${msg.content}`);
      } else if (msg.type === 'tool') {
        contextParts.push(`工具：${msg.content}`);
      } else if (msg.type === 'tool_result') {
        contextParts.push(`工具结果：${msg.content}`);
      }
    }

    return contextParts.join('\n');
  }

  /**
   * 清空短期记忆
   */
  clear(): void {
    this.messages = [];
    this.summary = "";
    this.conversationRounds = 0;
    this.toolResultsLRU.clear();
  }

  /**
   * 获取短期记忆状态
   * @returns 状态对象
   */
  getState(): Record<string, any> {
    return {
      window_size: this.windowSize,
      message_count: this.messages.length,
      conversation_rounds: this.conversationRounds,
      has_summary: Boolean(this.summary),
      tool_results_count: this.toolResultsLRU.size
    };
  }
}

/**
 * 长期记忆类，实现了LongTermMemoryInterface接口
 */
export class LongTermMemory implements LongTermMemoryInterface {
  private storagePath: string; // 存储路径
  private collectionName: string; // 集合名称
  private useMock: boolean; // 是否使用模拟存储
  private mockStore: MemoryItem[]; // 模拟存储

  /**
   * 构造函数
   * @param storagePath 存储路径（默认"./memory_storage"）
   * @param collectionName 集合名称（默认"long_term_memory"）
   * @param useMock 是否使用模拟存储（默认true）
   */
  constructor(
    storagePath: string = "./memory_storage",
    collectionName: string = "long_term_memory",
    useMock: boolean = true
  ) {
    this.storagePath = storagePath;
    this.collectionName = collectionName;
    this.useMock = useMock;
    this.mockStore = [];
  }

  /**
   * 添加记忆
   * @param content 记忆内容
   * @param importance 记忆重要性（默认0.5）
   * @param metadata 记忆元数据（可选）
   * @returns 记忆ID
   */
  async addMemory(
    content: string,
    importance: number = 0.5,
    metadata?: Record<string, any>
  ): Promise<string> {
    const memory = new MemoryItemImpl(
      undefined,
      content,
      importance,
      undefined,
      metadata || {}
    );

    if (this.useMock) {
      this.mockStore.push(memory);
    } else {
      // TODO: 真实实现：存入向量数据库
    }

    return memory.id;
  }

  /**
   * 搜索记忆
   * @param query 搜索查询
   * @param topK 返回结果数量（默认3）
   * @param minImportance 最小重要性（默认0.0）
   * @returns 相关记忆数组
   */
  async search(
    query: string,
    topK: number = 3,
    minImportance: number = 0.0
  ): Promise<MemoryItem[]> {
    if (this.useMock) {
      const results: MemoryItem[] = [];
      for (const memory of this.mockStore) {
        if (memory.importance >= minImportance) {
          if (memory.content.toLowerCase().includes(query.toLowerCase())) {
            results.push(memory);
          }
        }
      }

      results.sort((a, b) => b.importance - a.importance);
      return results.slice(0, topK);
    } else {
      // TODO: 真实实现：使用向量数据库语义检索
      return [];
    }
  }

  /**
   * 获取所有记忆
   * @returns 所有记忆数组
   */
  async getAllMemories(): Promise<MemoryItem[]> {
    if (this.useMock) {
      return [...this.mockStore];
    }
    return [];
  }

  /**
   * 获取记忆数量
   * @returns 记忆数量
   */
  async count(): Promise<number> {
    if (this.useMock) {
      return this.mockStore.length;
    }
    return 0;
  }

  /**
   * 清空记忆
   */
  async clear(): Promise<void> {
    if (this.useMock) {
      this.mockStore = [];
    }
  }
}

/**
 * 双记忆系统类，结合短期记忆和长期记忆
 */
export class DualMemorySystem {
  private agentId: string; // 智能体ID
  private shortTerm: ShortTermMemory; // 短期记忆
  private longTerm: LongTermMemoryInterface; // 长期记忆
  private sessionMemory: SessionMemory; // 会话记忆
  private importanceThreshold: number; // 重要性阈值

  /**
   * 构造函数
   * @param agentId 智能体ID
   * @param shortTermWindow 短期记忆窗口大小（默认5）
   * @param longTermStoragePath 长期记忆存储路径（默认"./chroma"）
   */
  constructor(
    agentId: string,
    shortTermWindow: number = 5,
    longTermStoragePath: string = "./chroma"
  ) {
    this.agentId = agentId;
    this.shortTerm = new ShortTermMemory(shortTermWindow);
    // 使用ChromaDB作为长期记忆存储
    this.longTerm = new ChromaLongTermMemory(agentId, "long_term_memory", longTermStoragePath);
    this.sessionMemory = new SessionMemory(agentId, longTermStoragePath);
    this.importanceThreshold = 0.6;
  }

  /**
   * 设置长期记忆
   * @param longTerm 长期记忆实例
   */
  setLongTermMemory(longTerm: LongTermMemoryInterface): void {
    this.longTerm = longTerm;
  }

  /**
   * 添加消息
   * @param message 消息对象
   * @param evaluateImportance 是否评估重要性（默认true）
   */
  async addMessage(
    message: BaseMessage,
    evaluateImportance: boolean = true
  ): Promise<void> {
    this.shortTerm.addMessage(message);

    if (evaluateImportance && (message.type === 'human' || message.type === 'ai')) {
      const importance = this.evaluateImportance(message.content);

      if (importance >= this.importanceThreshold) {
        await this.longTerm.addMemory(
          message.content,
          importance,
          {
            type: message.type,
            agent_id: this.agentId
          }
        );
      }
    }

    // 检查是否需要提取会话记忆
    const messages = this.shortTerm.getMessages();
    const tokenCount = this.calculateTokenCount(messages);
    if (this.sessionMemory.shouldExtractMemory(messages, tokenCount)) {
      // 等待提取记忆以确保数据一致性
      await this.sessionMemory.extractMemory(messages);
    }
  }

  /**
   * 评估重要性
   * @param content 内容
   * @returns 重要性分数（0-1）
   */
  private evaluateImportance(content: string): number {
    // 支持中英文关键词
    const importantKeywords = [
      // 中文
      "重要", "记住", "关键", "决定", "承诺", "秘密", "必须", "一定要",
      // 英文
      "important", "remember", "key", "critical", "decision", "promise", "secret", "must"
    ];

    const contentLower = content.toLowerCase();
    let score = 0.3; // 基础分数

    for (const keyword of importantKeywords) {
      if (contentLower.includes(keyword.toLowerCase())) {
        score += 0.15;
      }
    }

    // 额外评分因素
    const hasNumbers = /\d+/.test(content);
    const hasUrls = /https?:\/\/|www\./.test(content);
    const hasCode = /```|function |class |const |let |var /.test(content);

    if (hasNumbers) score += 0.05;
    if (hasUrls) score += 0.1;
    if (hasCode) score += 0.15;

    // 内容长度因素（较长的消息往往更重要）
    if (content.length > 200) score += 0.05;
    if (content.length > 500) score += 0.1;

    return Math.min(score, 1.0);
  }

  /**
   * 计算token数量
   * @param messages 消息列表
   * @returns token数量
   */
  private calculateTokenCount(messages: BaseMessage[]): number {
    return TokenUtils.calculateMessagesTokenCount(messages);
  }

  /**
   * 获取上下文
   * @param query 查询（可选）
   * @param includeLongTerm 是否包含长期记忆（默认true）
   * @returns 上下文字符串
   */
  async getContext(
    query?: string,
    includeLongTerm: boolean = true
  ): Promise<string> {
    const contextParts: string[] = [];

    const shortTermContext = this.shortTerm.getContext();
    if (shortTermContext) {
      contextParts.push(shortTermContext);
    }

    if (includeLongTerm && query) {
      const relevantMemories = await this.longTerm.search(query, 3);

      if (relevantMemories.length > 0) {
        const memoriesText = relevantMemories.map(mem => {
          return `- ${mem.content} (重要性：${mem.importance.toFixed(2)})`;
        }).join('\n');
        contextParts.push(`\n[相关长期记忆]\n${memoriesText}`);
      }
    }

    return contextParts.join('\n\n');
  }

  /**
   * 保存重要事件
   * @param eventDescription 事件描述
   * @param importance 重要性（默认0.8）
   * @returns 记忆ID
   */
  async saveImportantEvent(
    eventDescription: string,
    importance: number = 0.8
  ): Promise<string> {
    return await this.longTerm.addMemory(
      eventDescription,
      importance,
      { type: "event" }
    );
  }

  /**
   * 压缩会话记忆
   */
  async compactSessionMemory(): Promise<void> {
    const messages = this.shortTerm.getMessages();
    const compactedMessages = this.sessionMemory.compactSessionMemory(messages);

    // 清空短期记忆
    this.shortTerm.clear();

    // 添加压缩后的消息，确保它们是有效的BaseMessage对象
    for (const msg of compactedMessages) {
      if (msg && typeof msg === 'object' && 'type' in msg && 'content' in msg) {
        this.shortTerm.addMessage(msg);
      }
    }
  }

  /**
   * 获取系统状态
   * @returns 状态对象
   */
  async getState(): Promise<Record<string, any>> {
    return {
      agent_id: this.agentId,
      short_term: this.shortTerm.getState(),
      long_term_count: await this.longTerm.count(),
      importance_threshold: this.importanceThreshold
    };
  }

  /**
   * 清空所有记忆
   */
  async clear(): Promise<void> {
    this.shortTerm.clear();
    await this.longTerm.clear();
    this.sessionMemory.clear();
  }
}

/**
 * 创建记忆系统
 * @param agentId 智能体ID
 * @param windowSize 窗口大小（默认5）
 * @param kwargs 额外参数
 * @returns 双记忆系统实例
 */
export function createMemorySystem(
  agentId: string,
  windowSize: number = 5,
  kwargs: Record<string, any> = {}
): DualMemorySystem {
  return new DualMemorySystem(
    agentId,
    windowSize,
    kwargs.longTermStoragePath
  );
}

/**
 * 创建PostgreSQL记忆系统
 * @param agentId 智能体ID
 * @param windowSize 窗口大小（默认5）
 * @param collectionName 集合名称（默认"default"）
 * @returns 双记忆系统实例
 */
export async function createPgMemorySystem(
  agentId: string,
  windowSize: number = 5,
  collectionName: string = "default"
): Promise<DualMemorySystem> {
  const system = new DualMemorySystem(
    agentId,
    windowSize
  );
  
  // 替换长期记忆后端为 PostgreSQL
  const pgMemory = new PGLongTermMemory(agentId, collectionName);
  await pgMemory.initialize();
  system.setLongTermMemory(pgMemory);
  
  return system;
}

/**
 * 创建ChromaDB记忆系统
 * @param agentId 智能体ID
 * @param windowSize 窗口大小（默认5）
 * @param collectionName 集合名称（默认"long_term_memory"）
 * @returns 双记忆系统实例
 */
export function createChromaMemorySystem(
  agentId: string,
  windowSize: number = 5,
  collectionName: string = "long_term_memory"
): DualMemorySystem {
  const system = new DualMemorySystem(
    agentId,
    windowSize
  );
  
  // 替换长期记忆后端为 ChromaDB
  const chromaMemory = new ChromaLongTermMemory(agentId, collectionName);
  system.setLongTermMemory(chromaMemory);
  
  return system;
}
