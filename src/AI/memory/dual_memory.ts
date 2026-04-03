import { BaseMessage, HumanMessage, AIMessage, SystemMessage } from '../agents/base_agent';

export interface MemoryItem {
  id: string;
  content: string;
  importance: number;
  timestamp: number;
  metadata: Record<string, any>;
  toDict(): Record<string, any>;
}

export class MemoryItemImpl implements MemoryItem {
  constructor(
    public id: string = Math.random().toString(16).substr(2, 8),
    public content: string = "",
    public importance: number = 0.5,
    public timestamp: number = Date.now() / 1000,
    public metadata: Record<string, any> = {}
  ) {}

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

export class ShortTermMemory {
  private windowSize: number;
  private messages: BaseMessage[];
  private summary: string;
  private conversationRounds: number;

  constructor(windowSize: number = 5) {
    this.windowSize = windowSize;
    this.messages = [];
    this.summary = "";
    this.conversationRounds = 0;
  }

  addMessage(message: BaseMessage): void {
    this.messages.push(message);
    if (message.type === 'human') {
      this.conversationRounds++;
    }
  }

  getMessages(): BaseMessage[] {
    if (this.messages.length > this.windowSize * 2) {
      const overflow = this.messages.slice(0, this.messages.length - this.windowSize * 2);
      this.compress(overflow);
    }
    return this.messages;
  }

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
      }
    }

    return contextParts.join('\n');
  }

  clear(): void {
    this.messages = [];
    this.summary = "";
    this.conversationRounds = 0;
  }

  getState(): Record<string, any> {
    return {
      window_size: this.windowSize,
      message_count: this.messages.length,
      conversation_rounds: this.conversationRounds,
      has_summary: Boolean(this.summary)
    };
  }
}

export class LongTermMemory {
  private storagePath: string;
  private collectionName: string;
  private useMock: boolean;
  private mockStore: MemoryItem[];

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

  addMemory(
    content: string,
    importance: number = 0.5,
    metadata?: Record<string, any>
  ): string {
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

  search(
    query: string,
    topK: number = 3,
    minImportance: number = 0.0
  ): MemoryItem[] {
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

  getAllMemories(): MemoryItem[] {
    if (this.useMock) {
      return [...this.mockStore];
    }
    return [];
  }

  count(): number {
    if (this.useMock) {
      return this.mockStore.length;
    }
    return 0;
  }

  clear(): void {
    if (this.useMock) {
      this.mockStore = [];
    }
  }
}

export class DualMemorySystem {
  private agentId: string;
  private shortTerm: ShortTermMemory;
  private longTerm: LongTermMemory;
  private importanceThreshold: number;

  constructor(
    agentId: string,
    shortTermWindow: number = 5,
    longTermStoragePath: string = "./memory_storage"
  ) {
    this.agentId = agentId;
    this.shortTerm = new ShortTermMemory(shortTermWindow);
    this.longTerm = new LongTermMemory(longTermStoragePath);
    this.importanceThreshold = 0.6;
  }

  addMessage(
    message: BaseMessage,
    evaluateImportance: boolean = true
  ): void {
    this.shortTerm.addMessage(message);

    if (evaluateImportance && (message.type === 'human' || message.type === 'ai')) {
      const importance = this.evaluateImportance(message.content);

      if (importance >= this.importanceThreshold) {
        this.longTerm.addMemory(
          message.content,
          importance,
          {
            type: message.type,
            agent_id: this.agentId
          }
        );
      }
    }
  }

  private evaluateImportance(content: string): number {
    const importantKeywords = ["重要", "记住", "关键", "决定", "承诺", "秘密"];

    let score = 0.3;
    for (const keyword of importantKeywords) {
      if (content.includes(keyword)) {
        score += 0.15;
      }
    }

    return Math.min(score, 1.0);
  }

  getContext(
    query?: string,
    includeLongTerm: boolean = true
  ): string {
    const contextParts: string[] = [];

    const shortTermContext = this.shortTerm.getContext();
    if (shortTermContext) {
      contextParts.push(shortTermContext);
    }

    if (includeLongTerm && query) {
      const relevantMemories = this.longTerm.search(query, 3);

      if (relevantMemories.length > 0) {
        const memoriesText = relevantMemories.map(mem => {
          return `- ${mem.content} (重要性：${mem.importance.toFixed(2)})`;
        }).join('\n');
        contextParts.push(`\n[相关长期记忆]\n${memoriesText}`);
      }
    }

    return contextParts.join('\n\n');
  }

  saveImportantEvent(
    eventDescription: string,
    importance: number = 0.8
  ): string {
    return this.longTerm.addMemory(
      eventDescription,
      importance,
      { type: "event" }
    );
  }

  getState(): Record<string, any> {
    return {
      agent_id: this.agentId,
      short_term: this.shortTerm.getState(),
      long_term_count: this.longTerm.count(),
      importance_threshold: this.importanceThreshold
    };
  }

  clear(): void {
    this.shortTerm.clear();
    this.longTerm.clear();
  }
}

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
  // 注意：这里需要导入 PGLongTermMemory，但暂时先使用默认实现
  // const { PGLongTermMemory } = await import('./pg_long_term_memory');
  // system.longTerm = new PGLongTermMemory(agentId, collectionName);
  
  return system;
}
