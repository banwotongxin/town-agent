/**
 * 循环检测中间件
 * 用于检测智能体是否在重复执行相同的动作，防止无限循环
 */
import { BaseMiddleware, MiddlewareContext, MiddlewareResult } from './base';

export class LoopDetectionMiddleware extends BaseMiddleware {
  // 最近执行的动作历史（按 agent_id 分组）
  private recentActions: Map<string, string[]>;
  // 最大历史记录长度
  private maxHistory: number;
  // 连续重复次数阈值
  private consecutiveThreshold: number;

  /**
   * 构造函数
   * @param maxHistory 最大历史记录长度，默认为10
   * @param consecutiveThreshold 连续重复阈值，默认为3
   */
  constructor(maxHistory: number = 10, consecutiveThreshold: number = 3) {
    super("LoopDetectionMiddleware");
    this.recentActions = new Map();
    this.maxHistory = maxHistory;
    this.consecutiveThreshold = consecutiveThreshold;
  }

  /**
   * 处理方法
   * 检测是否存在循环动作
   * @param context 中间件上下文
   * @param agent 智能体实例
   * @returns 中间件结果
   */
  process(context: MiddlewareContext, agent: any): MiddlewareResult {
    // 检查是否有动作
    if (context.action) {
      const agentId = context.agent_id || 'unknown';
      
      // 获取该智能体的动作历史
      if (!this.recentActions.has(agentId)) {
        this.recentActions.set(agentId, []);
      }
      const actions = this.recentActions.get(agentId)!;
      
      // 检查连续重复次数
      let consecutiveCount = 0;
      for (let i = actions.length - 1; i >= 0; i--) {
        if (actions[i] === context.action) {
          consecutiveCount++;
        } else {
          break;
        }
      }
      
      // 如果连续重复次数超过阈值，检测到循环
      if (consecutiveCount >= this.consecutiveThreshold) {
        console.warn(`[LoopDetection] 智能体 ${agentId} 连续 ${consecutiveCount} 次执行相同动作`);
        return {
          should_continue: false,
          message: "检测到循环动作，已停止执行",
          metadata: {
            loop_detected: true,
            action: context.action,
            consecutive_count: consecutiveCount
          }
        };
      }

      // 将动作添加到历史记录
      actions.push(context.action);
      // 如果历史记录超过最大长度，移除最早的记录
      if (actions.length > this.maxHistory) {
        actions.shift();
      }
    }

    // 没有检测到循环，继续执行
    return {
      should_continue: true,
      metadata: {}
    };
  }
}
