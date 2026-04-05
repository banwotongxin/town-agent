import { BaseMessage, HumanMessage, AIMessage } from './base_agent';

/**
 * 记忆提取代理类
 * 用于从对话中提取会话记忆
 */
export class MemoryExtractionAgent {
  /**
   * 提取会话记忆
   * @param messages 对话消息数组
   * @returns 提取的会话记忆内容
   */
  async extractSessionMemory(messages: BaseMessage[]): Promise<string> {
    // 构建提取提示词
    const prompt = this.buildExtractionPrompt(messages);
    
    // 这里应该调用实际的LLM API，现在使用模拟实现
    // 在实际应用中，应该使用OpenAI API或其他LLM服务
    const extractedMemory = await this.simulateLLMResponse(prompt);
    
    return extractedMemory;
  }

  /**
   * 构建提取提示词
   * @param messages 对话消息数组
   * @returns 提示词
   */
  private buildExtractionPrompt(messages: BaseMessage[]): string {
    let prompt = `请基于以下对话更新会话记忆：\n\n`;
    
    // 添加最近的消息
    const recentMessages = messages.slice(-10); // 只使用最近的10条消息
    for (const msg of recentMessages) {
      if (msg.type === 'human') {
        prompt += `用户：${msg.content}\n`;
      } else if (msg.type === 'ai') {
        prompt += `助手：${msg.content}\n`;
      } else if (msg.type === 'tool') {
        prompt += `工具：${msg.content}\n`;
      } else if (msg.type === 'tool_result') {
        prompt += `工具结果：${msg.content}\n`;
      }
    }
    
    prompt += `\n请按照以下格式更新会话记忆：\n`;
    prompt += `1. 会话标题：简短的会话标题（5-10字）\n`;
    prompt += `2. 当前状态：当前正在做什么，下一步是什么\n`;
    prompt += `3. 任务规格：用户要求构建什么\n`;
    prompt += `4. 文件和函数：提到的关键文件和函数\n`;
    prompt += `5. 工作流程：常用命令和工作流程\n`;
    prompt += `6. 错误与修正：遇到的错误和应用的修复\n`;
    prompt += `7. 代码库和系统文档：系统组件及其工作方式\n`;
    prompt += `8. 学习内容：什么有效，什么无效\n`;
    prompt += `9. 关键结果：用户要求的具体输出结果\n`;
    prompt += `10. 工作日志：一步一步完成的工作（非常简洁）\n`;
    
    return prompt;
  }

  /**
   * 模拟LLM响应
   * @param prompt 提示词
   * @returns 模拟的LLM响应
   */
  private async simulateLLMResponse(prompt: string): Promise<string> {
    // 模拟LLM响应，实际应用中应该调用真实的LLM API
    return `# 会话标题：内存系统优化

# 当前状态
正在优化内存系统，包括Token计算、长期记忆存储和会话记忆提取。

# 任务规格
用户要求优化内存系统的三个方面：
1. Token计算优化：集成tiktoken库
2. 长期记忆存储：完善ChromaDB集成
3. 会话记忆提取：实现子代理提取机制

# 文件和函数
- src/AI/memory/token_utils.ts：Token计算工具类
- src/AI/memory/chroma_long_term_memory.ts：ChromaDB长期记忆实现
- src/AI/memory/session_memory.ts：会话记忆管理
- src/AI/agents/memory_extraction_agent.ts：记忆提取代理

# 工作流程
1. 安装必要的依赖
2. 实现Token计算工具类
3. 完善ChromaDB集成
4. 实现子代理提取机制
5. 测试和验证

# 错误与修正
- 无

# 代码库和系统文档
- 内存系统使用双记忆架构：短期记忆和长期记忆
- 长期记忆使用ChromaDB进行向量存储和检索
- 会话记忆通过子代理提取和更新

# 学习内容
- tiktoken库提供准确的Token计算
- ChromaDB是一个轻量级的向量数据库
- 子代理机制可以提高记忆提取的质量

# 关键结果
- 优化后的Token计算精度
- 功能完整的长期记忆存储
- 智能的会话记忆提取机制

# 工作日志
1. 集成tiktoken库
2. 实现TokenUtils类
3. 更新所有token计算相关代码
4. 完善ChromaDB集成
5. 实现记忆提取代理
`;
  }
}
