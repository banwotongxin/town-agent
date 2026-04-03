import { BaseMessage, HumanMessage, AIMessage, SystemMessage } from '../agents/base_agent';
import { DualMemorySystem } from '../memory/dual_memory';

export interface AgentState {
  messages: BaseMessage[];
  user_input: string;
  agent_response: string;
  memory_context: string;
  emotion_context: string;
  matched_skills: string[];
  should_continue: boolean;
}

export interface SkillRegistry {
  findMatchingSkills: (input: string) => any[];
  getSkill: (name: string) => any;
}

export interface EmotionEngine {
  getRelationshipInfo: (agentId1: string, agentId2: string) => any;
  getConversationStyleHint: (level: any) => string;
  interact: (params: any) => any;
}

export class EmotionLevel {
  static fromScore(score: number): EmotionLevel {
    return new EmotionLevel();
  }
}

export class AgentGraph {
  private agent: any;
  private memory: DualMemorySystem;
  private skills: SkillRegistry;
  private emotion: EmotionEngine;
  private otherAgentId: string;
  private state: AgentState;

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

  async loadProfileNode(state: AgentState): Promise<AgentState> {
    return state;
  }

  async checkCompressNode(state: AgentState): Promise<AgentState> {
    return state;
  }

  async queryMemoryNode(state: AgentState): Promise<AgentState> {
    const context = this.memory.getContext(state.user_input);
    state.memory_context = context;
    return state;
  }

  async skillMatchNode(state: AgentState): Promise<AgentState> {
    const matched = this.skills.findMatchingSkills(state.user_input);
    state.matched_skills = matched.map((skill: any) => skill.manifest.name);
    return state;
  }

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

  async loadMcpNode(state: AgentState): Promise<AgentState> {
    for (const skillName of state.matched_skills) {
      const skill = this.skills.getSkill(skillName);
      if (skill && skill.manifest.mcp_dependencies) {
        // 加载 MCP 依赖
      }
    }

    return state;
  }

  async invokeLlmNode(state: AgentState): Promise<AgentState> {
    const messages = [...state.messages, new HumanMessage(state.user_input)];

    let systemPrompt = (this.agent as any).getSystemPrompt();

    if (state.memory_context) {
      systemPrompt += `\n\n${state.memory_context}`;
    }

    if (state.emotion_context) {
      systemPrompt += `\n${state.emotion_context}`;
    }

    for (const skillName of state.matched_skills) {
      const skill = this.skills.getSkill(skillName);
      if (skill) {
        systemPrompt += skill.getSystemPrompt();
      }
    }

    if ((this.agent as any).llmModel) {
      const fullMessages = [new SystemMessage(systemPrompt), ...messages];
      const response = await (this.agent as any).llmModel.invoke(fullMessages);
      state.agent_response = response.content || String(response);
    } else {
      state.agent_response = "[系统] 我还没有学会说话...";
    }

    return state;
  }

  async saveMemoryNode(state: AgentState): Promise<AgentState> {
    this.memory.addMessage(new HumanMessage(state.user_input));

    if (state.agent_response) {
      this.memory.addMessage(new AIMessage(state.agent_response));
    }

    return state;
  }

  async evaluateEmotionNode(state: AgentState): Promise<AgentState> {
    const result = this.emotion.interact({
      agent_a_id: (this.agent as any).agentId,
      agent_b_id: this.otherAgentId,
      interaction_type: "conversation",
      sentiment: "positive"
    });

    if (result.level_changed) {
      const eventDesc = `与${this.otherAgentId}的关系提升到${result.new_level}`;
      this.memory.saveImportantEvent(eventDesc, 0.9);
    }

    return state;
  }

  shouldRoute(state: AgentState): string {
    return state.should_continue ? "continue" : "end";
  }

  async processMessage(
    userInput: string,
    conversationHistory?: BaseMessage[]
  ): Promise<Record<string, any>> {
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

  getState(): Record<string, any> {
    return {
      agent: (this.agent as any).getStatus(),
      memory: this.memory.getState(),
      other_agent_id: this.otherAgentId
    };
  }
}

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
