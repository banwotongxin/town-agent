export interface EmbeddingFunction {
  embed(texts: string[]): Promise<number[][]>;
}

export class QwenEmbedding implements EmbeddingFunction {
  private apiKey: string;
  private baseURL: string;

  constructor(apiKey: string = process.env.QWEN_API_KEY || '', baseURL: string = process.env.QWEN_BASE_URL || 'https://dashscope.aliyuncs.com/api/v1') {
    this.apiKey = apiKey;
    this.baseURL = baseURL;
  }

  async embed(texts: string[]): Promise<number[][]> {
    try {
      const response = await fetch(`${this.baseURL}/services/embeddings/text-embedding/text-embedding`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.apiKey ? { 'Authorization': `Bearer ${this.apiKey}` } : {})
        },
        body: JSON.stringify({
          model: 'text-embedding-v2',
          input: {
            texts: texts
          }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Embedding API Error:', {
          status: response.status,
          statusText: response.statusText,
          body: errorText
        });
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as any;
      
      // Qwen 嵌入 API 返回格式: { output: { embeddings: [{embedding: [...]}, ...] } }
      if (data.output && data.output.embeddings) {
        // 检查是否是正确的二维数组格式
        if (Array.isArray(data.output.embeddings) && Array.isArray(data.output.embeddings[0])) {
          return data.output.embeddings;
        }
        
        // 如果 embeddings 是对象数组，提取 embedding 字段
        if (Array.isArray(data.output.embeddings) && typeof data.output.embeddings[0] === 'object') {
          return data.output.embeddings.map((item: any) => {
            if (item.embedding && Array.isArray(item.embedding)) {
              return item.embedding;
            }
            return Object.values(item).filter(v => typeof v === 'number');
          });
        }
        
        throw new Error('Embeddings format not recognized');
      }
      
      // 备用格式处理
      if (data.data && Array.isArray(data.data)) {
        console.log('Using data.data format, count:', data.data.length);
        return data.data.map((item: any) => item.embedding);
      }
      
      console.error('Unexpected response structure:', JSON.stringify(data).substring(0, 500));
      throw new Error('Invalid embedding response format');
    } catch (error) {
      console.warn('Embedding generation failed, using default vectors:', error instanceof Error ? error.message : error);
      // 出错时返回默认向量
      return texts.map(() => Array(768).fill(0));
    }
  }
}
