// 导入AgentProfile类型和创建函数
import { AgentProfile, createAgentProfile } from './models';

/**
 * 消息基接口，定义了所有消息类型的共同属性
 */
export interface BaseMessage {
  content: string;        // 消息内容
  type: string;           // 消息类型
  metadata?: Record<string, any>;  // 可选的元数据
}

/**
 * 人类消息类，表示用户发送的消息
 */
export class HumanMessage implements BaseMessage {
  constructor(public content: string, public metadata?: Record<string, any>) {}
  type: string = 'human';  // 消息类型为human
}

/**
 * AI消息类，表示AI发送的消息
 */
export class AIMessage implements BaseMessage {
  constructor(public content: string, public metadata?: Record<string, any>) {}
  type: string = 'ai';     // 消息类型为ai
}

/**
 * 系统消息类，表示系统发送的消息
 */
export class SystemMessage implements BaseMessage {
  constructor(public content: string, public metadata?: Record<string, any>) {}
  type: string = 'system'; // 消息类型为system
}

/**
 * 工具消息类，表示工具调用的消息
 */
export class ToolMessage implements BaseMessage {
  constructor(public content: string, public metadata?: Record<string, any>) {}
  type: string = 'tool';   // 消息类型为tool
}

/**
 * 工具结果消息类，表示工具执行结果的消息
 */
export class ToolResultMessage implements BaseMessage {
  constructor(public content: string, public metadata?: Record<string, any>) {
    this.metadata = metadata || {};  // 如果没有提供元数据，设置为空对象
  }
  type: string = 'tool_result';  // 消息类型为tool_result
}

/**
 * LLM模型接口，定义了模型的调用方法
 */
export interface LLMModel {
  // 同步调用方法
  invoke: (messages: BaseMessage[]) => Promise<{ content: string }>;
  // 异步调用方法（可选）
  ainvoke?: (messages: BaseMessage[]) => Promise<{ content: string }>;
}

/**
 * 基础智能体类，所有智能体的基类
 */
export class BaseAgent {
  private agentId: string;         // 智能体唯一ID
  private profile: AgentProfile;   // 智能体配置文件
  private llmModel?: LLMModel;     // 语言模型实例
  private isActive: boolean;       // 智能体是否激活
  private currentLocation: string;  // 智能体当前位置
  private currentMood: string;      // 智能体当前情绪
  private conversationCount: number; // 对话次数

  /**
   * 获取智能体ID
   */
  get AgentId(): string {
    return this.agentId;
  }

  /**
   * 获取智能体配置文件
   */
  get Profile(): AgentProfile {
    return this.profile;
  }

  /**
   * 构造函数
   * @param agentId 智能体ID
   * @param profile 智能体配置文件
   * @param llmModel 语言模型实例（可选）
   */
  constructor(
    agentId: string,
    profile: AgentProfile,
    llmModel?: LLMModel
  ) {
    this.agentId = agentId;
    this.profile = profile;
    this.llmModel = llmModel;
    this.isActive = true;
    this.currentLocation = "home";  // 默认位置为home
    this.currentMood = "neutral";   // 默认情绪为neutral
    this.conversationCount = 0;     // 初始对话次数为0
  }

  /**
   * 获取系统提示信息
   * @returns 系统提示字符串
   */
  getSystemPrompt(): string {
    // 构建系统提示，包含智能体的基本信息
    let prompt = `你叫${this.profile.name}，${this.profile.age}岁，职业是${this.profile.profession}。

性格特点：${this.profile.personality}
背景故事：${this.profile.background}
兴趣爱好：${this.profile.hobbies.join(', ')}
说话风格：${this.profile.speech_style}

请始终保持与你的角色设定一致，用符合你性格和职业的方式与人交流。`;

    // 如果有外貌特征，添加到提示中
    if (this.profile.appearance) {
      prompt += `\n外貌特征：${this.profile.appearance}`;
    }

    return prompt;
  }

  /**
   * 格式化消息
   * @param messages 原始消息数组
   * @param memoryContext 记忆上下文（可选）
   * @param emotionContext 情绪上下文（可选）
   * @returns 格式化后的消息数组
   */
  formatMessages(
    messages: BaseMessage[],
    memoryContext?: string,
    emotionContext?: string
  ): BaseMessage[] {
    const formatted: BaseMessage[] = [];

    // 获取系统提示
    let systemPrompt = this.getSystemPrompt();

    // 添加记忆上下文
    if (memoryContext) {
      systemPrompt += `\n\n[历史对话摘要]\n${memoryContext}`;
    }

    // 添加情绪上下文
    if (emotionContext) {
      systemPrompt += `\n\n[当前关系状态]\n${emotionContext}`;
    }

    // 添加系统消息和原始消息
    formatted.push(new SystemMessage(systemPrompt));
    formatted.push(...messages);

    return formatted;
  }

  /**
   * 响应用户消息
   * @param userMessage 用户消息内容
   * @param conversationHistory 对话历史
   * @param kwargs 额外参数
   * @returns 智能体的响应
   */
  async respond(
    userMessage: string,
    conversationHistory: BaseMessage[],
    kwargs: Record<string, any> = {}
  ): Promise<string> {
    // 如果没有语言模型，返回系统提示
    if (!this.llmModel) {
      return "[系统] 我还没有学会说话...";
    }

    // 格式化消息
    const messages = this.formatMessages(
      [...conversationHistory, new HumanMessage(userMessage)],
      kwargs.memory_context,
      kwargs.emotion_context
    );

    // 调用语言模型获取响应
    let response;
    if (this.llmModel.ainvoke) {
      response = await this.llmModel.ainvoke(messages);
    } else {
      response = await this.llmModel.invoke(messages);
    }

    // 增加对话次数
    this.conversationCount++;

    // 返回响应内容
    return response.content || String(response);
  }

  /**
   * 获取智能体状态
   * @returns 智能体状态对象
   */
  getStatus(): Record<string, any> {
    return {
      agent_id: this.agentId,
      name: this.profile.name,
      profession: this.profile.profession,
      is_active: this.isActive,
      location: this.currentLocation,
      mood: this.currentMood,
      conversation_count: this.conversationCount
    };
  }

  /**
   * 转换为字符串
   * @returns 智能体的字符串表示
   */
  toString(): string {
    return `BaseAgent(${this.profile.name}, ${this.profile.profession})`;
  }
}

/**
 * 创建基础智能体
 * @param name 智能体名称
 * @param profession 智能体职业
 * @param agentId 智能体ID（可选）
 * @param profileKwargs 配置参数（可选）
 * @returns 基础智能体实例
 */
export function createBaseAgent(
  name: string,
  profession: string,
  agentId?: string,
  profileKwargs: Record<string, any> = {}
): BaseAgent {
  // 创建智能体配置文件
  const profile = createAgentProfile(
    name,
    profession,
    profileKwargs.age,
    profileKwargs.personality,
    profileKwargs.background,
    profileKwargs.custom_skills
  );

  // 生成智能体ID
  const id = agentId || `agent_${Math.random().toString(16).substr(2, 8)}`;

  // 创建并返回智能体实例
  return new BaseAgent(id, profile);
}
