import { MiddlewareManager } from './base';
import { ClarificationMiddleware } from './clarification';
import { ConcurrentLimitMiddleware } from './concurrent_limit';
import { DanglingActionMiddleware } from './dangling_action';
import { ErrorHandlingMiddleware } from './error_handling';
import { GuardrailMiddleware } from './guardrail';
import { LoopDetectionMiddleware } from './loop_detection';
import { MemorySummarizationMiddleware } from './memory_summarization';

export class MiddlewareFactory {
  static createDefaultMiddlewareManager(): MiddlewareManager {
    const manager = new MiddlewareManager();

    // 添加默认中间件
    manager.addMiddleware(new DanglingActionMiddleware());
    manager.addMiddleware(new GuardrailMiddleware());
    manager.addMiddleware(new MemorySummarizationMiddleware());
    manager.addMiddleware(new ConcurrentLimitMiddleware());
    manager.addMiddleware(new ErrorHandlingMiddleware());
    manager.addMiddleware(new LoopDetectionMiddleware());
    manager.addMiddleware(new ClarificationMiddleware());

    return manager;
  }

  static createMiddleware(name: string, options?: any): any {
    switch (name) {
      case 'clarification':
        return new ClarificationMiddleware();
      case 'concurrent_limit':
        return new ConcurrentLimitMiddleware(options?.maxConcurrent);
      case 'dangling_action':
        return new DanglingActionMiddleware();
      case 'error_handling':
        return new ErrorHandlingMiddleware();
      case 'guardrail':
        return new GuardrailMiddleware();
      case 'loop_detection':
        return new LoopDetectionMiddleware();
      case 'memory_summarization':
        return new MemorySummarizationMiddleware();
      default:
        throw new Error(`Unknown middleware: ${name}`);
    }
  }
}
