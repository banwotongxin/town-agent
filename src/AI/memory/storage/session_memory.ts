import { BaseMessage, HumanMessage, AIMessage, ToolMessage, ToolResultMessage } from '../../agents/base_agent';
import { MemoryExtractionAgent } from '../../agents/memory_extraction_agent';
import * as fs from 'fs';
import * as path from 'path';
import { TokenUtils } from '../compression/token_utils';

/**
 * 会话记忆类
 * 用于管理智能体的会话记忆，包括记忆提取、压缩和存储
 */
export class SessionMemory {
  // 智能体ID
  private agentId: string;
  // 存储路径
  private storagePath: string;
  // 摘要文件路径
  private summaryFile: string;
  // 最后提取时间
  private lastExtractionTime: number;
  // 最后提取的消息ID
  private lastExtractedMessageId: string;
  // 记忆提取代理
  private extractionAgent: MemoryExtractionAgent;
  
  // 提取阈值
  private minTokensToInit: number = 5000;
  private minTokensBetweenUpdate: number = 2000;
  private minToolCallsBetweenUpdates: number = 3;
  
  // 记忆文件限制
  private maxSectionTokens: number = 2000;
  private maxTotalTokens: number = 12000;
  
  // 压缩保留下限
  private minTokensToKeep: number = 5000;
  private minMessagesToKeep: number = 5;
  private maxTokensToKeep: number = 15000;

  /**
   * 构造函数
   * @param agentId 智能体ID
   * @param storagePath 存储路径，默认为'./memory_storage'
   */
  constructor(agentId: string, storagePath: string = './memory_storage') {
    this.agentId = agentId;
    this.storagePath = storagePath;
    this.summaryFile = path.join(storagePath, `${agentId}_summary.md`);
    this.lastExtractionTime = 0;
    this.lastExtractedMessageId = '';
    this.extractionAgent = new MemoryExtractionAgent();
    
    // 确保存储目录存在
    if (!fs.existsSync(storagePath)) {
      fs.mkdirSync(storagePath, { recursive: true });
    }
    
    // 初始化摘要文件
    this.initializeSummaryFile();
  }

  /**
   * 初始化摘要文件
   * 如果文件不存在则创建一个新的模板
   */
  private initializeSummaryFile(): void {
    if (!fs.existsSync(this.summaryFile)) {
      const template = `# Session Title
# Current State
# Task specification
# Files and Functions
# Workflow
# Errors & Corrections
# Codebase and System Documentation
# Learnings
# Key results
# Worklog`;
      fs.writeFileSync(this.summaryFile, template);
    }
  }

