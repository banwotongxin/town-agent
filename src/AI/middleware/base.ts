/**
 * 中间件阶段枚举
 * 定义了中间件可以执行的不同阶段
 */
export enum MiddlewarePhase {
  BEFORE_THINK = "before_think",  // 思考前
  AFTER_THINK = "after_think",    // 思考后
  BEFORE_ACTION = "before_action", // 行动前
  AFTER_ACTION = "after_action",   // 行动后
  ON_ERROR = "on_error"            // 错误时
}

/**
 * 中间件上下文接口
 * 包含中间件执行时的所有相关信息
 */
export interface MiddlewareContext {
  agent_id: string;           // 智能体ID
  agent_name: string;         // 智能体名称
  phase: MiddlewarePhase;     // 中间件阶段
  current_state: string;      // 当前状态
  current_location: string;   // 当前位置
  goal?: string;              // 目标（可选）
  action?: string;            // 行动（可选）
  action_result?: string;     // 行动结果（可选）
  error?: Error;              // 错误（可选）
  metadata: Record<string, any>; // 元数据
}

/**
 * 中间件结果接口
 * 定义了中间件执行的结果
 */
export interface MiddlewareResult {
  should_continue: boolean;   // 是否继续执行
  modified_action?: string;   // 修改后的行动（可选）
  modified_goal?: string;     // 修改后的目标（可选）
  message?: string;           // 消息（可选）
  metadata: Record<string, any>; // 元数据
}

/**
 * 基础中间件类
 * 所有具体中间件的基类
 */
export class BaseMiddleware {
  protected name: string;     // 中间件名称
  protected enabled: boolean;  // 是否启用

  /**
   * 构造函数
   * @param name 中间件名称
   */
  constructor(name: string) {
    this.name = name;
    this.enabled = true;
  }

  /**
   * 处理方法
   * 子类必须实现此方法
   * @param context 中间件上下文
   * @param agent 智能体实例
   * @returns 中间件结果
   */
  process(context: MiddlewareContext, agent: any): MiddlewareResult {
    throw new Error("Subclasses must implement process()");
  }

  /**
   * 启用中间件
   */
  enable(): void {
    this.enabled = true;
  }

  /**
   * 禁用中间件
   */
  disable(): void {
    this.enabled = false;
  }

  /**
   * 获取中间件是否启用
   */
  get isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * 获取中间件名称
   */
  get Name(): string {
    return this.name;
  }
}

/**
 * 中间件管理器类
 * 管理多个中间件的执行
 */
export class MiddlewareManager {
  private middlewares: BaseMiddleware[]; // 中间件列表
  private stats: Record<string, number>; // 统计信息

  /**
   * 构造函数
   */
  constructor() {
    this.middlewares = [];
    this.stats = {
      total_processed: 0,          // 总处理次数
      total_blocked: 0,            // 总阻塞次数
      total_errors: 0,             // 总错误次数
      total_summarizations: 0,     // 总结次数
      total_loop_detections: 0     // 循环检测次数
    };
  }

  /**
   * 添加中间件
   * @param middleware 中间件实例
   */
  addMiddleware(middleware: BaseMiddleware): void {
    this.middlewares.push(middleware);
  }

  /**
   * 移除中间件
   * @param name 中间件名称
   */
  removeMiddleware(name: string): void {
    this.middlewares = this.middlewares.filter(m => m.Name !== name);
  }

  /**
   * 处理中间件
   * @param context 中间件上下文
   * @param agent 智能体实例
   * @returns 最终的中间件结果
   */
  process(context: MiddlewareContext, agent: any): MiddlewareResult {
    this.stats.total_processed++;

    // 初始化最终结果
    const finalResult: MiddlewareResult = {
      should_continue: true,
      metadata: {}
    };

    // 遍历执行所有启用的中间件
    for (const middleware of this.middlewares) {
      if (!middleware.isEnabled) {
        continue;
      }

      try {
        const result = middleware.process(context, agent);

        // 处理消息
        if (result.message) {
          if (finalResult.message) {
            finalResult.message += "\n" + result.message;
          } else {
            finalResult.message = result.message;
          }
        }

        // 处理阻塞
        if (!result.should_continue) {
          this.stats.total_blocked++;
          finalResult.should_continue = false;
          break;
        }

        // 处理修改后的行动
        if (result.modified_action) {
          finalResult.modified_action = result.modified_action;
        }

        // 处理修改后的目标
        if (result.modified_goal) {
          finalResult.modified_goal = result.modified_goal;
        }

        // 统计特殊中间件的执行次数
        if (middleware.Name.includes("Summarization")) {
          this.stats.total_summarizations++;
        } else if (middleware.Name.includes("Loop")) {
          this.stats.total_loop_detections++;
        }

      } catch (e) {
        // 处理中间件执行错误
        this.stats.total_errors++;
        console.error(`[MiddlewareManager] 中间件 ${middleware.Name} 执行错误:`, e);
      }
    }

    return finalResult;
  }

  /**
   * 获取统计信息
   * @returns 统计信息对象
   */
  getStats(): Record<string, number> {
    return { ...this.stats };
  }

  /**
   * 启用所有中间件
   */
  enableAll(): void {
    for (const middleware of this.middlewares) {
      middleware.enable();
    }
  }

  /**
   * 禁用所有中间件
   */
  disableAll(): void {
    for (const middleware of this.middlewares) {
      middleware.disable();
    }
  }
}
