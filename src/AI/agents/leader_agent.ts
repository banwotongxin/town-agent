import { BaseAgent } from './base_agent';
import { AgentProfile } from './models';

export interface SubTask {
  type: string;
  content: string;
}

export interface SubAgent {
  agentId: string;
  name: string;
  profession: string;
}

export class LeaderAgent extends BaseAgent {
  private team: any;
  private currentTasks: SubTask[];
  private taskProgress: Record<string, string>;

  constructor(agentId: string, profile: AgentProfile, team: any) {
    super(agentId, profile);
    this.team = team;
    this.currentTasks = [];
    this.taskProgress = {};
  }

  async decomposeTask(task: string): Promise<SubTask[]> {
    const profession = this.Profile.profession;
    let subtasks: SubTask[] = [];

    if (profession === "作家") {
      subtasks = [
        { type: "inspiration", content: "为任务生成创意和灵感" },
        { type: "outline", content: "编写任务大纲" },
        { type: "content", content: "撰写任务内容" },
        { type: "polish", content: "润色任务内容" }
      ];
    } else if (profession === "医生") {
      subtasks = [
        { type: "diagnosis", content: "分析症状和病情" },
        { type: "treatment", content: "制定治疗方案" },
        { type: "prescription", content: "开具处方" },
        { type: "followup", content: "提供后续建议" }
      ];
    } else if (profession === "程序员") {
      subtasks = [
        { type: "analysis", content: "分析需求" },
        { type: "design", content: "设计解决方案" },
        { type: "coding", content: "编写代码" },
        { type: "testing", content: "测试和调试" }
      ];
    } else {
      subtasks = [
        { type: "analysis", content: "分析任务" },
        { type: "planning", content: "制定计划" },
        { type: "execution", content: "执行任务" },
        { type: "review", content: "审查结果" }
      ];
    }

    this.currentTasks = subtasks;
    for (let i = 0; i < subtasks.length; i++) {
      this.taskProgress[`subtask_${i}`] = "pending";
    }

    return subtasks;
  }

  async assignSubtasks(subtasks: SubTask[], subAgents: any[]): Promise<Record<string, SubTask>> {
    const assignments: Record<string, SubTask> = {};

    for (let i = 0; i < subtasks.length; i++) {
      if (i < subAgents.length) {
        const agent = subAgents[i];
        assignments[agent.AgentId] = subtasks[i];
        this.taskProgress[`subtask_${i}`] = "assigned";
      }
    }

    return assignments;
  }

  async trackProgress(): Promise<Record<string, string>> {
    return this.taskProgress;
  }

  async collectResults(results: string[]): Promise<string> {
    for (const key in this.taskProgress) {
      this.taskProgress[key] = "completed";
    }

    const collected = results.join("\n");

    const summary = `\n\n【任务执行总结】\n` +
      `任务类型: ${this.Profile.profession}\n` +
      `执行子任务数: ${results.length}\n` +
      `所有子任务已完成\n`;

    return collected + summary;
  }

  getStatus(): Record<string, any> {
    const status = super.getStatus();
    return {
      ...status,
      role: "leader",
      current_tasks_count: this.currentTasks.length,
      task_progress: this.taskProgress
    };
  }

  toString(): string {
    return `LeaderAgent(${this.Profile.name}, ${this.Profile.profession})`;
  }
}
