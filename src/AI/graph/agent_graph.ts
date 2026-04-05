// 导入消息相关类和双记忆系统
import { BaseMessage, HumanMessage, AIMessage, SystemMessage } from '../agents/base_agent';
import { DualMemorySystem } from '../memory/dual_memory';

/**
 * 智能体状态接口，定义了智能体图的状态
 */
export interface AgentState {
  messages: BaseMessage[];      // 消息历史
  user_input: string;           // 用户输入
  agent_response: string;       // 智能体响应
  memory_context: string;       // 记忆上下文
  emotion_context: string;      // 情感上下文
  matched_skills: string[];     // 匹配的技能
  should_continue: boolean;     // 是否继续处理
}

/**
 * 技能注册表接口，定义了技能管理的方法
 */
export interface SkillRegistry {
  findMatchingSkills: (input: string) => any[];  // 查找匹配的技能
  getSkill: (name: string) => any;              // 获取技能
}

/**
 * 情感引擎接口，定义了情感管理的方法
 */
export interface EmotionEngine {
  getRelationshipInfo: (agentId1: string, agentId2: string) => any;  // 获取关系信息
  getConversationStyleHint: (level: any) => string;                 // 获取对话风格提示
  interact: (params: any) => any;                                  // 互动
}

/**
 * 情感等级类
 */
export class EmotionLevel {
  /**
   * 根据情感分数获取情感等级
   * @param score 情感分数
   * @returns 情感等级实例
   */
  static fromScore(score: number): EmotionLevel {
    return new EmotionLevel();
  }
}

/**
 * 智能体图类，管理智能体的交互流程
 */
export class AgentGraph {
  private agent: any;               // 智能体实例
  private memory: DualMemorySystem;  // 双记忆系统
  private skills: SkillRegistry;     // 技能注册表
  private emotion: EmotionEngine;    // 情感引擎
  private otherAgentId: string;      // 其他智能体ID
  private state: AgentState;         // 智能体状态

  /**
   * 构造函数
   * @param agent 智能体实例
   * @param memorySystem 双记忆系统
   * @param skillRegistry 技能注册表
   * @param emotionEngine 情感引擎
   * @param otherAgentId 其他智能体ID
   */
  constructor(
    agent: any,
    memorySystem: DualMemorySystem,
    skillRegistry: SkillRegistry,
    emotionEngine: EmotionEngine,
    otherAgentId: string
  ) {
    this.agent = agent;
    this.memory = memorySystem;
    this.skills = skillRegistry;
    this.emotion = emotionEngine;
    this.otherAgentId = otherAgentId;

    // 初始化状态
    this.state = {
      messages: [],
      user_input: "",
      agent_response: "",
      memory_context: "",
      emotion_context: "",
      matched_skills: [],
      should_continue: true
    };
  }

  /**
   * 加载档案节点
   * @param state 智能体状态
   * @returns 更新后的状态
   */
  async loadProfileNode(state: AgentState): Promise<AgentState> {
    return state;
  }

  /**
   * 检查压缩节点
   * @param state 智能体状态
   * @returns 更新后的状态
   */
  async checkCompressNode(state: AgentState): Promise<AgentState> {
    return state;
  }

  /**
   * 查询记忆节点
   * @param state 智能体状态
   * @returns 更新后的状态
   */
  async queryMemoryNode(state: AgentState): Promise<AgentState> {
    const context = await this.memory.getContext(state.user_input);
    state.memory_context = context;
    return state;
  }

  /**
   * 技能匹配节点
   * @param state 智能体状态
   * @returns 更新后的状态
   */
  async skillMatchNode(state: AgentState): Promise<AgentState> {
    const matched = this.skills.findMatchingSkills(state.user_input);
    state.matched_skills = matched.map((skill: any) => skill.manifest.name);
    return state;
  }

  /**
   * 注入情感上下文节点
   * @param state 智能体状态
   * @returns 更新后的状态
   */
  async injectEmotionContextNode(state: AgentState): Promise<AgentState> {
    const relationship = this.emotion.getRelationshipInfo(
      (this.agent as any).agentId,
      this.otherAgentId
    );

    if (relationship) {
      const level = EmotionLevel.fromScore(relationship.emotion_score);
      const styleHint = this.emotion.getConversationStyleHint(level);

      state.emotion_context = `
[与${this.otherAgentId}的关系]
等级：${relationship.level_name}
分数：${relationship.emotion_score.toFixed(1)}
互动次数：${relationship.interaction_count}
${styleHint}
`;
    } else {
      state.emotion_context = "";
    }

    return state;
  }

  /**
   * 加载MCP节点
   * @param state 智能体状态
   * @returns 更新后的状态
   */
  async loadMcpNode(state: AgentState): Promise<AgentState> {
    for (const skillName of state.matched_skills) {
      const skill = this.skills.getSkill(skillName);
      if (skill && skill.manifest.mcp_dependencies) {
        // 加载 MCP 依赖
      }
    }

    return state;
  }

