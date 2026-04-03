import { LeaderAgent } from './leader_agent';
import { SubAgent } from './sub_agent';
import { VerificationAgent } from './verification_agent';
import { createAgentProfile, AgentProfile } from './models';

export class TeamAgent {
  private teamId: string;
  private profession: string;
  private leaderAgent: LeaderAgent | null;
  private subAgents: SubAgent[];
  private verificationAgent: VerificationAgent | null;
  private tasks: Array<{
    task: string;
    result: string;
    timestamp: string;
  }>;

  get TeamId(): string {
    return this.teamId;
  }

  get Profession(): string {
    return this.profession;
  }

  get LeaderAgent(): LeaderAgent | null {
    return this.leaderAgent;
  }

  get SubAgents(): SubAgent[] {
    return this.subAgents;
  }

  get VerificationAgent(): VerificationAgent | null {
    return this.verificationAgent;
  }

  constructor(teamId: string, profession: string) {
    this.teamId = teamId;
    this.profession = profession;
    this.leaderAgent = null;
    this.subAgents = [];
    this.verificationAgent = null;
    this.tasks = [];
  }

  createTeam(leaderProfile: AgentProfile, subProfiles: AgentProfile[], verificationProfile: AgentProfile): void {
    this.leaderAgent = new LeaderAgent(
      `leader_${Math.random().toString(16).substr(2, 8)}`,
      leaderProfile,
      this
    );

    this.subAgents = subProfiles.map((profile, index) => {
      return new SubAgent(
        `sub_${Math.random().toString(16).substr(2, 8)}`,
        profile,
        profile.skills[0] || "general",
        this
      );
    });

    this.verificationAgent = new VerificationAgent(
      `verification_${Math.random().toString(16).substr(2, 8)}`,
      verificationProfile,
      this
    );
  }

  addAgent(agent: LeaderAgent | SubAgent | VerificationAgent): void {
    if (agent instanceof LeaderAgent) {
      this.leaderAgent = agent;
    } else if (agent instanceof SubAgent) {
      this.subAgents.push(agent);
    } else if (agent instanceof VerificationAgent) {
      this.verificationAgent = agent;
    }
  }

  removeAgent(agentId: string): void {
    if (this.leaderAgent && this.leaderAgent['agentId'] === agentId) {
      this.leaderAgent = null;
    } else {
      this.subAgents = this.subAgents.filter(agent => agent['agentId'] !== agentId);
      if (this.verificationAgent && this.verificationAgent['agentId'] === agentId) {
        this.verificationAgent = null;
      }
    }
  }

  updateAgent(agentId: string, newAgent: LeaderAgent | SubAgent | VerificationAgent): void {
    this.removeAgent(agentId);
    this.addAgent(newAgent);
  }

  getAgent(agentId: string): LeaderAgent | SubAgent | VerificationAgent | null {
    if (this.leaderAgent && this.leaderAgent['agentId'] === agentId) {
      return this.leaderAgent;
    }
    for (const agent of this.subAgents) {
      if (agent['agentId'] === agentId) {
        return agent;
      }
    }
    if (this.verificationAgent && this.verificationAgent['agentId'] === agentId) {
      return this.verificationAgent;
    }
    return null;
  }

  clearTasks(): void {
    this.tasks = [];
  }

  async executeTask(task: string): Promise<string> {
    if (!this.leaderAgent || this.subAgents.length === 0 || !this.verificationAgent) {
      return "[系统] 团队尚未完整创建，无法执行任务";
    }

    const subtasks = await this.leaderAgent.decomposeTask(task);
    const assignments = await this.leaderAgent.assignSubtasks(subtasks, this.subAgents);

    const results: string[] = [];
    // 遍历subAgents，查找对应的任务并执行
    for (const agent of this.subAgents) {
      // 查找agent对应的子任务
      for (const [agentKey, subtask] of Object.entries(assignments)) {
        if (agentKey === agent.AgentId) {
          const result = await agent.executeTask(subtask);
          results.push(result);
          break;
        }
      }
    }

    const collectedResult = await this.leaderAgent.collectResults(results);
    const finalResult = await this.verificationAgent.verifyResult(collectedResult);

    this.tasks.push({
      task,
      result: finalResult,
      timestamp: Math.random().toString(16).substr(2, 8)
    });

    return finalResult;
  }

  getResult(taskId?: string): string | null {
    if (!taskId && this.tasks.length > 0) {
      return this.tasks[this.tasks.length - 1].result;
    }

    for (const task of this.tasks) {
      if (task.timestamp === taskId) {
        return task.result;
      }
    }

    return null;
  }

  getStatus(): Record<string, any> {
    return {
      team_id: this.teamId,
      profession: this.profession,
      leader_agent: this.leaderAgent ? (this.leaderAgent as any).agentId : null,
      sub_agents_count: this.subAgents.length,
      verification_agent: this.verificationAgent ? (this.verificationAgent as any).agentId : null,
      tasks_count: this.tasks.length
    };
  }

