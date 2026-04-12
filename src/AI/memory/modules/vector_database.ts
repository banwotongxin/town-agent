import { ChromaClient, Collection } from 'chromadb'; // 导入ChromaDB客户端和集合类型
import { MemoryItem, MemoryItemImpl } from '../storage/dual_memory'; // 导入记忆项接口和实现类

// 向量数据库接口，定义了向量数据库的基本操作
export interface VectorDatabase {
  add(embeddings: number[][], documents: string[], metadatas: any[]): Promise<void>; // 添加向量和文档
  query(queryEmbedding: number[], topK: number): Promise<MemoryItem[]>; // 查询相似向量
  delete(ids: string[]): Promise<void>; // 删除指定ID的向量
  count(): Promise<number>; // 获取向量总数
}

// Chroma向量数据库类，实现了VectorDatabase接口
export class ChromaVectorDatabase implements VectorDatabase {
  private client: ChromaClient; // ChromaDB客户端实例
  private collection: Collection | null = null; // 集合实例，初始为空
  private collectionName: string; // 集合名称

  // 构造函数，初始化ChromaDB客户端和集合名称
  constructor(collectionName: string, agentId: string) {
    this.client = new ChromaClient(); // 创建ChromaDB客户端
    this.collectionName = `${collectionName}_${agentId}`; // 组合集合名称和代理ID
  }

  // 私有方法：初始化集合，如果不存在则创建
  private async initializeCollection(): Promise<void> {
    if (!this.collection) {
      try {
        // 尝试获取已存在的集合
        this.collection = await this.client.getCollection({ name: this.collectionName });
      } catch (error) {
        // 如果集合不存在，则创建一个新的集合
        this.collection = await this.client.createCollection({ name: this.collectionName });
      }
    }
  }

  // 异步方法：添加向量和文档到数据库
  async add(embeddings: number[][], documents: string[], metadatas: any[]): Promise<void> {
    await this.initializeCollection(); // 确保集合已初始化

    // 为每个文档生成唯一ID（使用时间戳和索引）
    const ids = documents.map((_, index) => `id_${Date.now()}_${index}`);

    // 调用ChromaDB的add方法添加数据
    await this.collection!.add({
      ids, // 文档ID数组
      documents, // 文档内容数组
      embeddings, // 向量数组
      metadatas // 元数据数组
    });
  }

  // 异步方法：查询与给定向量最相似的文档
  async query(queryEmbedding: number[], topK: number): Promise<MemoryItem[]> {
    await this.initializeCollection(); // 确保集合已初始化

    // 调用ChromaDB的query方法进行相似度搜索
    const results = await this.collection!.query({
      queryEmbeddings: [queryEmbedding], // 查询向量（包装为数组）
      nResults: topK // 返回结果数量
    });

    const memories: MemoryItem[] = []; // 存储查询结果的记忆项数组
    
    // 遍历查询结果
    for (let i = 0; i < results.documents.length; i++) {
      const docArray = results.documents[i]; // 获取第i个查询结果的文档数组
      if (docArray) {
        // 遍历每个文档
        for (let j = 0; j < docArray.length; j++) {
          const content = docArray[j]; // 获取文档内容
          if (content) {
            // 获取元数据，如果不存在则使用空对象
            const metadata = (results.metadatas[i] && results.metadatas[i][j]) || {};
            // 获取文档ID，如果不存在则生成默认ID
            const id = results.ids[i]?.[j] || `id_${Date.now()}_${i}_${j}`;
            // 获取距离分数，如果不存在则默认为0
            const score = results.distances[i]?.[j] || 0;

            // 创建记忆项并添加到结果数组
            memories.push(new MemoryItemImpl(
              id.toString(), // 记忆ID
              content, // 记忆内容
              typeof metadata.importance === 'number' ? metadata.importance : 0.5, // 重要性，默认为0.5
              typeof metadata.timestamp === 'number' ? metadata.timestamp : Date.now() / 1000, // 时间戳，默认为当前时间
              { ...metadata, score } // 合并元数据和分数
            ));
          }
        }
      }
    }

    return memories; // 返回记忆项数组
  }

  // 异步方法：删除指定ID的向量
  async delete(ids: string[]): Promise<void> {
    await this.initializeCollection(); // 确保集合已初始化
    await this.collection!.delete({ ids }); // 调用ChromaDB的delete方法
  }

  // 异步方法：获取向量总数
  async count(): Promise<number> {
    await this.initializeCollection(); // 确保集合已初始化
    const results = await this.collection!.get(); // 获取所有数据
    return (results.ids || []).length; // 返回ID数组的长度
  }
}
