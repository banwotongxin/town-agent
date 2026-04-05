/**
 * 循环检测中间件
 * 用于检测智能体是否在重复执行相同的动作，防止无限循环
 */
import { BaseMiddleware, MiddlewareContext, MiddlewareResult } from './base';

export class LoopDetectionMiddleware extends BaseMiddleware {
  // 最近执行的动作历史
  private recentActions: string[];
  // 最大历史记录长度
  private maxHistory: number;

  /**
   * 构造函数
   * @param maxHistory 最大历史记录长度，默认为10
   */
  constructor(maxHistory: number = 10) {
    super("LoopDetectionMiddleware");
    this.recentActions = [];
    this.maxHistory = maxHistory;
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
      // 检查动作是否在历史记录中存在（检测循环）
      if (this.recentActions.includes(context.action)) {
        return {
          should_continue: false,
          message: "检测到循环动作，已停止执行",
          metadata: {
            loop_detected: true,
            action: context.action
          }
        };
      }

      // 将动作添加到历史记录
      this.recentActions.push(context.action);
      // 如果历史记录超过最大长度，移除最早的记录
      if (this.recentActions.length > this.maxHistory) {
        this.recentActions.shift();
      }
    }

    // 没有检测到循环，继续执行
    return {
      should_continue: true,
      metadata: {}
    };
  }
}
