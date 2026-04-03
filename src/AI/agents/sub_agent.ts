import { BaseAgent } from './base_agent';
import { AgentProfile } from './models';

export interface Task {
  type: string;
  content: string;
}

export class SubAgent extends BaseAgent {
  private specialization: string;
  private team: any;
  private currentTask: Task | null;

  constructor(agentId: string, profile: AgentProfile, specialization: string, team: any) {
    super(agentId, profile);
    this.specialization = specialization;
    this.team = team;
    this.currentTask = null;
  }

  async receiveTask(task: Task): Promise<boolean> {
    this.currentTask = task;
    return true;
  }

  async executeTask(task: Task): Promise<string> {
    await this.receiveTask(task);

    const taskType = task.type || "general";
    const taskContent = task.content || "";

    const result = await this.executeBySpecialization(taskType, taskContent);

    return await this.reportResult(result);
  }

  async executeBySpecialization(taskType: string, taskContent: string): Promise<string> {
    if (this.specialization === "creative_writing") {
      if (taskType === "inspiration") {
        return `[创意灵感] 为任务 '${taskContent}' 生成了丰富的创意和灵感，包括多个创意方向和情节构思。`;
      } else if (taskType === "outline") {
        return `[大纲编写] 为任务 '${taskContent}' 编写了详细的大纲，包括章节结构和主要情节。`;
      } else if (taskType === "content") {
        return `[内容写作] 为任务 '${taskContent}' 撰写了完整的内容，语言流畅，情节丰富。`;
      } else if (taskType === "polish") {
        return `[内容润色] 对任务 '${taskContent}' 的内容进行了精心润色，提升了文章的质量和可读性。`;
      }
    } else if (this.specialization === "health_consultation") {
      if (taskType === "diagnosis") {
        return `[症状分析] 对任务 '${taskContent}' 进行了详细的症状分析，初步确定了可能的病因。`;
      } else if (taskType === "treatment") {
        return `[治疗方案] 为任务 '${taskContent}' 制定了全面的治疗方案，包括药物治疗和生活建议。`;
      } else if (taskType === "prescription") {
        return `[开具处方] 为任务 '${taskContent}' 开具了详细的处方，包括药物名称、剂量和使用方法。`;
      } else if (taskType === "followup") {
        return `[后续建议] 为任务 '${taskContent}' 提供了详细的后续建议，包括复诊时间和注意事项。`;
      }
    } else if (this.specialization === "code_review") {
      if (taskType === "analysis") {
        return `[需求分析] 对任务 '${taskContent}' 进行了详细的需求分析，明确了功能需求和技术要求。`;
      } else if (taskType === "design") {
        return `[方案设计] 为任务 '${taskContent}' 设计了合理的技术方案，包括架构设计和模块划分。`;
      } else if (taskType === "coding") {
        return `[代码编写] 为任务 '${taskContent}' 编写了高质量的代码，结构清晰，注释完善。`;
      } else if (taskType === "testing") {
        return `[测试调试] 对任务 '${taskContent}' 的代码进行了全面的测试和调试，确保功能正常。`;
      }
    }

    return `[${this.specialization}] 完成了任务: ${taskContent}`;
  }

  async reportResult(result: string): Promise<string> {
    const report = `【${this.specialization}】\n` +
      `执行任务: ${this.currentTask?.content || '未知'}\n` +
      `执行结果: ${result}\n`;
    return report;
  }

  getStatus(): Record<string, any> {
    const status = super.getStatus();
    return {
      ...status,
      role: "sub_agent",
      specialization: this.specialization,
      current_task: this.currentTask
    };
  }

  toString(): string {
    return `SubAgent(${this.Profile.name}, ${this.specialization})`;
  }
}
