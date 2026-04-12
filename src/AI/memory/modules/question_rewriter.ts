// 问题重写器类，用于将用户问题改写为多个不同角度的查询，以提高检索效果
export class QuestionRewriter {
  private apiKey: string; // API密钥
  private baseURL: string; // API基础URL

  // 构造函数，初始化API密钥和基础URL
  constructor(apiKey: string = process.env.QWEN_API_KEY || '', baseURL: string = process.env.QWEN_BASE_URL || 'https://dashscope.aliyuncs.com/api/v1') {
    this.apiKey = apiKey; // 设置API密钥
    this.baseURL = baseURL; // 设置基础URL
  }

  // 异步方法：重写问题，返回3个不同角度的查询
  async rewriteQuestion(question: string): Promise<string[]> {
    // 构建提示词，指导AI如何重写问题
    const prompt = `你是一个查询扩展助手。请将以下用户问题改写为3个不同角度的查询，以便更好地从向量数据库中检索相关内容。

用户问题：${question}

要求：
1. 在不改变原始含义的基础上，从其他视角或立场进行重新表述
2. 采用同义词、近义词，并适当延伸与之相关的概念或语境
3. 严格按照下面标准 JSON 数组格式输出，数组中的每个元素必须是一个独立的查询字符串，且你的输出内容不得包含 JSON 结构之外的任何文字说明

输入示例：评价一下AI领域的各个研究方向？

输出示例：
[
  "AI领域有哪些主要研究方向？各自的研究内容、优缺点和发展前景如何？",
  "如何评估人工智能不同研究分支（如机器学、自然语言处理、计算机视觉等）的进展与价值？",
  "从学术、产业应用、创新特质、个人发展角度，对人工智能各领域的研究方向进行综合评述。"
]

请输出3个改写后的查询：`;

    try {
      // 发送POST请求到Qwen文本生成API
      const response = await fetch(`${this.baseURL}/services/aigc/text-generation/generation`, {
        method: 'POST', // 使用POST方法
        headers: {
          'Content-Type': 'application/json', // 设置内容类型为JSON
          // 如果有API密钥，则添加Authorization头
          ...(this.apiKey ? { 'Authorization': `Bearer ${this.apiKey}` } : {})
        },
        body: JSON.stringify({
          model: 'qwen-turbo', // 使用的模型名称
          input: { messages: [{ role: 'user', content: prompt }] }, // 用户消息
          parameters: {
            temperature: 0.7, // 温度参数，控制生成的随机性
            max_new_tokens: 500 // 最大生成的token数量
          }
        })
      });

      // 检查响应是否成功
      if (!response.ok) {
        const errorText = await response.text(); // 获取错误响应文本
        console.error('Question Rewriter API Error:', {
          status: response.status, // HTTP状态码
          statusText: response.statusText, // HTTP状态文本
          body: errorText // 错误响应体
        });
        throw new Error(`API request failed: ${response.status} ${response.statusText}`); // 抛出错误
      }

      const data = await response.json() as any; // 解析JSON响应数据
      const generatedText = data.output.text; // 获取生成的文本
      
      // 提取JSON部分
      const jsonStart = generatedText.indexOf('['); // 找到JSON数组的开始位置
      const jsonEnd = generatedText.lastIndexOf(']') + 1; // 找到JSON数组的结束位置
      if (jsonStart !== -1 && jsonEnd !== -1) {
        const jsonStr = generatedText.substring(jsonStart, jsonEnd); // 提取JSON字符串
        const rewrites = JSON.parse(jsonStr); // 解析JSON字符串为数组
        return Array.isArray(rewrites) ? rewrites.slice(0, 3) : [question]; // 返回前3个重写结果，如果不是数组则返回原问题
      }
      return [question]; // 如果无法提取JSON，则返回原问题
    } catch (error) {
      console.warn('Question rewriting failed, using original question:', error instanceof Error ? error.message : error); // 警告问题重写失败
      return [question]; // 出错时返回原问题
    }
  }
}
