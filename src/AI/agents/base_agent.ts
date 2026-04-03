import { AgentProfile, createAgentProfile } from './models';

export interface BaseMessage {
  content: string;
  type: string;
}

export class HumanMessage implements BaseMessage {
  constructor(public content: string) {}
  type: string = 'human';
}

export class AIMessage implements BaseMessage {
  constructor(public content: string) {}
  type: string = 'ai';
}

export class SystemMessage implements BaseMessage {
  constructor(public content: string) {}
  type: string = 'system';
}

export interface LLMModel {
  invoke: (messages: BaseMessage[]) => Promise<{ content: string }>;
  ainvoke?: (messages: BaseMessage[]) => Promise<{ content: string }>;
}

export class BaseAgent {
  private agentId: string;
  private profile: AgentProfile;
  private llmModel?: LLMModel;
  private isActive: boolean;
  private currentLocation: string;
  private currentMood: string;
  private conversationCount: number;

  get AgentId(): string {
    return this.agentId;
  }

  get Profile(): AgentProfile {
    return this.profile;
  }

  constructor(
    agentId: string,
    profile: AgentProfile,
    llmModel?: LLMModel
  ) {
    this.agentId = agentId;
    this.profile = profile;
    this.llmModel = llmModel;
    this.isActive = true;
    this.currentLocation = "home";
    this.currentMood = "neutral";
    this.conversationCount = 0;
  }

  getSystemPrompt(): string {
    let prompt = `你叫${this.profile.name}，${this.profile.age}岁，职业是${this.profile.profession}。

性格特点：${this.profile.personality}
背景故事：${this.profile.background}
兴趣爱好：${this.profile.hobbies.join(', ')}
说话风格：${this.profile.speech_style}

请始终保持与你的角色设定一致，用符合你性格和职业的方式与人交流。`;

    if (this.profile.appearance) {
      prompt += `\n外貌特征：${this.profile.appearance}`;
    }

    return prompt;
  }

  formatMessages(
    messages: BaseMessage[],
    memoryContext?: string,
    emotionContext?: string
  ): BaseMessage[] {
    const formatted: BaseMessage[] = [];

    let systemPrompt = this.getSystemPrompt();

    if (memoryContext) {
      systemPrompt += `\n\n[历史对话摘要]\n${memoryContext}`;
    }

    if (emotionContext) {
      systemPrompt += `\n\n[当前关系状态]\n${emotionContext}`;
    }

    formatted.push(new SystemMessage(systemPrompt));
    formatted.push(...messages);

    return formatted;
  }

  async respond(
    userMessage: string,
    conversationHistory: BaseMessage[],
    kwargs: Record<string, any> = {}
  ): Promise<string> {
    if (!this.llmModel) {
      return "[系统] 我还没有学会说话...";
    }

    const messages = this.formatMessages(
      [...conversationHistory, new HumanMessage(userMessage)],
      kwargs.memory_context,
      kwargs.emotion_context
    );

    let response;
    if (this.llmModel.ainvoke) {
      response = await this.llmModel.ainvoke(messages);
    } else {
      response = await this.llmModel.invoke(messages);
    }

    this.conversationCount++;

    return response.content || String(response);
  }

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

  toString(): string {
    return `BaseAgent(${this.profile.name}, ${this.profile.profession})`;
  }
}

export function createBaseAgent(
  name: string,
  profession: string,
  agentId?: string,
  profileKwargs: Record<string, any> = {}
): BaseAgent {
  const profile = createAgentProfile(
    name,
    profession,
    profileKwargs.age,
    profileKwargs.personality,
    profileKwargs.background,
    profileKwargs.custom_skills
  );

  const id = agentId || `agent_${Math.random().toString(16).substr(2, 8)}`;

  return new BaseAgent(id, profile);
}
