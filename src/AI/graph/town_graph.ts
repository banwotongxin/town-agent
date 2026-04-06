// 导入智能体相关类和函数
import { BaseMessage, HumanMessage, AIMessage, BaseAgent, createBaseAgent } from '../agents/base_agent';
import { AgentGraph, AgentState } from './agent_graph';
import { DualMemorySystem, createMemorySystem } from '../memory/dual_memory';
import { DEFAULT_PROFILES } from '../agents/models';
import { getSkillRegistry as getRealSkillRegistry } from '../skills/skill_system';

/**
 * 小镇状态接口，定义了小镇的状态
 */
export interface TownState {
  user_input: string;           // 用户输入
  target_agent_id: string;      // 目标智能体ID
  selected_agent_id: string;    // 选中的智能体ID
  agent_response: string;       // 智能体响应
  conversation_history: BaseMessage[]; // 对话历史
  should_continue: boolean;     // 是否继续处理
}

/**
 * 技能注册表接口，定义了技能管理的方法
 */
export interface SkillRegistry {
  get_all_skills: () => any[];            // 获取所有技能
  cleanup_all: () => Promise<void>;       // 清理所有技能
  findMatchingSkills: (input: string) => any[];  // 查找匹配的技能
  getSkill: (name: string) => any;        // 获取技能
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
 * 获取技能注册表
 * @returns 技能注册表实例
 */
export function getSkillRegistry(): SkillRegistry {
  // 使用真实的技能注册表
  const realRegistry = getRealSkillRegistry();
  
  return {
    get_all_skills: () => realRegistry.getAllSkills(),
    cleanup_all: () => realRegistry.cleanupAll(),
    findMatchingSkills: (input: string) => realRegistry.findMatchingSkills(input),
    getSkill: (name: string) => realRegistry.getSkill(name)
  };
}

/**
 * 获取情感引擎
 * @returns 情感引擎实例
 */
export function getEmotionEngine(): EmotionEngine {
  return {
    getRelationshipInfo: (agentId1: string, agentId2: string) => null,
    getConversationStyleHint: (level: any) => "",
    interact: (params: any) => { return { level_changed: false }; }
  };
}

/**
 * 小镇编排器类，管理小镇中的智能体和交互
 */
export class TownOrchestrator {
  private townName: string;                // 小镇名称
  private agents: Record<string, BaseAgent>;       // 智能体集合
  private agentGraphs: Record<string, AgentGraph>;  // 智能体图集合
  private agentMemories: Record<string, DualMemorySystem>; // 智能体记忆系统
  private skillRegistry: SkillRegistry;     // 技能注册表
  private emotionEngine: EmotionEngine;     // 情感引擎
  private state: TownState;                // 小镇状态

  /**
   * 获取小镇名称
   */
  get TownName(): string {
    return this.townName;
  }

  /**
   * 获取智能体集合
   */
  get Agents(): Record<string, BaseAgent> {
    return this.agents;
  }

  /**
   * 构造函数
   * @param townName 小镇名称（默认"赛博小镇"）
   */
  constructor(townName: string = "赛博小镇") {
    this.townName = townName;
    this.agents = {};
    this.agentGraphs = {};
    this.agentMemories = {};
    this.skillRegistry = getSkillRegistry();
    this.emotionEngine = getEmotionEngine();

    // 初始化状态
    this.state = {
      user_input: "",
      target_agent_id: "",
      selected_agent_id: "",
      agent_response: "",
      conversation_history: [],
      should_continue: true
    };
  }

  /**
   * 添加智能体
   * @param agent 智能体实例
   * @param memoryWindow 记忆窗口大小（默认5）
   */
  addAgent(agent: BaseAgent, memoryWindow: number = 5): void {
    this.agents[agent.AgentId] = agent;

    // 创建智能体的记忆系统
    const memory = createMemorySystem(
      agent.AgentId,
      memoryWindow
    );
    this.agentMemories[agent.AgentId] = memory;
  }

  /**
   * 移除智能体
   * @param agentId 智能体ID
   * @returns 是否成功移除
   */
  removeAgent(agentId: string): boolean {
    if (agentId in this.agents) {
      delete this.agents[agentId];

      // 清理相关资源
      if (agentId in this.agentGraphs) {
        delete this.agentGraphs[agentId];
      }

      if (agentId in this.agentMemories) {
        delete this.agentMemories[agentId];
      }

      return true;
    }
    return false;
  }

  /**
   * 获取智能体
   * @param agentId 智能体ID
   * @returns 智能体实例或undefined
   */
  getAgent(agentId: string): BaseAgent | undefined {
    return this.agents[agentId];
  }

  /**
   * 列出所有智能体
   * @returns 智能体状态数组
   */
  listAgents(): Record<string, any>[] {
    return Object.values(this.agents).map(agent => agent.getStatus());
  }

  /**
   * 获取或创建智能体图
   * @param agentId 智能体ID
   * @param otherAgentId 其他智能体ID
   * @returns 智能体图实例或null
   */
  private getOrCreateAgentGraph(agentId: string, otherAgentId: string): AgentGraph | null {
    if (agentId in this.agentGraphs) {
      return this.agentGraphs[agentId];
    }

    if (!(agentId in this.agents)) {
      return null;
    }

    const agent = this.agents[agentId];
    const memory = this.agentMemories[agentId];

    // 创建智能体图
    const graph = new AgentGraph(
      agent,
      memory,
      this.skillRegistry as any,
      this.emotionEngine as any,
      otherAgentId
    );

    this.agentGraphs[agentId] = graph;
    return graph;
  }

