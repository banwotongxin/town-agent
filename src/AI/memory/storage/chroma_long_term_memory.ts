/**
 * ChromaLongTermMemory类 - 使用ChromaDB作为长期记忆存储后端
 * 实现了LongTermMemoryInterface接口，提供向量相似度搜索功能
 */

// 导入必要的类型和类
import { LongTermMemoryInterface, MemoryItem, MemoryItemImpl } from './dual_memory';
import { ChromaClient, Collection } from 'chromadb';
import { QwenEmbedding } from '../modules/embedding';
import { TextChunker } from '../modules/text_chunker';
import { QuestionRewriter } from '../modules/question_rewriter';
import { Reranker } from '../modules/reranker';

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
  // 向量化工具
  private embedder: any;
  // 文本分块工具
  private chunker: TextChunker;
  // 问题改写工具
  private rewriter: QuestionRewriter;
  // 精排工具
  private reranker: Reranker;

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
    // 初始化工具
    this.embedder = new QwenEmbedding();
    this.chunker = new TextChunker();
    this.rewriter = new QuestionRewriter();
    this.reranker = new Reranker();
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
        this.collection = await this.client.createCollection({ name: this.collectionName });
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
    
    // 分块处理
    const chunks = this.chunker.chunk(content);
    
    if (chunks.length === 0) {
      const memory = new MemoryItemImpl(undefined, content, importance, undefined, metadata);
      return memory.id;
    }
    
    // 向量化
    const embeddings = await this.embedder.embed(chunks);
    
    // 准备数据
    const ids = chunks.map((_, index) => `id_${Date.now()}_${index}`);
    const metadatas = chunks.map(() => ({
      importance,
      timestamp: Date.now() / 1000,
      ...(metadata || {})
    }));
    
    // 向集合添加记忆
    await this.collection!.add({
      ids,
      documents: chunks,
      embeddings,
      metadatas
    });
    
    // 返回第一个记忆ID
    return ids[0];
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
    
    // 1. 问题改写
    const rewrittenQueries = await this.rewriter.rewriteQuestion(query);
    
    // 2. 向量化所有查询
    const queryEmbeddings = await this.embedder.embed(rewrittenQueries);
    
    // 3. 检索所有查询的结果
    const allResults: MemoryItem[] = [];
    for (const embedding of queryEmbeddings) {
      // 确保 embedding 是有效的数字数组
      if (!Array.isArray(embedding) || embedding.length === 0 || !embedding.every(n => typeof n === 'number')) {
        console.warn('Invalid embedding format, skipping query');
        continue;
      }
      
      try {
        const results = await this.collection!.query({
          queryEmbeddings: [embedding],
          nResults: topK
        });
      
        // 处理搜索结果
        for (let i = 0; i < results.documents.length; i++) {
          const docArray = results.documents[i];
          if (docArray) {
            for (let j = 0; j < docArray.length; j++) {
              const content = docArray[j];
              if (content) {
                const metadata = (results.metadatas[i] && results.metadatas[i][j]) || {};
                const id = results.ids[i]?.[j] || `id_${Date.now()}_${i}_${j}`;
                const score = results.distances[i]?.[j] || 0;
                
                // 检查重要性阈值
                const importance = typeof metadata.importance === 'number' ? metadata.importance : 0.5;
                if (importance >= minImportance) {
                  allResults.push(new MemoryItemImpl(
                    id.toString(),
                    content,
                    importance,
                    typeof metadata.timestamp === 'number' ? metadata.timestamp : Date.now() / 1000,
                    { ...metadata, score }
                  ));
                }
              }
            }
          }
        }
      } catch (error) {
        console.warn('ChromaDB query failed:', error instanceof Error ? error.message : error);
      }
    }
    
    // 4. 去重
    const uniqueResults = this.deduplicateResults(allResults);
    
    // 5. 精排
    return this.reranker.rerank(query, uniqueResults, topK);
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

  /**
   * 结果去重
   */
  private deduplicateResults(results: MemoryItem[]): MemoryItem[] {
    const seen = new Set<string>();
    return results.filter(item => {
      const key = item.content.trim();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }
}
