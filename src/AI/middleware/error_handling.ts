/**
 * 错误处理中间件
 * 用于处理智能体执行过程中的错误
 */
import { BaseMiddleware, MiddlewareContext, MiddlewareResult, MiddlewarePhase } from './base';

export class ErrorHandlingMiddleware extends BaseMiddleware {
  /**
   * 构造函数
   */
  constructor() {
    super("ErrorHandlingMiddleware");
  }

  /**
   * 处理方法
   * 处理智能体执行过程中的错误
   * @param context 中间件上下文
   * @param agent 智能体实例
   * @returns 中间件结果
   */
  process(context: MiddlewareContext, agent: any): MiddlewareResult {
    // 检查是否是错误阶段且存在错误
    if (context.phase === MiddlewarePhase.ON_ERROR && context.error) {
      // 处理错误
      console.error(`[ErrorHandling] 处理错误: ${context.error.message}`);
      return {
        should_continue: true,
        message: `发生错误: ${context.error.message}`,
        metadata: {
          error: context.error.message
        }
      };
    }

    // 非错误阶段或无错误时，继续执行
    return {
      should_continue: true,
      metadata: {}
    };
  }
}
