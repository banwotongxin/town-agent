import * as fs from 'fs';
import * as path from 'path';
import { TextChunker } from './modules/text_chunker';
import { QwenEmbedding } from './modules/embedding';

/**
 * 文档知识库加载器
 * 从目录中读取文档，分块并向量化后存储到 ChromaDB
 */
export class DocumentKnowledgeLoader {
  private docsDir: string;
  private chunker: TextChunker;
  private embedder: QwenEmbedding;

  constructor(docsDir: string = './docs') {
    this.docsDir = docsDir;
    this.chunker = new TextChunker();
    this.embedder = new QwenEmbedding();
  }

  /**
   * 加载所有文档到知识库
   * @param collectionName ChromaDB 集合名称
   * @param category 知识分类（可选，默认使用文件名）
   */
  async loadAllDocuments(
    collectionName: string,
    category?: string
  ): Promise<{ total: number; success: number; failed: number }> {
    console.log(`[知识库] 开始从 ${this.docsDir} 加载文档...`);

    // 确保目录存在
    if (!fs.existsSync(this.docsDir)) {
      console.warn(`[知识库] 目录不存在: ${this.docsDir}`);
      return { total: 0, success: 0, failed: 0 };
    }

    // 读取所有 Markdown 文件
    const files = fs.readdirSync(this.docsDir)
      .filter(file => file.endsWith('.md') || file.endsWith('.txt'))
      .map(file => path.join(this.docsDir, file));

    if (files.length === 0) {
      console.warn('[知识库] 未找到任何文档');
      return { total: 0, success: 0, failed: 0 };
    }

    console.log(`[知识库] 找到 ${files.length} 个文档`);

    let successCount = 0;
    let failedCount = 0;

    // 逐个处理文档
    for (const filePath of files) {
      try {
        const fileName = path.basename(filePath);
        const docCategory = category || path.parse(fileName).name;
        
        await this.loadDocument(filePath, collectionName, docCategory);
        successCount++;
        console.log(`[知识库] ✅ 已加载: ${fileName}`);
      } catch (error) {
        failedCount++;
        console.error(`[知识库] ❌ 加载失败: ${path.basename(filePath)}`, error);
      }
    }

    const result = {
      total: files.length,
      success: successCount,
      failed: failedCount
    };

    console.log(`[知识库] 加载完成: ${JSON.stringify(result)}`);
    return result;
  }

  /**
   * 加载单个文档
   * @param filePath 文件路径
   * @param collectionName ChromaDB 集合名称
   * @param category 知识分类
   */
  async loadDocument(
    filePath: string,
    collectionName: string,
    category: string
  ): Promise<void> {
    // 读取文件内容
    const content = fs.readFileSync(filePath, 'utf-8');
    
    // 分块
    const chunks = this.chunker.chunk(content);
    
    if (chunks.length === 0) {
      console.warn(`[知识库] 文档内容为空: ${filePath}`);
      return;
    }

    console.log(`[知识库] 文档分块: ${chunks.length} 块`);

    // 向量化
    const embeddings = await this.embedder.embed(chunks);

    // 准备元数据
    const fileName = path.basename(filePath);
    const metadatas = chunks.map((_, index) => ({
      source: fileName,
      category: category,
      chunk_index: index,
      total_chunks: chunks.length,
      timestamp: Date.now() / 1000,
      importance: 0.8, // 文档知识重要性较高
      type: 'knowledge'
    }));

    // 生成 ID
    const ids = chunks.map((_, index) => 
      `${category}_${fileName}_${index}_${Date.now()}`
    );

    // 存储到 ChromaDB
    const { ChromaLongTermMemory } = await import('./chroma_long_term_memory');
    const memory = new ChromaLongTermMemory(collectionName, collectionName);
    
    // 触发初始化（通过调用 search 方法）
    await memory.search('test', 1);
    
    // 使用 ChromaDB 原生 API 添加
    const collection = (memory as any).collection;
    
    await collection.add({
      ids,
      documents: chunks,
      embeddings,
      metadatas
    });

    console.log(`[知识库] 已存储 ${chunks.length} 个向量`);
  }

  /**
   * 清空知识库
   * @param collectionName ChromaDB 集合名称
   */
  async clearKnowledgeBase(collectionName: string): Promise<void> {
    console.log(`[知识库] 清空知识库: ${collectionName}`);
    
    const { ChromaLongTermMemory } = await import('./chroma_long_term_memory');
    const memory = new ChromaLongTermMemory(collectionName, collectionName);
    
    // 触发初始化
    await memory.search('test', 1);
    
    const collection = (memory as any).collection;
    const results = await collection.get();
    
    if (results.ids && results.ids.length > 0) {
      await collection.delete({ ids: results.ids });
      console.log(`[知识库] 已删除 ${results.ids.length} 条记录`);
    }
  }
}
