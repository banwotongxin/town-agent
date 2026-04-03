import { BaseMiddleware, MiddlewareContext, MiddlewareResult } from './base';

export class DanglingActionMiddleware extends BaseMiddleware {
  constructor() {
    super("DanglingActionMiddleware");
  }

  process(context: MiddlewareContext, agent: any): MiddlewareResult {
    // 检查是否有悬挂的动作
    // 这里可以实现悬挂动作的检测和处理逻辑
    return {
      should_continue: true,
      metadata: {}
    };
  }
}
