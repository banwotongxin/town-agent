/**
 * 赛博小镇 - 基础智能体模块
 * 
 * 这个文件定义了所有智能体（角色）的基础结构和行为。
 * 就像是一个人的基本属性：有名字、年龄、职业，能够说话和记忆。
 * 
 * 主要包含：
 * 1. 消息类型定义 - 区分用户消息、AI回复、系统消息等
 * 2. BaseAgent类 - 所有角色的基类，提供基本的对话功能
 * 3. createBaseAgent函数 - 创建新角色的工厂函数
 */

// 导入AgentProfile类型和创建函数
// AgentProfile定义了角色的基本信息（名字、年龄、职业等）
import { AgentProfile, createAgentProfile } from './models';

/**
 * 消息基接口，定义了所有消息类型的共同属性
 * 
 * 就像是对话中的每一条消息都有一个标准格式：
 * - 必须有内容（content）
 * - 必须有类型（type），说明是谁发的
 * - 可以有额外的信息（metadata），比如时间戳等
 */
export interface BaseMessage {
  content: string;        // 消息的具体内容，比如"你好"
  type: string;           // 消息类型，比如'human'（人类）、'ai'（人工智能）等
  metadata?: Record<string, any>;  // 可选的额外信息，用?表示这个字段可以没有
}

/**
 * 人类消息类，表示用户发送的消息
 * 
 * 当你在聊天框中输入消息并发送时，就会创建一个HumanMessage对象。
 * 就像是你在微信上发消息，每条消息都标记为"我发的"。
 */
export class HumanMessage implements BaseMessage {
  // 构造函数，创建人类消息实例
  // public关键字表示这些参数会自动成为类的属性
  constructor(public content: string, public metadata?: Record<string, any>) {}
  // 消息类型固定为'human'，表示这是人类发送的消息
  type: string = 'human';
}

/**
 * AI消息类，表示AI（智能体）发送的消息
 * 
 * 当角色回复你时，就会创建一个AIMessage对象。
 * 就像是微信上朋友回复你的消息，标记为"朋友发的"。
 */
export class AIMessage implements BaseMessage {
  constructor(public content: string, public metadata?: Record<string, any>) {}
  // 消息类型固定为'ai'，表示这是AI发送的消息
  type: string = 'ai';
}

/**
 * 系统消息类，表示系统发送的消息
 * 
 * 系统消息通常包含角色的设定信息，比如名字、职业、性格等。
 * 就像是给AI的一个提示：“你现在是一个医生，请用专业的语气回答问题”。
 * 这类消息用户看不到，但会影响AI的回复风格。
 */
export class SystemMessage implements BaseMessage {
  constructor(public content: string, public metadata?: Record<string, any>) {}
  // 消息类型固定为'system'，表示这是系统消息
  type: string = 'system';
}

/**
 * 工具消息类，表示工具调用的消息
 * 
 * 当AI需要调用外部工具（比如搜索网络、读取文件）时，会创建这种消息。
 * 就像是AI说：“我需要查一下资料”，然后去调用相应的工具。
 */
export class ToolMessage implements BaseMessage {
  constructor(public content: string, public metadata?: Record<string, any>) {}
  // 消息类型固定为'tool'，表示这是工具调用消息
  type: string = 'tool';
}

/**
 * 工具结果消息类，表示工具执行结果的消息
 * 
 * 当工具执行完毕后，会把结果封装成ToolResultMessage。
 * 就像是AI查完资料后说：“我找到了这些信息...”。
 */
export class ToolResultMessage implements BaseMessage {
  constructor(public content: string, public metadata?: Record<string, any>) {
    // 如果没有提供元数据，设置为空对象，避免后续使用时出错
    this.metadata = metadata || {};
  }
  // 消息类型固定为'tool_result'，表示这是工具执行结果
  type: string = 'tool_result';
}

/**
 * LLM模型接口，定义了模型的调用方法
 * 
 * LLM（Large Language Model）是大语言模型，比如DeepSeek、GPT等。
 * 这个接口定义了如何与这些AI模型进行通信。
 * 就像是一个遥控器，有“发送消息”和“接收回复”两个按钮。
 */
export interface LLMModel {
  // 同步调用方法 - 发送消息给AI模型，等待回复
  invoke: (messages: BaseMessage[]) => Promise<{ content: string }>;
  // 异步调用方法（可选）- 有些模型支持异步调用，性能更好
  ainvoke?: (messages: BaseMessage[]) => Promise<{ content: string }>;
}

/**
 * 基础智能体类，所有智能体的基类
 * 
 * 这个类定义了每个角色的基本属性和行为：
 * - 有唯一的ID、个人档案、AI模型
 * - 能够记住对话历史
 * - 能够响应用户的消息
 * 
 * 就像是一个人的基本能力：有身份证、有性格、能说话、能记忆。
 * 所有的具体角色（作家、医生等）都继承自这个类。
 */
