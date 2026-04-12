// 定义嵌入函数接口，用于将文本转换为向量表示
export interface EmbeddingFunction {
  // 将一组文本转换为对应的向量数组
  embed(texts: string[]): Promise<number[][]>;
}

// Qwen嵌入类，实现了EmbeddingFunction接口，使用Qwen API进行文本嵌入
export class QwenEmbedding implements EmbeddingFunction {
  private apiKey: string; // API密钥
  private baseURL: string; // API基础URL

  // 构造函数，初始化API密钥和基础URL
  constructor(apiKey: string = process.env.QWEN_API_KEY || '', baseURL: string = process.env.QWEN_BASE_URL || 'https://dashscope.aliyuncs.com/api/v1') {
    this.apiKey = apiKey; // 设置API密钥
    this.baseURL = baseURL; // 设置基础URL
  }

  // 异步方法：将文本数组转换为向量数组
  async embed(texts: string[]): Promise<number[][]> {
    try {
      // 发送POST请求到Qwen嵌入API
      const response = await fetch(`${this.baseURL}/services/embeddings/text-embedding/text-embedding`, {
        method: 'POST', // 使用POST方法
        headers: {
          'Content-Type': 'application/json', // 设置内容类型为JSON
          // 如果有API密钥，则添加Authorization头
          ...(this.apiKey ? { 'Authorization': `Bearer ${this.apiKey}` } : {})
        },
        body: JSON.stringify({
          model: 'text-embedding-v2', // 使用的模型名称
          input: {
            texts: texts // 要嵌入的文本数组
          }
        })
      });

      // 检查响应是否成功
      if (!response.ok) {
        const errorText = await response.text(); // 获取错误响应文本
        console.error('Embedding API Error:', {
          status: response.status, // HTTP状态码
          statusText: response.statusText, // HTTP状态文本
          body: errorText // 错误响应体
        });
        throw new Error(`API request failed: ${response.status} ${response.statusText}`); // 抛出错误
      }

      const data = await response.json() as any; // 解析JSON响应数据
      
      // Qwen 嵌入 API 返回格式: { output: { embeddings: [{embedding: [...]}, ...] } }
      if (data.output && data.output.embeddings) {
        // 检查是否是正确的二维数组格式
        if (Array.isArray(data.output.embeddings) && Array.isArray(data.output.embeddings[0])) {
          return data.output.embeddings; // 直接返回嵌入向量
        }
        
        // 如果 embeddings 是对象数组，提取 embedding 字段
        if (Array.isArray(data.output.embeddings) && typeof data.output.embeddings[0] === 'object') {
          return data.output.embeddings.map((item: any) => {
            if (item.embedding && Array.isArray(item.embedding)) {
              return item.embedding; // 返回嵌入向量
            }
            return Object.values(item).filter(v => typeof v === 'number'); // 过滤出数值类型的值作为向量
          });
        }
        
        throw new Error('Embeddings format not recognized'); // 如果格式无法识别，抛出错误
      }
      
      // 备用格式处理
      if (data.data && Array.isArray(data.data)) {
        console.log('Using data.data format, count:', data.data.length); // 记录使用的格式和数据数量
        return data.data.map((item: any) => item.embedding); // 从data.data中提取嵌入向量
      }
      
      console.error('Unexpected response structure:', JSON.stringify(data).substring(0, 500)); // 记录意外的响应结构
      throw new Error('Invalid embedding response format'); // 抛出无效响应格式错误
    } catch (error) {
      console.warn('Embedding generation failed, using default vectors:', error instanceof Error ? error.message : error); // 警告嵌入生成失败
      // 出错时返回默认向量（全零向量）
      return texts.map(() => Array(768).fill(0)); // 为每个文本返回一个768维的全零向量
    }
  }
}
