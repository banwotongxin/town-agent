import { BaseMiddleware, MiddlewareContext, MiddlewareResult } from './base';

export class ConcurrentLimitMiddleware extends BaseMiddleware {
  private maxConcurrent: number;
  private currentConcurrent: number;

  constructor(maxConcurrent: number = 3) {
    super("ConcurrentLimitMiddleware");
    this.maxConcurrent = maxConcurrent;
    this.currentConcurrent = 0;
  }

  process(context: MiddlewareContext, agent: any): MiddlewareResult {
    if (this.currentConcurrent >= this.maxConcurrent) {
      return {
        should_continue: false,
        message: "并发任务数已达到上限，请稍后再试",
        metadata: {}
      };
    }

    this.currentConcurrent++;
    return {
      should_continue: true,
      metadata: {}
    };
  }

  release(): void {
    if (this.currentConcurrent > 0) {
      this.currentConcurrent--;
    }
  }
}
