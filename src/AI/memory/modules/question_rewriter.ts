export class QuestionRewriter {
  private apiKey: string;
  private baseURL: string;

  constructor(apiKey: string = process.env.QWEN_API_KEY || '', baseURL: string = process.env.QWEN_BASE_URL || 'https://dashscope.aliyuncs.com/api/v1') {
    this.apiKey = apiKey;
    this.baseURL = baseURL;
  }

  async rewriteQuestion(question: string): Promise<string[]> {
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
      const response = await fetch(`${this.baseURL}/services/aigc/text-generation/generation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.apiKey ? { 'Authorization': `Bearer ${this.apiKey}` } : {})
        },
        body: JSON.stringify({
          model: 'qwen-turbo',
          input: { messages: [{ role: 'user', content: prompt }] },
          parameters: {
            temperature: 0.7,
            max_new_tokens: 500
          }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Question Rewriter API Error:', {
          status: response.status,
          statusText: response.statusText,
          body: errorText
        });
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as any;
      const generatedText = data.output.text;
      
      // 提取JSON部分
      const jsonStart = generatedText.indexOf('[');
      const jsonEnd = generatedText.lastIndexOf(']') + 1;
      if (jsonStart !== -1 && jsonEnd !== -1) {
        const jsonStr = generatedText.substring(jsonStart, jsonEnd);
        const rewrites = JSON.parse(jsonStr);
        return Array.isArray(rewrites) ? rewrites.slice(0, 3) : [question];
      }
      return [question];
    } catch (error) {
      console.warn('Question rewriting failed, using original question:', error instanceof Error ? error.message : error);
      return [question];
    }
  }
}
