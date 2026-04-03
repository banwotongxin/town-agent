import { BaseMessage, HumanMessage, AIMessage, BaseAgent, createBaseAgent } from '../agents/base_agent';
import { AgentGraph, AgentState } from './agent_graph';
import { DualMemorySystem, createMemorySystem } from '../memory/dual_memory';
import { DEFAULT_PROFILES } from '../agents/models';

export interface TownState {
  user_input: string;
  target_agent_id: string;
  selected_agent_id: string;
  agent_response: string;
  conversation_history: BaseMessage[];
  should_continue: boolean;
}

export interface SkillRegistry {
  get_all_skills: () => any[];
  cleanup_all: () => Promise<void>;
  findMatchingSkills: (input: string) => any[];
  getSkill: (name: string) => any;
}

export interface EmotionEngine {
  getRelationshipInfo: (agentId1: string, agentId2: string) => any;
  getConversationStyleHint: (level: any) => string;
  interact: (params: any) => any;
}

export function getSkillRegistry(): SkillRegistry {
  return {
    get_all_skills: () => [],
    cleanup_all: async () => {},
    findMatchingSkills: (input: string) => [],
    getSkill: (name: string) => null
  };
}

export function getEmotionEngine(): EmotionEngine {
  return {
    getRelationshipInfo: (agentId1: string, agentId2: string) => null,
    getConversationStyleHint: (level: any) => "",
    interact: (params: any) => { return { level_changed: false }; }
  };
}

export class TownOrchestrator {
  private townName: string;
  private agents: Record<string, BaseAgent>;
  private agentGraphs: Record<string, AgentGraph>;
  private agentMemories: Record<string, DualMemorySystem>;
  private skillRegistry: SkillRegistry;
  private emotionEngine: EmotionEngine;
  private state: TownState;

  get TownName(): string {
    return this.townName;
  }

  get Agents(): Record<string, BaseAgent> {
    return this.agents;
  }

  constructor(townName: string = "赛博小镇") {
    this.townName = townName;
    this.agents = {};
    this.agentGraphs = {};
    this.agentMemories = {};
    this.skillRegistry = getSkillRegistry();
    this.emotionEngine = getEmotionEngine();

    this.state = {
      user_input: "",
      target_agent_id: "",
      selected_agent_id: "",
      agent_response: "",
      conversation_history: [],
      should_continue: true
    };
  }

  addAgent(agent: BaseAgent, memoryWindow: number = 5): void {
    this.agents[agent.AgentId] = agent;

    const memory = createMemorySystem(
      agent.AgentId,
      memoryWindow
    );
    this.agentMemories[agent.AgentId] = memory;
  }

  removeAgent(agentId: string): boolean {
    if (agentId in this.agents) {
      delete this.agents[agentId];

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

  getAgent(agentId: string): BaseAgent | undefined {
    return this.agents[agentId];
  }

  listAgents(): Record<string, any>[] {
    return Object.values(this.agents).map(agent => agent.getStatus());
  }

  private getOrCreateAgentGraph(agentId: string, otherAgentId: string): AgentGraph | null {
    if (agentId in this.agentGraphs) {
      return this.agentGraphs[agentId];
    }

    if (!(agentId in this.agents)) {
      return null;
    }

    const agent = this.agents[agentId];
    const memory = this.agentMemories[agentId];

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

    const result = await graph.processMessage(
      state.user_input,
      state.conversation_history
    );

    state.agent_response = result.response;

    state.conversation_history.push(new HumanMessage(state.user_input));
    state.conversation_history.push(new AIMessage(result.response));

    return state;
  }

  shouldContinue(state: TownState): string {
    return state.should_continue ? "continue" : "end";
  }

  async chat(
    userInput: string,
    targetAgentId?: string,
    conversationHistory?: BaseMessage[]
  ): Promise<Record<string, any>> {
    this.state = {
      user_input: userInput,
      target_agent_id: targetAgentId || "",
      selected_agent_id: "",
      agent_response: "",
      conversation_history: conversationHistory || [],
      should_continue: true
    };

    let state = this.state;

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

    for (let roundNum = 0; roundNum < maxRounds; roundNum++) {
      for (let i = 0; i < participantIds.length; i++) {
        const agentId = participantIds[i];
        const prevAgentId = i > 0 ? participantIds[i - 1] : "user";

        const graph = this.getOrCreateAgentGraph(agentId, prevAgentId);

        if (!graph) {
          continue;
        }

        const result = await graph.processMessage(
          currentTopic,
          []
        );

        records.push({
          round: roundNum + 1,
          agent_id: agentId,
          agent_name: this.agents[agentId]?.Profile.name || "",
          response: result.response
        });

        currentTopic = result.response;
      }
    }

    return records;
  }

  getTownStatus(): Record<string, any> {
    return {
      town_name: this.townName,
      agent_count: Object.keys(this.agents).length,
      agents: this.listAgents(),
      skill_count: this.skillRegistry.get_all_skills().length
    };
  }

  async cleanup(): Promise<void> {
    await this.skillRegistry.cleanup_all();

    // 清理所有 MCP
    // 暂时跳过，后续实现
  }
}

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
