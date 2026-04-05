/**
 * 中间件工厂类
 * 用于创建中间件管理器和各种中间件实例
 */
import { MiddlewareManager } from './base';
import { ClarificationMiddleware } from './clarification';
import { ConcurrentLimitMiddleware } from './concurrent_limit';
import { DanglingActionMiddleware } from './dangling_action';
import { ErrorHandlingMiddleware } from './error_handling';
import { GuardrailMiddleware } from './guardrail';
import { LoopDetectionMiddleware } from './loop_detection';
import { MemorySummarizationMiddleware } from './memory_summarization';

export class MiddlewareFactory {
  /**
   * 创建默认的中间件管理器
   * @returns 配置了默认中间件的中间件管理器
   */
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

  /**
   * 根据名称创建中间件
   * @param name 中间件名称
   * @param options 中间件选项（可选）
   * @returns 中间件实例
   * @throws 当中间件名称不存在时抛出错误
   */
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
