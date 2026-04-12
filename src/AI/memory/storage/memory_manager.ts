// 导入必要的模块和类
import { MemoryItem } from './dual_memory'; // 记忆项接口
import { QwenEmbedding } from '../modules/embedding'; // Qwen嵌入工具
import { TextChunker } from '../modules/text_chunker'; // 文本分块器
import { QuestionRewriter } from '../modules/question_rewriter'; // 问题重写器
import { ChromaVectorDatabase } from '../modules/vector_database'; // Chroma向量数据库
import { ChatCompressor } from '../modules/chat_compressor'; // 聊天压缩器
import { Reranker } from '../modules/reranker'; // 重排序器

// 记忆管理器类，负责管理智能体的所有记忆操作
export class MemoryManager {
  private vectorDB: ChromaVectorDatabase; // 向量数据库实例
  private chunker: TextChunker; // 文本分块器实例
  private embedder: any; // 嵌入工具实例
  private reranker: Reranker; // 重排序器实例
  private compressor: ChatCompressor; // 聊天压缩器实例
  private rewriter: QuestionRewriter; // 问题重写器实例

  // 构造函数，初始化所有组件
  constructor(agentId: string) {
    this.vectorDB = new ChromaVectorDatabase('memory', agentId); // 创建向量数据库，使用'memory'集合作前缀
    this.chunker = new TextChunker(); // 创建文本分块器
    this.embedder = new QwenEmbedding(); // 创建Qwen嵌入工具
    this.reranker = new Reranker(); // 创建重排序器
    this.compressor = new ChatCompressor(); // 创建聊天压缩器
    this.rewriter = new QuestionRewriter(); // 创建问题重写器
  }

  // 添加角色专业知识到向量数据库
  async addRoleKnowledge(roleId: string, knowledge: string, knowledgeType: string): Promise<void> {
    // 将知识文本分块，便于向量化和检索
    const chunks = this.chunker.chunk(knowledge);
    
    // 如果分块结果为空，则直接返回
    if (chunks.length === 0) {
      return;
    }

    // 对所有文本块进行向量化处理
    const embeddings = await this.embedder.embed(chunks);

    // 准备元数据，包含角色信息和知识类型
    const metadatas = chunks.map(() => ({
      role_id: roleId, // 角色ID
      knowledge_type: knowledgeType, // 知识类型
      source: 'role_knowledge', // 数据来源标记
      timestamp: Date.now() / 1000, // 时间戳（秒）
      importance: 0.8 // 角色知识重要性较高，设为0.8
    }));

    // 将向量化后的数据存储到向量数据库中
    await this.vectorDB.add(embeddings, chunks, metadatas);
  }

  // 添加聊天历史到向量数据库
  async addChatHistory(agentId: string, sessionId: string, chatHistory: string): Promise<void> {
    // 首先压缩聊天历史，减少存储空间
    const compressed = this.compressor.compress(chatHistory);

    // 将压缩后的文本分块
    const chunks = this.chunker.chunk(compressed);
    
    // 如果分块结果为空，则直接返回
    if (chunks.length === 0) {
      return;
    }

    // 对分块进行向量化处理
    const embeddings = await this.embedder.embed(chunks);

    // 准备元数据，包含会话信息和压缩信息
    const metadatas = chunks.map(() => ({
      agent_id: agentId, // 智能体ID
      session_id: sessionId, // 会话ID
      compressed: true, // 标记为已压缩
      original_length: chatHistory.length, // 原始长度
      compressed_length: compressed.length, // 压缩后长度
      timestamp: Date.now() / 1000, // 时间戳（秒）
      importance: 0.5 // 聊天历史重要性中等，设为0.5
    }));

    // 将向量化后的数据存储到向量数据库中
    await this.vectorDB.add(embeddings, chunks, metadatas);
  }

  // 检索与查询相关的记忆
  async retrieveRelevantMemories(query: string, topK: number = 5): Promise<MemoryItem[]> {
    // 第一步：问题改写，生成多个角度的查询
    const rewrittenQueries = await this.rewriter.rewriteQuestion(query);
    
    // 第二步：对所有改写后的查询进行向量化
    const queryEmbeddings = await this.embedder.embed(rewrittenQueries);
    
    // 第三步：检索所有查询的结果
    const allResults: MemoryItem[] = [];
    for (const embedding of queryEmbeddings) {
      // 对每个查询向量进行相似度搜索
      const results = await this.vectorDB.query(embedding, topK);
      allResults.push(...results); // 将结果添加到总结果数组中
    }
    
    // 第四步：去除重复的结果
    const uniqueResults = this.deduplicateResults(allResults);
    
    // 第五步：对结果进行重新排序，提高相关性
    return this.reranker.rerank(query, uniqueResults, topK);
  }

  // 私有方法：去除重复的记忆结果
  private deduplicateResults(results: MemoryItem[]): MemoryItem[] {
    const seen = new Set<string>(); // 用于记录已见过的内容
    return results.filter(item => {
      const key = item.content.trim(); // 使用修剪后的内容作为去重键
      if (seen.has(key)) {
        return false; // 如果已经见过，则过滤掉
      }
      seen.add(key); // 标记为已见
      return true; // 保留未重复的项
    });
  }

  // 获取记忆中存储的总数量
  async count(): Promise<number> {
    return await this.vectorDB.count(); // 调用向量数据库的计数方法
  }
}
