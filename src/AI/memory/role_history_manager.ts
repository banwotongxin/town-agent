import { BaseMessage, HumanMessage, AIMessage, ToolMessage, ToolResultMessage } from '../agents/base_agent';
import * as fs from 'fs';
import * as path from 'path';
import { TokenUtils } from './token_utils';
import { ConversationCompressor } from './conversation_compressor';

/**
 * 角色历史管理器
 * 负责管理不同角色的对话历史文件，包括存储、读取和压缩
 */
export class RoleHistoryManager {
  private storagePath: string;
  private compressor: ConversationCompressor;
  private maxFileSize: number = 1024 * 1024; // 1MB
  private maxTokens: number = 10000;
  private minTokensToKeep: number = 5000;
  
  /**
   * 构造函数
   * @param storagePath 存储路径，默认为'./memory_storage/roles'
   */
  constructor(storagePath: string = './memory_storage/roles') {
    this.storagePath = storagePath;
    this.compressor = new ConversationCompressor();
    this.ensureDirectories();
  }
  
  /**
   * 确保存储目录存在
   */
  private ensureDirectories(): void {
    if (!fs.existsSync(this.storagePath)) {
      fs.mkdirSync(this.storagePath, { recursive: true });
    }
  }
  
  /**
   * 为角色添加对话
   * @param roleId 角色ID
   * @param message 消息对象
   */
  async addMessage(roleId: string, message: BaseMessage): Promise<void> {
    // 确保角色目录存在
    const roleDir = path.join(this.storagePath, roleId);
    if (!fs.existsSync(roleDir)) {
      fs.mkdirSync(roleDir, { recursive: true });
    }
    
    // 读取现有历史
    const historyFile = path.join(roleDir, 'history.json');
    let history = [];
    if (fs.existsSync(historyFile)) {
      history = JSON.parse(fs.readFileSync(historyFile, 'utf8'));
    }
    
    // 添加新消息
    history.push({
      ...message,
      timestamp: Date.now()
    });
    
    // 写入文件
    fs.writeFileSync(historyFile, JSON.stringify(history, null, 2));
    
    // 检查是否需要压缩
    await this.checkAndCompress(roleId);
  }
  
  /**
   * 检查并压缩历史（私有方法）
   * @param roleId 角色ID
   */
  private async checkAndCompress(roleId: string): Promise<void> {
    const roleDir = path.join(this.storagePath, roleId);
    const historyFile = path.join(roleDir, 'history.json');
    
    if (!fs.existsSync(historyFile)) {
      return;
    }
    
    // 检查文件大小
    const stats = fs.statSync(historyFile);
    if (stats.size >= this.maxFileSize) {
      console.log(`[压缩触发] 角色 ${roleId} 文件大小 ${stats.size} bytes 超过阈值 ${this.maxFileSize}`);
      await this.compress(roleId);
      return;
    }
    
    // 检查token数
    try {
      const content = fs.readFileSync(historyFile, 'utf8');
      const messages = JSON.parse(content);
      const tokenCount = TokenUtils.calculateMessagesTokenCount(messages);
      
      if (tokenCount >= this.maxTokens) {
        console.log(`[压缩触发] 角色 ${roleId} token数 ${tokenCount} 超过阈值 ${this.maxTokens}`);
        await this.compress(roleId);
      }
    } catch (error) {
      console.error(`[错误] 检查角色 ${roleId} token数失败:`, error);
    }
  }
  
  /**
   * 触发压缩检查（公共方法）
   * @param roleId 角色ID
   */
  async triggerCompression(roleId: string): Promise<void> {
    await this.checkAndCompress(roleId);
  }
  
  /**
   * 压缩角色历史
   * @param roleId 角色ID
   */
  async compress(roleId: string): Promise<void> {
    const roleDir = path.join(this.storagePath, roleId);
    const historyFile = path.join(roleDir, 'history.json');
    
    if (!fs.existsSync(historyFile)) {
      return;
    }
    
    try {
      // 读取原始历史
      const content = fs.readFileSync(historyFile, 'utf8');
      const messages: BaseMessage[] = JSON.parse(content);
      
      console.log(`[压缩开始] 角色 ${roleId}, 原始消息数: ${messages.length}`);
      
      // 执行三层压缩
      const compressedMessages = await this.compressor.compressThreeLayers(messages);
      
      console.log(`[压缩完成] 角色 ${roleId}, 压缩后消息数: ${compressedMessages.length}`);
      
      // 保存压缩后的历史
      const compressedFile = path.join(roleDir, 'compressed.json');
      fs.writeFileSync(compressedFile, JSON.stringify(compressedMessages, null, 2));
      
      // 备份原始历史
      const backupFile = path.join(roleDir, `history_backup_${Date.now()}.json`);
      fs.copyFileSync(historyFile, backupFile);
      
      // 更新主历史文件为压缩后的内容
      fs.writeFileSync(historyFile, JSON.stringify(compressedMessages, null, 2));
      
      console.log(`[压缩成功] 角色 ${roleId} 历史已压缩并保存`);
    } catch (error) {
      console.error(`[压缩失败] 角色 ${roleId}:`, error);
      throw error;
    }
  }
  
  /**
   * 获取角色的对话上下文（推荐实现）
   * @param roleId 角色ID
   * @param options 选项配置
   * @returns 对话消息数组
   */
  async getContext(
    roleId: string, 
    options?: {
      maxMessages?: number;      // 最大消息数
      maxTokens?: number;        // 最大token数（优先级更高）
    }
  ): Promise<BaseMessage[]> {
    const roleDir = path.join(this.storagePath, roleId);
    const historyFile = path.join(roleDir, 'history.json');
    
    if (!fs.existsSync(historyFile)) {
      return [];
    }
    
    try {
      const content = fs.readFileSync(historyFile, 'utf8');
      let messages: BaseMessage[] = JSON.parse(content);
      
      // 如果指定了最大消息数
      if (options?.maxMessages && messages.length > options.maxMessages) {
        messages = messages.slice(-options.maxMessages);
      }
      
      // 如果指定了最大token数，进一步裁剪
      if (options?.maxTokens) {
        let currentTokens = TokenUtils.calculateMessagesTokenCount(messages);
        
        while (currentTokens > options.maxTokens && messages.length > 1) {
          messages.shift(); // 移除最早的消息
          currentTokens = TokenUtils.calculateMessagesTokenCount(messages);
        }
      }
      
      return messages;
    } catch (error) {
      console.error(`[错误] 获取角色 ${roleId} 上下文失败:`, error);
      return [];
    }
  }
  
  /**
   * 将 BaseMessage 对象转换为可序列化的格式
   */
  private serializeMessage(message: BaseMessage): any {
    return {
      type: message.type,
      content: message.content,
      metadata: message.metadata || {},
      timestamp: Date.now()
    };
  }
  
  /**
   * 将序列化的数据转换回 BaseMessage 对象
   */
  private deserializeMessage(data: any): BaseMessage {
    switch (data.type) {
      case 'human':
        return new HumanMessage(data.content, data.metadata);
      case 'ai':
        return new AIMessage(data.content, data.metadata);
      case 'tool':
        return new ToolMessage(data.content, data.metadata);
      case 'tool_result':
        return new ToolResultMessage(data.content, data.metadata);
      default:
        return new HumanMessage(data.content, data.metadata);
    }
  }
}