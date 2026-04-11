/**
 * 赛博小镇 - 小镇图谱系统
 * 
 * 这个文件是整个小镇的核心管理系统，负责：
 * 1. 管理所有角色（智能体）的创建、添加、删除
 * 2. 处理用户与角色的对话流程
 * 3. 支持多角色之间的群聊
 * 4. 集成记忆系统、技能系统、情感系统
 * 
 * 就像是一个小镇的市长办公室：
 * - 管理所有居民（角色）
 * - 安排居民与访客（用户）的会面
 * - 组织居民之间的交流活动
 * - 记录每个居民的记忆和技能
 */

// 导入智能体相关类和函数
// BaseMessage: 消息类型定义
// HumanMessage: 人类消息
// AIMessage: AI消息
// BaseAgent: 基础智能体类
// createBaseAgent: 创建智能体的工厂函数
import { BaseMessage, HumanMessage, AIMessage, BaseAgent, createBaseAgent } from '../agents/base_agent';
// AgentGraph: 智能体图谱，处理单个智能体的对话逻辑
import { AgentGraph } from './agent_graph';
// DualMemorySystem: 双重记忆系统（短期记忆+长期记忆）
import { DualMemorySystem, createMemorySystem } from '../memory/dual_memory';
// DEFAULT_PROFILES: 8个默认角色的配置
import { DEFAULT_PROFILES } from '../agents/models';
// getSkillRegistry: 获取技能注册表
import { getSkillRegistry as getRealSkillRegistry } from '../skills/skill_system';

/**
 * 小镇状态接口，定义了小镇的当前状态
 * 
 * 这个接口描述了小镇在处理用户请求时的所有相关信息。
 * 就像是一个表单，记录了：
 * - 用户说了什么（user_input）
 * - 用户想和谁对话（target_agent_id）
 * - 实际选择了哪个角色（selected_agent_id）
 * - 角色的回复是什么（agent_response）
 * - 完整的对话历史（conversation_history）
 */
export interface TownState {
  user_input: string;           // 用户输入的消息内容
  target_agent_id: string;      // 用户想要对话的目标角色ID
  selected_agent_id: string;    // 实际选中的角色ID（可能与目标不同）
  agent_response: string;       // 角色的回复内容
  conversation_history: BaseMessage[]; // 完整的对话历史记录
  should_continue: boolean;     // 是否继续对话流程（true=继续，false=结束）
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
 * 
 * 这是整个小镇的核心管理类，负责协调所有角色和系统。
 * 
 * 主要功能：
 * 1. 添加/删除角色（addAgent/removeAgent）
 * 2. 处理用户与角色的对话（chat方法）
 * 3. 支持多角色群聊（multiAgentChat方法）
 * 4. 管理每个角色的记忆、技能、情感系统
 * 
 * 就像是一个小镇的管理中心：
 * - 有居民名单（agents）
 * - 有每个居民的档案（agentGraphs）
 * - 有居民的记忆库（agentMemories）
 * - 有技能培训中心（skillRegistry）
 * - 有情感咨询师（emotionEngine）
 */
export class TownOrchestrator {
  private townName: string;                // 小镇名称，比如“赛博小镇”
  private agents: Record<string, BaseAgent>;       // 所有角色的集合，键是角色ID，值是角色对象
  private agentGraphs: Record<string, AgentGraph>;  // 每个角色的图谱，用于处理对话逻辑
  private agentMemories: Record<string, DualMemorySystem>; // 每个角色的记忆系统
  private skillRegistry: SkillRegistry;     // 技能注册表，管理所有可用技能
  private emotionEngine: EmotionEngine;     // 情感引擎，管理角色间的情感关系
  private state: TownState;                // 小镇的当前状态

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
   * 构造函数 - 创建小镇编排器实例
   * 
   * 就像是建立一个新的小镇管理中心：
   * 1. 给小镇起个名字（默认“赛博小镇”）
   * 2. 初始化居民名单（空列表）
   * 3. 准备档案室（agentGraphs）
   * 4. 准备记忆库（agentMemories）
   * 5. 连接技能中心（skillRegistry）
   * 6. 连接情感咨询室（emotionEngine）
   * 7. 设置初始状态
   * 
   * @param townName 小镇名称，默认为“赛博小镇”
   */
  constructor(townName: string = "赛博小镇") {
    this.townName = townName;  // 保存小镇名称
    this.agents = {};  // 初始化空的角色集合
    this.agentGraphs = {};  // 初始化空的图谱集合
    this.agentMemories = {};  // 初始化空的记忆系统集合
    this.skillRegistry = getSkillRegistry();  // 获取技能注册表实例
    this.emotionEngine = getEmotionEngine();  // 获取情感引擎实例
  
    // 初始化小镇状态
    this.state = {
      user_input: "",  // 初始用户输入为空
      target_agent_id: "",  // 初始目标角色为空
      selected_agent_id: "",  // 初始选中角色为空
      agent_response: "",  // 初始回复为空
      conversation_history: [],  // 初始对话历史为空数组
      should_continue: true  // 默认继续处理
    };
  }