  toString(): string {
    return `TeamAgent(${this.teamId}, ${this.profession}, ${this.subAgents.length} sub-agents)`;
  }
}

export function createTeamAgent(profession: string, teamId?: string): TeamAgent {
  const id = teamId || `team_${Math.random().toString(16).substr(2, 8)}`;
  const team = new TeamAgent(id, profession);

  let leaderProfile: AgentProfile;
  let subProfiles: AgentProfile[];
  let verificationProfile: AgentProfile;

  if (profession === "作家") {
    leaderProfile = createAgentProfile(
      "林墨",
      "作家",
      32,
      "内向、敏感、富有想象力",
      "自由撰稿人，出版过三本小说，喜欢在咖啡馆里观察生活",
      ["creative_writing"]
    );

    subProfiles = [
      createAgentProfile(
        "创意助手",
        "作家",
        25,
        "活泼、富有创意",
        "创意写作专业毕业，擅长激发灵感",
        ["creative_writing"]
      ),
      createAgentProfile(
        "大纲专家",
        "作家",
        30,
        "逻辑清晰、有条理",
        "编辑出身，擅长结构设计",
        ["creative_writing"]
      ),
      createAgentProfile(
        "内容写手",
        "作家",
        28,
        "勤奋、专注",
        "职业写手，擅长各类文体",
        ["creative_writing"]
      ),
      createAgentProfile(
        "润色专家",
        "作家",
        35,
        "细致、追求完美",
        "资深编辑，擅长文字润色",
        ["creative_writing"]
      )
    ];

    verificationProfile = createAgentProfile(
      "文学评论家",
      "作家",
      40,
      "严谨、专业",
      "文学评论家，对作品质量有严格要求",
      ["creative_writing"]
    );
  } else if (profession === "医生") {
    leaderProfile = createAgentProfile(
      "赵仁",
      "医生",
      45,
      "温和、耐心、责任感强",
      "三甲医院主任医师，擅长内科，从医 20 年",
      ["health_consultation"]
    );

    subProfiles = [
      createAgentProfile(
        "诊断专家",
        "医生",
        40,
        "细心、专业",
        "擅长症状分析和诊断",
        ["health_consultation"]
      ),
      createAgentProfile(
        "治疗方案专家",
        "医生",
        42,
        "逻辑清晰、经验丰富",
        "擅长制定治疗方案",
        ["health_consultation"]
      ),
      createAgentProfile(
        "处方专家",
        "医生",
        38,
        "严谨、细致",
        "擅长开具合理处方",
        ["health_consultation"]
      ),
      createAgentProfile(
        "随访专家",
        "医生",
        35,
        "关心、负责",
        "擅长患者随访和康复指导",
        ["health_consultation"]
      )
    ];

    verificationProfile = createAgentProfile(
      "医学顾问",
      "医生",
      50,
      "专业、严谨",
      "资深医学专家，对医疗质量有严格要求",
      ["health_consultation"]
    );
  } else if (profession === "程序员") {
    leaderProfile = createAgentProfile(
      "王码",
      "程序员",
      28,
      "理性、逻辑性强、有点宅",
      "互联网公司后端工程师，技术大牛，开源爱好者",
      ["code_review"]
    );

    subProfiles = [
      createAgentProfile(
        "需求分析师",
        "程序员",
        30,
        "细致、善于沟通",
        "擅长需求分析和文档编写",
        ["code_review"]
      ),
      createAgentProfile(
        "架构设计师",
        "程序员",
        35,
        "全局思维、创新",
        "擅长系统架构设计",
        ["code_review"]
      ),
      createAgentProfile(
        "代码实现专家",
        "程序员",
        27,
        "专注、高效",
        "擅长编写高质量代码",
        ["code_review"]
      ),
      createAgentProfile(
        "测试专家",
        "程序员",
        29,
        "细心、严谨",
        "擅长测试和调试",
        ["code_review"]
      )
    ];

    verificationProfile = createAgentProfile(
      "技术总监",
      "程序员",
      40,
      "专业、严格",
      "技术总监，对代码质量有严格要求",
      ["code_review"]
    );
  } else {
    leaderProfile = createAgentProfile(
      "团队 leader",
      profession,
      35,
      "领导能力强、善于协调",
      "资深专业人士，擅长团队管理"
    );

    subProfiles = [
      createAgentProfile(
        "专业助手1",
        profession,
        30,
        "专业、高效",
        "专业人士，擅长执行任务"
      ),
      createAgentProfile(
        "专业助手2",
        profession,
        28,
        "细心、负责",
        "专业人士，擅长细节处理"
      )
    ];

    verificationProfile = createAgentProfile(
      "质量检查员",
      profession,
      38,
      "严谨、专业",
      "资深专业人士，对质量有严格要求"
    );
  }

  team.createTeam(leaderProfile, subProfiles, verificationProfile);
  return team;
}