export class BaseAgent {
  private agentId: string;         // 智能体唯一ID，就像身份证号，每个角色都有一个独特的ID
  private profile: AgentProfile;   // 智能体配置文件，包含名字、年龄、职业等信息
  private llmModel?: LLMModel;     // 语言模型实例，用于生成智能回复（?表示可以没有）
  private isActive: boolean;       // 智能体是否激活，true表示活跃，false表示停用
  private currentLocation: string;  // 智能体当前位置，比如在"home"（家）、"library"（图书馆）
  private currentMood: string;      // 智能体当前情绪，比如"neutral"（中性）、"happy"（开心）
  private conversationCount: number; // 对话次数，记录这个角色总共进行了多少次对话

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
   * 构造函数 - 创建智能体实例时自动调用
   * 
   * 就像是给一个新角色办理入职手续：
   * 1. 给他一个身份证号（agentId）
   * 2. 给他一个个人档案（profile）
   * 3. 给他一个AI大脑（llmModel，可选）
   * 4. 设置初始状态（位置、情绪等）
   * 
   * @param agentId 智能体ID，唯一标识这个角弌
   * @param profile 智能体配置文件，包含名字、年龄、职业等信息
   * @param llmModel 语言模型实例（可选），如果没有，角色就无法智能回复
   */
  constructor(
    agentId: string,
    profile: AgentProfile,
    llmModel?: LLMModel
  ) {
    this.agentId = agentId;  // 保存智能体ID
    this.profile = profile;  // 保存个人档案
    this.llmModel = llmModel;  // 保存AI模型（可能为undefined）
    this.isActive = true;  // 默认激活状态，角色可以正常对话
    this.currentLocation = "home";  // 默认位置为"home"（家）
    this.currentMood = "neutral";   // 默认情绪为"neutral"（中性）
    this.conversationCount = 0;     // 初始对话次数为0，还没开始对话
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
   * 响应用户消息 - 这是智能体最核心的功能
   * 
   * 当用户发送消息时，这个方法会被调用，流程如下：
   * 1. 检查是否有AI模型（llmModel）
   * 2. 从文件加载历史对话记录
   * 3. 把历史对话和当前消息合并
   * 4. 发送给AI模型生成回复
   * 5. 保存新的对话到文件
   * 6. 返回回复给用户
   * 
   * 就像是一个客服人员：
   * - 先查看之前的聊天记录（历史对话）
   * - 然后理解客户的新问题（用户消息）
   * - 思考如何回答（调用AI模型）
   * - 最后给出回复并保存记录
   * 
   * @param userMessage 用户消息内容，比如“你好”
   * @param conversationHistory 对话历史，包含之前的所有消息
   * @param kwargs 额外参数，可以包含记忆上下文、情绪上下文等
   * @returns 智能体的回复，比如“你好！有什么可以帮助你的吗？”
   */
  async respond(
    userMessage: string,
    conversationHistory: BaseMessage[],
    kwargs: Record<string, any> = {}
  ): Promise<string> {
    // 如果没有语言模型，返回系统提示
    // 这就像是角色还没有学会说话，无法回答问题
    if (!this.llmModel) {
      return "[系统] 我还没有学会说话...";
    }

    // 从文件加载历史上下文
    // 这样可以实现长期记忆，即使服务器重启，角色也能记住之前的对话
    let fileHistory: BaseMessage[] = [];
    try {
      // 动态导入RoleHistoryManager（角色历史管理器）
      // 使用import()而不是import语句，是为了避免循环依赖
      const { RoleHistoryManager } = await import('../memory/role_history_manager');
      // 创建历史管理器实例
      const roleHistoryManager = new RoleHistoryManager();
      
      // 获取文件历史，限制token数在8000以内
      // token是AI模型处理文本的基本单位，一个汉字约等于1-2个token
      // 限制token数是为了避免超出AI模型的处理能力
      fileHistory = await roleHistoryManager.getContext(this.agentId, {
        maxTokens: 8000  // 控制在8000 token以内
      });
      
      console.log(`[BaseAgent] 角色 ${this.agentId} 从文件加载了 ${fileHistory.length} 条历史消息`);
    } catch (error) {
      // 如果加载失败，记录错误并使用传入的 conversationHistory
      console.error(`[BaseAgent] 加载文件历史失败:`, error);
      fileHistory = conversationHistory;
    }
    
    // 合并文件历史和当前对话
    // ...是展开运算符，把两个数组的所有元素合并成一个新数组
    const allHistory = [...fileHistory, ...conversationHistory];

    // 格式化消息
    // 把系统提示、历史对话、当前用户消息组合成一个完整的消息数组
    const messages = this.formatMessages(
      [...allHistory, new HumanMessage(userMessage)],  // 所有历史 + 当前用户消息
      kwargs.memory_context,   // 记忆上下文（可选）
      kwargs.emotion_context   // 情绪上下文（可选）
    );

    // 调用语言模型获取回复
    // 就像是把问题交给AI大脑思考
    let response;
    if (this.llmModel.ainvoke) {
      // 如果支持异步调用，使用异步方法（性能更好）
      response = await this.llmModel.ainvoke(messages);
    } else {
      // 否则使用同步方法
      response = await this.llmModel.invoke(messages);
    }

    // 增加对话次数
    // 每回答一次问题，计数器加1
    this.conversationCount++;

    // 保存对话到文件历史
    // 这样下次对话时，角色就能记住这次的交流
    try {
      const { RoleHistoryManager } = await import('../memory/role_history_manager');
      const roleHistoryManager = new RoleHistoryManager();
      
      // 保存用户消息和助手响应
      await roleHistoryManager.addMessage(this.agentId, new HumanMessage(userMessage));
      await roleHistoryManager.addMessage(this.agentId, new AIMessage(response.content || String(response)));
      
      console.log(`[BaseAgent] 角色 ${this.agentId} 已保存对话到文件`);
    } catch (error) {
      // 如果保存失败，记录错误但不中断流程
      // 这样即使保存失败，用户也能收到回复
      console.error(`[BaseAgent] 保存文件历史失败:`, error);
    }

    // 返回回复内容
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
