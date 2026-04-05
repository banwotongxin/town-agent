/**
 * 并发限制中间件
 * 用于控制智能体的并发任务数，防止系统过载
 */
import { BaseMiddleware, MiddlewareContext, MiddlewareResult } from './base';

export class ConcurrentLimitMiddleware extends BaseMiddleware {
  // 最大并发数
  private maxConcurrent: number;
  // 当前并发数
  private currentConcurrent: number;

  /**
   * 构造函数
   * @param maxConcurrent 最大并发数，默认为3
   */
  constructor(maxConcurrent: number = 3) {
    super("ConcurrentLimitMiddleware");
    this.maxConcurrent = maxConcurrent;
    this.currentConcurrent = 0;
  }

  /**
   * 处理方法
   * 检查并限制并发任务数
   * @param context 中间件上下文
   * @param agent 智能体实例
   * @returns 中间件结果
   */
  process(context: MiddlewareContext, agent: any): MiddlewareResult {
    // 检查当前并发数是否达到上限
    if (this.currentConcurrent >= this.maxConcurrent) {
      return {
        should_continue: false,
        message: "并发任务数已达到上限，请稍后再试",
        metadata: {}
      };
    }

    // 增加当前并发数
    this.currentConcurrent++;
    return {
      should_continue: true,
      metadata: {}
    };
  }

  /**
   * 释放并发资源
   * 当任务完成时调用此方法减少当前并发数
   */
  release(): void {
    if (this.currentConcurrent > 0) {
      this.currentConcurrent--;
    }
  }
}
