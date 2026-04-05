// 导入基础智能体和智能体配置文件
import { BaseAgent } from './base_agent';
import { AgentProfile } from './models';

/**
 * 任务接口，定义了任务的属性
 */
export interface Task {
  type: string;   // 任务类型
  content: string; // 任务内容
}

/**
 * 子智能体类，继承自基础智能体，负责执行特定的子任务
 */
export class SubAgent extends BaseAgent {
  private specialization: string;  // 专业领域
  private team: any;              // 团队成员
  private currentTask: Task | null; // 当前任务

  /**
   * 构造函数
   * @param agentId 智能体ID
   * @param profile 智能体配置文件
   * @param specialization 专业领域
   * @param team 团队成员
   */
  constructor(agentId: string, profile: AgentProfile, specialization: string, team: any) {
    super(agentId, profile);
    this.specialization = specialization;
    this.team = team;
    this.currentTask = null;
  }

  /**
   * 接收任务
   * @param task 任务对象
   * @returns 是否成功接收
   */
  async receiveTask(task: Task): Promise<boolean> {
    this.currentTask = task;
    return true;
  }

  /**
   * 执行任务
   * @param task 任务对象
   * @returns 执行结果
   */
  async executeTask(task: Task): Promise<string> {
    // 接收任务
    await this.receiveTask(task);

    // 获取任务类型和内容
    const taskType = task.type || "general";
    const taskContent = task.content || "";

    // 根据专业领域执行任务
    const result = await this.executeBySpecialization(taskType, taskContent);

    // 报告结果
    return await this.reportResult(result);
  }

  /**
   * 根据专业领域执行任务
   * @param taskType 任务类型
   * @param taskContent 任务内容
   * @returns 执行结果
   */
  async executeBySpecialization(taskType: string, taskContent: string): Promise<string> {
    // 创意写作专业
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
    // 健康咨询专业
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
    // 代码审查专业
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

    // 默认处理
    return `[${this.specialization}] 完成了任务: ${taskContent}`;
  }

  /**
   * 报告任务结果
   * @param result 执行结果
   * @returns 格式化的报告
   */
  async reportResult(result: string): Promise<string> {
    const report = `【${this.specialization}】\n` +
      `执行任务: ${this.currentTask?.content || '未知'}\n` +
      `执行结果: ${result}\n`;
    return report;
  }

  /**
   * 获取智能体状态
   * @returns 智能体状态对象
   */
  getStatus(): Record<string, any> {
    const status = super.getStatus();
    return {
      ...status,
      role: "sub_agent",
      specialization: this.specialization,
      current_task: this.currentTask
    };
  }

  /**
   * 转换为字符串
   * @returns 智能体的字符串表示
   */
  toString(): string {
    return `SubAgent(${this.Profile.name}, ${this.specialization})`;
  }
}
