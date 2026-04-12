// 导入必要的模块
import * as fs from 'fs'; // 文件系统模块
import * as path from 'path'; // 路径处理模块
import { TextChunker } from '../modules/text_chunker'; // 文本分块器
import { QwenEmbedding } from '../modules/embedding'; // Qwen嵌入工具

/**
 * 文档知识库加载器类
 * 从指定目录中读取文档，进行分块和向量化处理后存储到 ChromaDB 向量数据库中
 */
export class DocumentKnowledgeLoader {
  private docsDir: string; // 文档目录路径
  private chunker: TextChunker; // 文本分块器实例
  private embedder: QwenEmbedding; // 嵌入工具实例

  // 构造函数，初始化文档目录和工具
  constructor(docsDir: string = './docs') {
    this.docsDir = docsDir; // 设置文档目录，默认为'./docs'
    this.chunker = new TextChunker(); // 创建文本分块器
    this.embedder = new QwenEmbedding(); // 创建Qwen嵌入工具
  }

  /**
   * 加载所有文档到知识库
   * @param collectionName ChromaDB 集合名称，用于存储文档向量
   * @param category 知识分类（可选），如果不提供则使用文件名作为分类
   * @returns 包含总数、成功数和失败数的统计对象
   */
  async loadAllDocuments(
    collectionName: string,
    category?: string
  ): Promise<{ total: number; success: number; failed: number }> {
    console.log(`[知识库] 开始从 ${this.docsDir} 加载文档...`);

    // 检查文档目录是否存在
    if (!fs.existsSync(this.docsDir)) {
      console.warn(`[知识库] 目录不存在: ${this.docsDir}`);
      return { total: 0, success: 0, failed: 0 }; // 返回空统计
    }

    // 读取目录中的所有 Markdown 和文本文件
    const files = fs.readdirSync(this.docsDir)
      .filter(file => file.endsWith('.md') || file.endsWith('.txt')) // 只选择.md和.txt文件
      .map(file => path.join(this.docsDir, file)); // 构建完整路径

    // 如果没有找到任何文档，返回空统计
    if (files.length === 0) {
      console.warn('[知识库] 未找到任何文档');
      return { total: 0, success: 0, failed: 0 };
    }

    console.log(`[知识库] 找到 ${files.length} 个文档`);

    let successCount = 0; // 成功计数
    let failedCount = 0; // 失败计数

    // 逐个处理每个文档
    for (const filePath of files) {
      try {
        const fileName = path.basename(filePath); // 获取文件名
        const docCategory = category || path.parse(fileName).name; // 确定分类，优先使用传入的分类，否则使用文件名
        
        await this.loadDocument(filePath, collectionName, docCategory); // 加载单个文档
        successCount++; // 增加成功计数
        console.log(`[知识库] ✅ 已加载: ${fileName}`);
      } catch (error) {
        failedCount++; // 增加失败计数
        console.error(`[知识库] ❌ 加载失败: ${path.basename(filePath)}`, error);
      }
    }

    // 构建并返回统计结果
    const result = {
      total: files.length, // 总文档数
      success: successCount, // 成功加载数
      failed: failedCount // 失败加载数
    };

    console.log(`[知识库] 加载完成: ${JSON.stringify(result)}`);
    return result;
  }

  /**
   * 加载单个文档到知识库
   * @param filePath 文档文件路径
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
    
    // 将文档内容分块，便于向量化处理
    const chunks = this.chunker.chunk(content);
    
    // 如果分块结果为空，记录警告并返回
    if (chunks.length === 0) {
      console.warn(`[知识库] 文档内容为空: ${filePath}`);
      return;
    }

    console.log(`[知识库] 文档分块: ${chunks.length} 块`);

    // 对所有文本块进行向量化处理
    const embeddings = await this.embedder.embed(chunks);

    // 准备元数据，包含文档来源和分类信息
    const fileName = path.basename(filePath); // 获取文件名
    const metadatas = chunks.map((_, index) => ({
      source: fileName, // 文档来源文件名
      category: category, // 知识分类
      chunk_index: index, // 当前块的索引
      total_chunks: chunks.length, // 总块数
      timestamp: Date.now() / 1000, // 时间戳（秒）
      importance: 0.8, // 文档知识重要性较高，设为0.8
      type: 'knowledge' // 类型标记为知识
    }));

    // 为每个块生成唯一ID
    const ids = chunks.map((_, index) => 
      `${category}_${fileName}_${index}_${Date.now()}` // 格式：分类_文件名_索引_时间戳
    );

    // 动态导入 ChromaLongTermMemory 类
    const { ChromaLongTermMemory } = await import('./chroma_long_term_memory');
    const memory = new ChromaLongTermMemory(collectionName, collectionName);
    
    // 触发集合初始化（通过调用 search 方法）
    await memory.search('test', 1);
    
    // 获取 ChromaDB 集合实例
    const collection = (memory as any).collection;
    
    // 将向量化后的数据添加到 ChromaDB 集合中
    await collection.add({
      ids, // 文档ID数组
      documents: chunks, // 文档内容数组
      embeddings, // 向量数组
      metadatas // 元数据数组
    });

    console.log(`[知识库] 已存储 ${chunks.length} 个向量`);
  }

  /**
   * 清空知识库中的所有数据
   * @param collectionName ChromaDB 集合名称
   */
  async clearKnowledgeBase(collectionName: string): Promise<void> {
    console.log(`[知识库] 清空知识库: ${collectionName}`);
    
    // 动态导入 ChromaLongTermMemory 类
    const { ChromaLongTermMemory } = await import('./chroma_long_term_memory');
    const memory = new ChromaLongTermMemory(collectionName, collectionName);
    
    // 触发集合初始化
    await memory.search('test', 1);
    
    // 获取 ChromaDB 集合实例
    const collection = (memory as any).collection;
    const results = await collection.get(); // 获取所有数据
    
    // 如果存在数据，则删除所有记录
    if (results.ids && results.ids.length > 0) {
      await collection.delete({ ids: results.ids }); // 删除所有ID对应的记录
      console.log(`[知识库] 已删除 ${results.ids.length} 条记录`);
    }
  }
}
