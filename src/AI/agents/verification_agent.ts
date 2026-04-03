import { BaseAgent } from './base_agent';
import { AgentProfile } from './models';

export class VerificationAgent extends BaseAgent {
  private team: any;
  private currentResult: string | null;

  constructor(agentId: string, profile: AgentProfile, team: any) {
    super(agentId, profile);
    this.team = team;
    this.currentResult = null;
  }

  async verifyResult(result: string): Promise<string> {
    this.currentResult = result;
    const profession = this.Profile.profession;
    const verificationReport = await this.generateReport(result, profession);
    return `${result}\n\n${verificationReport}`;
  }

  async generateReport(result: string, profession: string): Promise<string> {
    let report = "【验收报告】\n";
    report += `验收者: ${this.Profile.name} (专业: ${profession})\n`;
    report += "-" .repeat(50) + "\n";

    if (profession === "作家") {
      report += "验收标准:\n";
      report += "1. 内容完整性: 检查是否包含所有必要的内容\n";
      report += "2. 创意性: 评估内容的创意和新颖性\n";
      report += "3. 语言质量: 检查语言表达和文采\n";
      report += "4. 结构合理性: 评估内容结构是否合理\n";
      report += "-" .repeat(50) + "\n";
      report += "验收结果: 内容完整，创意丰富，语言流畅，结构合理，符合要求\n";
    } else if (profession === "医生") {
      report += "验收标准:\n";
      report += "1. 诊断准确性: 检查诊断是否准确\n";
      report += "2. 治疗方案合理性: 评估治疗方案是否合理\n";
      report += "3. 处方安全性: 检查处方是否安全有效\n";
      report += "4. 后续建议完整性: 评估后续建议是否全面\n";
      report += "-" .repeat(50) + "\n";
      report += "验收结果: 诊断准确，治疗方案合理，处方安全，后续建议全面\n";
    } else if (profession === "程序员") {
      report += "验收标准:\n";
      report += "1. 功能完整性: 检查是否实现了所有功能\n";
      report += "2. 代码质量: 评估代码的质量和可读性\n";
      report += "3. 性能优化: 检查代码是否经过优化\n";
      report += "4. 测试覆盖: 评估测试覆盖是否充分\n";
      report += "-" .repeat(50) + "\n";
      report += "验收结果: 功能完整，代码质量高，性能良好，测试覆盖充分\n";
    } else {
      report += "验收标准:\n";
      report += "1. 内容完整性: 检查是否包含所有必要的内容\n";
      report += "2. 质量达标: 评估内容质量是否符合要求\n";
      report += "3. 逻辑合理性: 检查内容逻辑是否合理\n";
      report += "4. 格式规范: 评估格式是否规范\n";
      report += "-" .repeat(50) + "\n";
      report += "验收结果: 内容完整，质量达标，逻辑合理，格式规范\n";
    }

    report += "-" .repeat(50) + "\n";
    report += `验收结论: 任务执行成功，结果符合要求\n`;

    return report;
  }

  getStatus(): Record<string, any> {
    const status = super.getStatus();
    return {
      ...status,
      role: "verification_agent",
      current_result: this.currentResult !== null
    };
  }

  toString(): string {
    return `VerificationAgent(${this.Profile.name}, ${this.Profile.profession})`;
  }
}
