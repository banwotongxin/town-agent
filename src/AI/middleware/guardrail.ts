import { BaseMiddleware, MiddlewareContext, MiddlewareResult } from './base';

export class GuardrailMiddleware extends BaseMiddleware {
  constructor() {
    super("GuardrailMiddleware");
  }

  process(context: MiddlewareContext, agent: any): MiddlewareResult {
    // 检查是否有违规内容
    // 这里可以实现内容审核的逻辑
    return {
      should_continue: true,
      metadata: {}
    };
  }
}