  /**
   * 分发节点
   * @param state 小镇状态
   * @returns 更新后的状态
   */
  async dispatchNode(state: TownState): Promise<TownState> {
    if (!state.target_agent_id) {
      const agentIds = Object.keys(this.agents);
      if (agentIds.length > 0) {
        state.selected_agent_id = agentIds[0];
      } else {
        state.selected_agent_id = "";
      }
    } else {
      state.selected_agent_id = state.target_agent_id;
    }

    return state;
  }

  /**
   * 路由到智能体节点
   * @param state 小镇状态
   * @returns 更新后的状态
   */
  async routeToAgentNode(state: TownState): Promise<TownState> {
    const agentId = state.selected_agent_id;

    if (!agentId) {
      state.agent_response = "[系统] 小镇还没有居民...";
      return state;
    }

    const graph = this.getOrCreateAgentGraph(agentId, "user");

    if (!graph) {
      state.agent_response = `[系统] 找不到居民 ${agentId}`;
      return state;
    }

    // 处理消息
    const result = await graph.processMessage(
      state.user_input,
      state.conversation_history
    );

    state.agent_response = result.response;

    // 更新对话历史
    state.conversation_history.push(new HumanMessage(state.user_input));
    state.conversation_history.push(new AIMessage(result.response));

    return state;
  }

  /**
   * 判断是否继续
   * @param state 小镇状态
   * @returns 路由方向
   */
  shouldContinue(state: TownState): string {
    return state.should_continue ? "continue" : "end";
  }

  /**
   * 聊天
   * @param userInput 用户输入
   * @param targetAgentId 目标智能体ID（可选）
   * @param conversationHistory 对话历史（可选）
   * @returns 聊天结果
   */
  async chat(
    userInput: string,
    targetAgentId?: string,
    conversationHistory?: BaseMessage[]
  ): Promise<Record<string, any>> {
    // 初始化状态
    this.state = {
      user_input: userInput,
      target_agent_id: targetAgentId || "",
      selected_agent_id: "",
      agent_response: "",
      conversation_history: conversationHistory || [],
      should_continue: true
    };

    let state = this.state;

    // 分发和路由
    state = await this.dispatchNode(state);
    state = await this.routeToAgentNode(state);

    this.state = state;

    return {
      response: state.agent_response,
      agent_id: state.selected_agent_id,
      agent_name: this.agents[state.selected_agent_id]?.Profile.name || "",
      conversation_history: state.conversation_history
    };
  }

  /**
   * 多智能体聊天
   * @param topic 话题
   * @param participantIds 参与者ID数组
   * @param maxRounds 最大轮数（默认3）
   * @returns 聊天记录
   */
  async multiAgentChat(
    topic: string,
    participantIds: string[],
    maxRounds: number = 3
  ): Promise<Record<string, any>[]> {
    if (participantIds.length < 2) {
      return [{ error: "至少需要两个智能体" }];
    }

    const records: Record<string, any>[] = [];
    let currentTopic = topic;

    // 多轮对话
    for (let roundNum = 0; roundNum < maxRounds; roundNum++) {
      for (let i = 0; i < participantIds.length; i++) {
        const agentId = participantIds[i];
        const prevAgentId = i > 0 ? participantIds[i - 1] : "user";

        const graph = this.getOrCreateAgentGraph(agentId, prevAgentId);

        if (!graph) {
          continue;
        }

        // 处理消息
        const result = await graph.processMessage(
          currentTopic,
          []
        );

        // 记录结果
        records.push({
          round: roundNum + 1,
          agent_id: agentId,
          agent_name: this.agents[agentId]?.Profile.name || "",
          response: result.response
        });

        // 更新话题
        currentTopic = result.response;
      }
    }

    return records;
  }

  /**
   * 获取小镇状态
   * @returns 小镇状态对象
   */
  getTownStatus(): Record<string, any> {
    return {
      town_name: this.townName,
      agent_count: Object.keys(this.agents).length,
      agents: this.listAgents(),
      skill_count: this.skillRegistry.get_all_skills().length
    };
  }

  /**
   * 清理资源
   */
  async cleanup(): Promise<void> {
    await this.skillRegistry.cleanup_all();

    // 清理所有 MCP
    // 暂时跳过，后续实现
  }
}

/**
 * 创建小镇编排器
 * @param townName 小镇名称（默认"赛博小镇"）
 * @param agents 智能体数组（可选）
 * @returns 小镇编排器实例
 */
export function createTownOrchestrator(
  townName: string = "赛博小镇",
  agents?: BaseAgent[]
): TownOrchestrator {
  const orchestrator = new TownOrchestrator(townName);

  if (agents) {
    for (const agent of agents) {
      orchestrator.addAgent(agent);
    }
  }

  return orchestrator;
}

/**
 * 创建默认小镇
 * @param numAgents 智能体数量（默认4）
 * @returns 小镇编排器实例
 */
export async function createDefaultTown(numAgents: number = 4): Promise<TownOrchestrator> {
  const orchestrator = new TownOrchestrator("赛博小镇");

  // 使用默认配置创建智能体
  const profileKeys = Object.keys(DEFAULT_PROFILES);
  const selectedProfiles = profileKeys.slice(0, numAgents);

  for (const key of selectedProfiles) {
    const profile = DEFAULT_PROFILES[key];
    const agent = createBaseAgent(
      profile.name,
      profile.profession,
      `agent_${key}`,
      {
        age: profile.age,
        personality: profile.personality,
        background: profile.background
      }
    );
    // 手动设置爱好和说话风格
    (agent as any).profile.hobbies = profile.hobbies;
    (agent as any).profile.speech_style = profile.speech_style;
    (agent as any).profile.appearance = profile.appearance;
    orchestrator.addAgent(agent);
  }

  return orchestrator;
}