  /**
   * 判断是否应该提取记忆
   * @param messages 消息数组
   * @param tokenCount token数
   * @returns 是否应该提取记忆
   */
  shouldExtractMemory(messages: BaseMessage[], tokenCount: number): boolean {
    // 计算工具调用次数
    const toolCallCount = messages.filter(msg => msg.type === 'tool').length;
    
    // 检查是否满足提取条件
    if (tokenCount >= this.minTokensToInit) {
      const timeSinceLastExtraction = Date.now() - this.lastExtractionTime;
      const tokensSinceLastExtraction = tokenCount - this.getLastExtractedTokenCount();
      
      if (tokensSinceLastExtraction >= this.minTokensBetweenUpdate && toolCallCount >= this.minToolCallsBetweenUpdates) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * 获取最后提取的token数
   * @returns token数
   */
  private getLastExtractedTokenCount(): number {
    // 简单实现，实际应该从存储中读取
    return 0;
  }

  /**
   * 提取记忆
   * @param messages 消息数组
   */
  async extractMemory(messages: BaseMessage[]): Promise<void> {
    console.log('Extracting session memory using extraction agent...');
    
    // 使用记忆提取代理提取会话记忆
    const extractedMemory = await this.extractionAgent.extractSessionMemory(messages);
    
    // 更新摘要文件
    this.updateSummaryFile(extractedMemory);
    
    // 更新提取时间和消息ID
    this.lastExtractionTime = Date.now();
    if (messages.length > 0) {
      this.lastExtractedMessageId = this.getMessageId(messages[messages.length - 1]);
    }
  }

  /**
   * 构建提取提示词
   * @param messages 消息数组
   * @returns 提示词
   */
  private buildExtractionPrompt(messages: BaseMessage[]): string {
    // 构建提取提示词
    let prompt = `Please update the session memory based on the following conversation:\n\n`;
    
    // 添加最近的消息
    const recentMessages = messages.slice(-10); // 只使用最近的10条消息
    for (const msg of recentMessages) {
      if (msg.type === 'human') {
        prompt += `User: ${msg.content}\n`;
      } else if (msg.type === 'ai') {
        prompt += `Assistant: ${msg.content}\n`;
      } else if (msg.type === 'tool') {
        prompt += `Tool: ${msg.content}\n`;
      } else if (msg.type === 'tool_result') {
        prompt += `Tool Result: ${msg.content}\n`;
      }
    }
    
    prompt += `\nPlease update the following sections in the summary.md file:\n`;
    prompt += `1. Session Title: A brief title for the session (5-10 words)\n`;
    prompt += `2. Current State: What is being done currently and what's next\n`;
    prompt += `3. Task specification: What the user is asking to build\n`;
    prompt += `4. Files and Functions: Key files and functions mentioned\n`;
    prompt += `5. Workflow: Common commands and workflows\n`;
    prompt += `6. Errors & Corrections: Errors encountered and fixes applied\n`;
    prompt += `7. Codebase and System Documentation: System components and how they work\n`;
    prompt += `8. Learnings: What works and what doesn't\n`;
    prompt += `9. Key results: Specific output results requested by the user\n`;
    prompt += `10. Worklog: Step-by-step what was done (very concise)\n`;
    
    return prompt;
  }

  /**
   * 更新摘要文件
   * @param prompt 提示词
   */
  private updateSummaryFile(prompt: string): void {
    // 简单实现，实际应该使用子代理编辑文件
    const currentContent = fs.readFileSync(this.summaryFile, 'utf8');
    const updatedContent = currentContent + `\n\n[Updated at ${new Date().toISOString()}]\n${prompt}`;
    fs.writeFileSync(this.summaryFile, updatedContent);
  }

  /**
   * 获取消息ID
   * @param message 消息对象
   * @returns 消息ID
   */
  private getMessageId(message: BaseMessage): string {
    return message.metadata?.id || `msg_${Date.now()}_${Math.random().toString(16).substring(2, 10)}`;
  }

  /**
   * 获取会话记忆
   * @returns 会话记忆内容
   */
  getSessionMemory(): string {
    if (fs.existsSync(this.summaryFile)) {
      return fs.readFileSync(this.summaryFile, 'utf8');
    }
    return '';
  }

  /**
   * 压缩会话记忆
   * @param messages 消息数组
   * @returns 压缩后的消息数组
   */
  compactSessionMemory(messages: BaseMessage[]): BaseMessage[] {
    // 读取会话记忆
    const sessionMemory = this.getSessionMemory();

    if (!sessionMemory) {
      return messages; // 如果没有会话记忆，返回原始消息
    }

    // 计算需要保留的消息
    const messagesToKeep = this.calculateMessagesToKeep(messages);

    // 创建压缩边界标记
    const boundaryMessage: BaseMessage = new ToolMessage(
      '[COMPRESS_BOUNDARY]',
      {
        compactType: 'session_memory',
        preCompactTokenCount: this.calculateTokenCount(messages),
        lastUserMessageUuid: this.getLastUserMessageId(messages)
      }
    );

    // 创建会话记忆消息
    const sessionMemoryMessage: BaseMessage = new ToolMessage(
      `[Session Memory]\n${sessionMemory}`,
      {
        type: 'session_memory'
      }
    );

    // 返回压缩后的消息
    return [boundaryMessage, sessionMemoryMessage, ...messagesToKeep];
  }

  /**
   * 计算需要保留的消息
   * @param messages 消息数组
   * @returns 需要保留的消息数组
   */
  private calculateMessagesToKeep(messages: BaseMessage[]): BaseMessage[] {
    // 计算需要保留的消息
    let messagesToKeep: BaseMessage[] = [];
    let tokenCount = 0;
    
    // 从后往前添加消息，直到达到保留限制
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      const msgTokenCount = this.calculateMessageTokenCount(msg);
      
      // 检查是否超过保留限制
      if (tokenCount + msgTokenCount > this.maxTokensToKeep) {
        break;
      }
      
      messagesToKeep.unshift(msg);
      tokenCount += msgTokenCount;
    }
    
    // 确保至少保留指定数量的消息
    if (messagesToKeep.length < this.minMessagesToKeep && messages.length >= this.minMessagesToKeep) {
      messagesToKeep = messages.slice(-this.minMessagesToKeep);
    }
    
    return messagesToKeep;
  }

  /**
   * 计算消息数组的token数
   * @param messages 消息数组
   * @returns token数
   */
  private calculateTokenCount(messages: BaseMessage[]): number {
    return TokenUtils.calculateMessagesTokenCount(messages);
  }

  /**
   * 计算单条消息的token数
   * @param message 消息对象
   * @returns token数
   */
  private calculateMessageTokenCount(message: BaseMessage): number {
    return TokenUtils.calculateTokenCount(message.content);
  }

  /**
   * 获取最后一条用户消息的ID
   * @param messages 消息数组
   * @returns 最后一条用户消息的ID
   */
  private getLastUserMessageId(messages: BaseMessage[]): string {
    // 查找最后一条用户消息
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].type === 'human') {
        return this.getMessageId(messages[i]);
      }
    }
    return '';
  }

  /**
   * 清除会话记忆
   */
  clear(): void {
    // 清除会话记忆
    if (fs.existsSync(this.summaryFile)) {
      fs.unlinkSync(this.summaryFile);
    }
    this.initializeSummaryFile();
    this.lastExtractionTime = 0;
    this.lastExtractedMessageId = '';
  }
}