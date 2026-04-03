import { BaseMiddleware, MiddlewareContext, MiddlewareResult } from './base';

export class ClarificationMiddleware extends BaseMiddleware {
  constructor() {
    super("ClarificationMiddleware");
  }

  process(context: MiddlewareContext, agent: any): MiddlewareResult {
    // 检查是否需要澄清
    // 这里可以实现需要澄清的逻辑
    return {
      should_continue: true,
      metadata: {}
    };
  }
}