  /**
   * 添加智能体 - 向小镇添加一个新角色
   * 
   * 就像是为小镇招募一个新居民：
   * 1. 把角色加入居民名单（agents）
   * 2. 为角色创建记忆系统（用于记住对话）
   * 3. 设置记忆窗口大小（默认保留最近5条对话）
   * 
   * @param agent 要添加的角色实例
   * @param memoryWindow 记忆窗口大小，默认5，表示保留最近5条对话在短期记忆中
   */
  addAgent(agent: BaseAgent, memoryWindow: number = 5): void {
    // 将角色添加到居民名单中，键是角色ID
    this.agents[agent.AgentId] = agent;

    // 为角色创建记忆系统
    // 记忆系统包括短期记忆（最近对话）和长期记忆（向量数据库）
    const memory = createMemorySystem(
      agent.AgentId,  // 角色ID，用于区分不同角色的记忆
      memoryWindow    // 记忆窗口大小
    );
    // 保存角色的记忆系统
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
   * 分发节点 - 确定要和哪个角色对话
   * 
   * 这个方法的职责很简单：
   * 1. 如果用户指定了目标角色（target_agent_id不为空），就使用指定的角色
   * 2. 如果用户没有指定角色（target_agent_id为空），就选择第一个可用角色
   * 
   * @param state 小镇状态，包含用户输入和目标角色ID
   * @returns 更新后的状态，包含选中的角色ID
   */
  async dispatchNode(state: TownState): Promise<TownState> {
    // 情况1：用户明确指定了目标角色
    if (state.target_agent_id) {
      // 直接使用用户指定的角色ID
      state.selected_agent_id = state.target_agent_id;
    } 
    // 情况2：用户没有指定角色
    else {
      // 获取所有可用的角色ID列表
      const agentIds = Object.keys(this.agents);
      
      // 如果有可用角色，选择第一个；否则设为空字符串
      if (agentIds.length > 0) {
        state.selected_agent_id = agentIds[0];
      } else {
        state.selected_agent_id = "";
      }
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
   * 聊天 - 处理用户与角色的对话
   * 
   * 这是小镇最核心的功能，当用户发送消息时，会调用这个方法。
   * 
   * 工作流程：
   * 1. 初始化小镇状态（记录用户输入、目标角色等）
   * 2. 分发节点（dispatchNode）- 确定要和哪个角色对话
   * 3. 路由到角色节点（routeToAgentNode）- 调用角色的respond方法生成回复
   * 4. 返回回复给用户
   * 
   * 就像是一个接待员：
   * - 接收访客的问题
   * - 确定应该由哪位居民回答
   * - 安排会面并获取回答
   * - 把回答转告给访客
   * 
   * @param userInput 用户输入的消息，比如“你好”
   * @param targetAgentId 目标角色ID（可选），如果不指定，会自动选择第一个角色
   * @param conversationHistory 对话历史（可选），包含之前的对话记录
   * @returns 包含回复内容、角色ID、角色名、对话历史的对象
   */
  async chat(
    userInput: string,
    targetAgentId?: string,
    conversationHistory?: BaseMessage[]
  ): Promise<Record<string, any>> {
    // 初始化小镇状态
    // 就像是填写一个接待表单
    this.state = {
      user_input: userInput,  // 记录用户说的话
      target_agent_id: targetAgentId || "",  // 记录用户想和谁对话（如果没有则为空）
      selected_agent_id: "",  // 实际选中的角色（稍后确定）
      agent_response: "",  // 角色的回复（稍后填充）
      conversation_history: conversationHistory || [],  // 对话历史（如果没有则为空数组）
      should_continue: true  // 默认继续处理流程
    };

    let state = this.state;  // 获取当前状态

    // 第一步：分发节点 - 确定要和哪个角色对话
    // 如果用户指定了目标角色，就使用指定的；否则自动选择第一个角色
    state = await this.dispatchNode(state);
    
    // 第二步：路由到角色节点 - 调用角色的respond方法生成回复
    // 这里会加载角色的记忆、技能，然后调用AI模型生成回复
    state = await this.routeToAgentNode(state);

    // 更新小镇状态
    this.state = state;

    // 返回结果
    return {
      response: state.agent_response,  // 角色的回复内容
      agent_id: state.selected_agent_id,  // 实际对话的角色ID
      agent_name: this.agents[state.selected_agent_id]?.Profile.name || "",  // 角色名字
      conversation_history: state.conversation_history  // 更新后的对话历史
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