  /**
   * 调用LLM节点
   * @param state 智能体状态
   * @returns 更新后的状态
   */
  async invokeLlmNode(state: AgentState): Promise<AgentState> {
    const messages = [...state.messages, new HumanMessage(state.user_input)];

    let systemPrompt = (this.agent as any).getSystemPrompt();

    // 添加记忆上下文
    if (state.memory_context) {
      systemPrompt += `\n\n${state.memory_context}`;
    }

    // 添加情感上下文
    if (state.emotion_context) {
      systemPrompt += `\n${state.emotion_context}`;
    }

    // 添加技能系统提示
    for (const skillName of state.matched_skills) {
      const skill = this.skills.getSkill(skillName);
      if (skill) {
        systemPrompt += skill.getSystemPrompt();
      }
    }

    // 调用语言模型
    if ((this.agent as any).llmModel) {
      const fullMessages = [new SystemMessage(systemPrompt), ...messages];
      const response = await (this.agent as any).llmModel.invoke(fullMessages);
      state.agent_response = response.content || String(response);
    } else {
      state.agent_response = "[系统] 我还没有学会说话...";
    }

    return state;
  }

  /**
   * 保存记忆节点
   * @param state 智能体状态
   * @returns 更新后的状态
   */
  async saveMemoryNode(state: AgentState): Promise<AgentState> {
    // 不再将对话保存到长期记忆（ChromaDB）
    // 对话历史由 Session Memory 管理
    console.log(`[记忆] 对话已保存到会话记忆，未存入长期记忆`);

    return state;
  }

  /**
   * 评估情感节点
   * @param state 智能体状态
   * @returns 更新后的状态
   */
  async evaluateEmotionNode(state: AgentState): Promise<AgentState> {
    const result = this.emotion.interact({
      agent_a_id: (this.agent as any).agentId,
      agent_b_id: this.otherAgentId,
      interaction_type: "conversation",
      sentiment: "positive"
    });

    // 如果关系等级变化，保存重要事件
    if (result.level_changed) {
      const eventDesc = `与${this.otherAgentId}的关系提升到${result.new_level}`;
      this.memory.saveImportantEvent(eventDesc, 0.9);
    }

    return state;
  }

  /**
   * 路由判断
   * @param state 智能体状态
   * @returns 路由方向
   */
  shouldRoute(state: AgentState): string {
    return state.should_continue ? "continue" : "end";
  }

  /**
   * 处理消息
   * @param userInput 用户输入
   * @param conversationHistory 对话历史（可选）
   * @returns 处理结果
   */
  async processMessage(
    userInput: string,
    conversationHistory?: BaseMessage[]
  ): Promise<Record<string, any>> {
    // 初始化状态
    this.state = {
      messages: conversationHistory || [],
      user_input: userInput,
      agent_response: "",
      memory_context: "",
      emotion_context: "",
      matched_skills: [],
      should_continue: true
    };

    let state = this.state;

    // 1. 中间件前置检查
    // 暂时跳过，后续实现

    // 2. 加载档案
    state = await this.loadProfileNode(state);

    // 3. 查询记忆
    state = await this.queryMemoryNode(state);

    // 4. 匹配技能
    state = await this.skillMatchNode(state);

    // 5. 中间件工具检查
    // 暂时跳过，后续实现

    // 6. 注入情感上下文
    state = await this.injectEmotionContextNode(state);

    // 7. 加载 MCP（如果需要）
    state = await this.loadMcpNode(state);

    // 8. 调用 LLM
    state = await this.invokeLlmNode(state);

    // 9. 中间件后置检查
    // 暂时跳过，后续实现

    // 10. 保存记忆
    state = await this.saveMemoryNode(state);

    // 11. 评估情感
    state = await this.evaluateEmotionNode(state);

    this.state = state;

    return {
      response: state.agent_response,
      matched_skills: state.matched_skills,
      memory_state: this.memory.getState()
    };
  }

  /**
   * 获取智能体图状态
   * @returns 状态对象
   */
  getState(): Record<string, any> {
    return {
      agent: (this.agent as any).getStatus(),
      memory: this.memory.getState(),
      other_agent_id: this.otherAgentId
    };
  }
}

/**
 * 创建智能体图
 * @param agent 智能体实例
 * @param memorySystem 双记忆系统
 * @param skillRegistry 技能注册表
 * @param emotionEngine 情感引擎
 * @param otherAgentId 其他智能体ID
 * @returns 智能体图实例
 */
export async function createAgentGraph(
  agent: any,
  memorySystem: DualMemorySystem,
  skillRegistry: SkillRegistry,
  emotionEngine: EmotionEngine,
  otherAgentId: string
): Promise<AgentGraph> {
  return new AgentGraph(
    agent,
    memorySystem,
    skillRegistry,
    emotionEngine,
    otherAgentId
  );
}
