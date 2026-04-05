import { MemoryItem } from './dual_memory';
import { QwenEmbedding } from './modules/embedding';
import { TextChunker } from './modules/text_chunker';
import { QuestionRewriter } from './modules/question_rewriter';
import { ChromaVectorDatabase } from './modules/vector_database';
import { ChatCompressor } from './modules/chat_compressor';
import { Reranker } from './modules/reranker';

export class MemoryManager {
  private vectorDB: ChromaVectorDatabase;
  private chunker: TextChunker;
  private embedder: any;
  private reranker: Reranker;
  private compressor: ChatCompressor;
  private rewriter: QuestionRewriter;

  constructor(agentId: string) {
    this.vectorDB = new ChromaVectorDatabase('memory', agentId);
    this.chunker = new TextChunker();
    this.embedder = new QwenEmbedding();
    this.reranker = new Reranker();
    this.compressor = new ChatCompressor();
    this.rewriter = new QuestionRewriter();
  }

  // 添加角色专业知识
  async addRoleKnowledge(roleId: string, knowledge: string, knowledgeType: string): Promise<void> {
    // 分块
    const chunks = this.chunker.chunk(knowledge);
    
    if (chunks.length === 0) {
      return;
    }

    // 向量化
    const embeddings = await this.embedder.embed(chunks);

    // 准备元数据
    const metadatas = chunks.map(() => ({
      role_id: roleId,
      knowledge_type: knowledgeType,
      source: 'role_knowledge',
      timestamp: Date.now() / 1000,
      importance: 0.8 // 角色知识重要性较高
    }));

    // 存储
    await this.vectorDB.add(embeddings, chunks, metadatas);
  }

  // 添加聊天历史
  async addChatHistory(agentId: string, sessionId: string, chatHistory: string): Promise<void> {
    // 压缩
    const compressed = this.compressor.compress(chatHistory);

    // 分块
    const chunks = this.chunker.chunk(compressed);
    
    if (chunks.length === 0) {
      return;
    }

    // 向量化
    const embeddings = await this.embedder.embed(chunks);

    // 准备元数据
    const metadatas = chunks.map(() => ({
      agent_id: agentId,
      session_id: sessionId,
      compressed: true,
      original_length: chatHistory.length,
      compressed_length: compressed.length,
      timestamp: Date.now() / 1000,
      importance: 0.5 // 聊天历史重要性中等
    }));

    // 存储
    await this.vectorDB.add(embeddings, chunks, metadatas);
  }

  // 检索相关记忆
  async retrieveRelevantMemories(query: string, topK: number = 5): Promise<MemoryItem[]> {
    // 1. 问题改写
    const rewrittenQueries = await this.rewriter.rewriteQuestion(query);
    
    // 2. 向量化所有查询
    const queryEmbeddings = await this.embedder.embed(rewrittenQueries);
    
    // 3. 检索所有查询的结果
    const allResults: MemoryItem[] = [];
    for (const embedding of queryEmbeddings) {
      const results = await this.vectorDB.query(embedding, topK);
      allResults.push(...results);
    }
    
    // 4. 去重
    const uniqueResults = this.deduplicateResults(allResults);
    
    // 5. 精排
    return this.reranker.rerank(query, uniqueResults, topK);
  }

  // 结果去重
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

  // 获取记忆数量
  async count(): Promise<number> {
    return await this.vectorDB.count();
  }
}
