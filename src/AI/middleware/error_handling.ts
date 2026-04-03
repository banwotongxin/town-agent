import { BaseMiddleware, MiddlewareContext, MiddlewareResult, MiddlewarePhase } from './base';

export class ErrorHandlingMiddleware extends BaseMiddleware {
  constructor() {
    super("ErrorHandlingMiddleware");
  }

  process(context: MiddlewareContext, agent: any): MiddlewareResult {
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

    return {
      should_continue: true,
      metadata: {}
    };
  }
}
