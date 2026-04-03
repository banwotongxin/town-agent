import { BaseMiddleware, MiddlewareContext, MiddlewareResult } from './base';

export class LoopDetectionMiddleware extends BaseMiddleware {
  private recentActions: string[];
  private maxHistory: number;

  constructor(maxHistory: number = 10) {
    super("LoopDetectionMiddleware");
    this.recentActions = [];
    this.maxHistory = maxHistory;
  }

  process(context: MiddlewareContext, agent: any): MiddlewareResult {
    if (context.action) {
      // 检查是否有循环
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

      // 添加到历史记录
      this.recentActions.push(context.action);
      if (this.recentActions.length > this.maxHistory) {
        this.recentActions.shift();
      }
    }

    return {
      should_continue: true,
      metadata: {}
    };
  }
}
