// 导入基础智能体和智能体配置文件
import { BaseAgent } from './base_agent';
import { AgentProfile } from './models';

/**
 * 子任务接口，定义了子任务的属性
 */
export interface SubTask {
  type: string;   // 任务类型
  content: string; // 任务内容
}

/**
 * 子智能体接口，定义了子智能体的基本属性
 */
export interface SubAgent {
  agentId: string;    // 智能体ID
  name: string;       // 智能体名称
  profession: string; // 智能体职业
}

/**
 * 领导智能体类，继承自基础智能体，负责任务分解和团队管理
 */
export class LeaderAgent extends BaseAgent {
  private team: any;                 // 团队成员
  private currentTasks: SubTask[];   // 当前任务列表
  private taskProgress: Record<string, string>; // 任务进度

  /**
   * 构造函数
   * @param agentId 智能体ID
   * @param profile 智能体配置文件
   * @param team 团队成员
   */
  constructor(agentId: string, profile: AgentProfile, team: any) {
    super(agentId, profile);
    this.team = team;
    this.currentTasks = [];
    this.taskProgress = {};
  }

  /**
   * 分解任务为子任务
   * @param task 任务内容
   * @returns 子任务数组
   */
  async decomposeTask(task: string): Promise<SubTask[]> {
    const profession = this.Profile.profession;
    let subtasks: SubTask[] = [];

    // 根据职业类型分解任务
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
      // 默认任务分解
      subtasks = [
        { type: "analysis", content: "分析任务" },
        { type: "planning", content: "制定计划" },
        { type: "execution", content: "执行任务" },
        { type: "review", content: "审查结果" }
      ];
    }

    // 更新当前任务和进度
    this.currentTasks = subtasks;
    for (let i = 0; i < subtasks.length; i++) {
      this.taskProgress[`subtask_${i}`] = "pending";
    }

    return subtasks;
  }

  /**
   * 分配子任务给子智能体
   * @param subtasks 子任务数组
   * @param subAgents 子智能体数组
   * @returns 任务分配结果
   */
  async assignSubtasks(subtasks: SubTask[], subAgents: any[]): Promise<Record<string, SubTask>> {
    const assignments: Record<string, SubTask> = {};

    // 为每个子智能体分配一个子任务
    for (let i = 0; i < subtasks.length; i++) {
      if (i < subAgents.length) {
        const agent = subAgents[i];
        assignments[agent.AgentId] = subtasks[i];
        this.taskProgress[`subtask_${i}`] = "assigned";
      }
    }

    return assignments;
  }

  /**
   * 跟踪任务进度
   * @returns 任务进度对象
   */
  async trackProgress(): Promise<Record<string, string>> {
    return this.taskProgress;
  }

  /**
   * 收集任务结果
   * @param results 结果数组
   * @returns 收集的结果和总结
   */
  async collectResults(results: string[]): Promise<string> {
    // 更新所有任务状态为已完成
    for (const key in this.taskProgress) {
      this.taskProgress[key] = "completed";
    }

    // 合并结果
    const collected = results.join("\n");

    // 生成总结
    const summary = `\n\n【任务执行总结】\n` +
      `任务类型: ${this.Profile.profession}\n` +
      `执行子任务数: ${results.length}\n` +
      `所有子任务已完成\n`;

    return collected + summary;
  }

  /**
   * 获取智能体状态
   * @returns 智能体状态对象
   */
  getStatus(): Record<string, any> {
    const status = super.getStatus();
    return {
      ...status,
      role: "leader",
      current_tasks_count: this.currentTasks.length,
      task_progress: this.taskProgress
    };
  }

  /**
   * 转换为字符串
   * @returns 智能体的字符串表示
   */
  toString(): string {
    return `LeaderAgent(${this.Profile.name}, ${this.Profile.profession})`;
  }
}
