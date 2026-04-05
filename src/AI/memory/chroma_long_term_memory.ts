/**
 * ChromaLongTermMemory类 - 使用ChromaDB作为长期记忆存储后端
 * 实现了LongTermMemoryInterface接口，提供向量相似度搜索功能
 */

// 导入必要的类型和类
import { LongTermMemoryInterface, MemoryItem, MemoryItemImpl } from './dual_memory';
import { ChromaClient, Collection } from 'chromadb';
import { DefaultEmbeddingFunction } from '@chroma-core/default-embed';

/**
 * ChromaLongTermMemory类 - 使用ChromaDB向量数据库存储长期记忆
 * 支持基于语义的记忆检索
 */
export class ChromaLongTermMemory implements LongTermMemoryInterface {
  // ChromaDB客户端实例
  private client: ChromaClient;
  // 存储集合实例
  private collection: Collection | null = null;
  // 集合名称
  private collectionName: string;
  // 代理ID
  private agentId: string;

  /**
   * 构造函数
   * @param agentId 代理ID，用于区分不同代理的记忆
   * @param collectionName 集合名称，默认为'long_term_memory'
   * @param persistDirectory 持久化目录，默认为'./chroma'
   */
  constructor(agentId: string, collectionName: string = 'long_term_memory', persistDirectory: string = './chroma') {
    // 保存代理ID
    this.agentId = agentId;
    // 生成唯一的集合名称，格式为"集合名_代理ID"
    this.collectionName = `${collectionName}_${agentId}`;
    // 创建ChromaDB客户端实例，使用内存模式（避免路径配置问题）
    this.client = new ChromaClient();
  }

  /**
   * 初始化集合
   */
  private async initializeCollection(): Promise<void> {
    if (!this.collection) {
      try {
        // 尝试获取集合
        this.collection = await this.client.getCollection({ name: this.collectionName });
      } catch (error) {
        // 如果集合不存在，创建新集合
        const embedder = new DefaultEmbeddingFunction();
        this.collection = await this.client.createCollection({ name: this.collectionName, embeddingFunction: embedder });
      }
    }
  }

  /**
   * 添加记忆到ChromaDB
   * @param content 记忆内容
   * @param importance 记忆重要性，默认为0.5
   * @param metadata 记忆元数据，可选
   * @returns 记忆ID
   */
  async addMemory(content: string, importance: number = 0.5, metadata?: Record<string, any>): Promise<string> {
    // 初始化集合
    await this.initializeCollection();
    
    // 创建记忆项实例
    const memory = new MemoryItemImpl(undefined, content, importance, undefined, metadata);
    
    // 向集合添加记忆
    await this.collection!.add({
      ids: [memory.id], // 记忆ID
      documents: [memory.content], // 记忆内容
      metadatas: [{
        importance: memory.importance, // 重要性
        timestamp: memory.timestamp, // 时间戳
        ...(metadata || {}) // 合并额外元数据
      }]
    });
    
    // 返回记忆ID
    return memory.id;
  }

  /**
   * 搜索相关记忆
   * @param query 搜索查询
   * @param topK 返回结果数量，默认为3
   * @param minImportance 最小重要性，默认为0.0
   * @returns 相关记忆数组
   */
  async search(query: string, topK: number = 3, minImportance: number = 0.0): Promise<MemoryItem[]> {
    // 初始化集合
    await this.initializeCollection();
    
    // 使用ChromaDB的查询功能，基于语义相似度搜索
    const results = await this.collection!.query({ queryTexts: [query], nResults: topK });
    
    // 处理搜索结果
    const memories: MemoryItem[] = [];
    for (let i = 0; i < results.documents.length; i++) {
      const docArray = results.documents[i];
      if (docArray) {
        for (let j = 0; j < docArray.length; j++) {
          const content = docArray[j];
          if (content) {
            // 获取元数据
            const metadata = (results.metadatas[i] && results.metadatas[i][j]) || {};
            // 获取ID
            const id = results.ids[i]?.[j] || `id_${Date.now()}_${i}_${j}`;
            // 创建记忆项
            memories.push(new MemoryItemImpl(
              id.toString(),
              content,
              typeof metadata.importance === 'number' ? metadata.importance : 0.5,
              typeof metadata.timestamp === 'number' ? metadata.timestamp : Date.now() / 1000, metadata
            ));
          }
        }
      }
    }
    return memories;
  }

  /**
   * 获取所有记忆
   * @returns 所有记忆数组
   */
  async getAllMemories(): Promise<MemoryItem[]> {
    // 初始化集合
    await this.initializeCollection();
    
    // 获取所有记忆
    const results = await this.collection!.get();
    const memories: MemoryItem[] = [];
    for (let i = 0; i < (results.documents || []).length; i++) {
      const content = results.documents[i];
      if (content) {
        const metadata = results.metadatas[i] || {};
        const id = results.ids[i] || `id_${Date.now()}_${i}`;
        memories.push(new MemoryItemImpl(
          id.toString(),
          content,
          typeof metadata.importance === 'number' ? metadata.importance : 0.5,
          typeof metadata.timestamp === 'number' ? metadata.timestamp : Date.now() / 1000, metadata
        ));
      }
    }
    return memories;
  }

  /**
   * 获取记忆数量
   * @returns 记忆数量
   */
  async count(): Promise<number> {
    // 初始化集合
    await this.initializeCollection();
    
    // 获取所有记忆并返回数量
    const results = await this.collection!.get();
    return (results.ids || []).length;
  }

  /**
   * 清空所有记忆
   */
  async clear(): Promise<void> {
    // 初始化集合
    await this.initializeCollection();
    
    // 删除所有记忆
    await this.collection!.delete({ ids: undefined });
  }
}
