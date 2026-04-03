export enum MiddlewarePhase {
  BEFORE_THINK = "before_think",
  AFTER_THINK = "after_think",
  BEFORE_ACTION = "before_action",
  AFTER_ACTION = "after_action",
  ON_ERROR = "on_error"
}

export interface MiddlewareContext {
  agent_id: string;
  agent_name: string;
  phase: MiddlewarePhase;
  current_state: string;
  current_location: string;
  goal?: string;
  action?: string;
  action_result?: string;
  error?: Error;
  metadata: Record<string, any>;
}

export interface MiddlewareResult {
  should_continue: boolean;
  modified_action?: string;
  modified_goal?: string;
  message?: string;
  metadata: Record<string, any>;
}

export class BaseMiddleware {
  protected name: string;
  protected enabled: boolean;

  constructor(name: string) {
    this.name = name;
    this.enabled = true;
  }

  process(context: MiddlewareContext, agent: any): MiddlewareResult {
    throw new Error("Subclasses must implement process()");
  }

  enable(): void {
    this.enabled = true;
  }

  disable(): void {
    this.enabled = false;
  }

  get isEnabled(): boolean {
    return this.enabled;
  }

  get Name(): string {
    return this.name;
  }
}

export class MiddlewareManager {
  private middlewares: BaseMiddleware[];
  private stats: Record<string, number>;

  constructor() {
    this.middlewares = [];
    this.stats = {
      total_processed: 0,
      total_blocked: 0,
      total_errors: 0,
      total_summarizations: 0,
      total_loop_detections: 0
    };
  }

  addMiddleware(middleware: BaseMiddleware): void {
    this.middlewares.push(middleware);
  }

  removeMiddleware(name: string): void {
    this.middlewares = this.middlewares.filter(m => m.Name !== name);
  }

  process(context: MiddlewareContext, agent: any): MiddlewareResult {
    this.stats.total_processed++;

    const finalResult: MiddlewareResult = {
      should_continue: true,
      metadata: {}
    };

    for (const middleware of this.middlewares) {
      if (!middleware.isEnabled) {
        continue;
      }

      try {
        const result = middleware.process(context, agent);

        if (result.message) {
          if (finalResult.message) {
            finalResult.message += "\n" + result.message;
          } else {
            finalResult.message = result.message;
          }
        }

        if (!result.should_continue) {
          this.stats.total_blocked++;
          finalResult.should_continue = false;
          break;
        }

        if (result.modified_action) {
          finalResult.modified_action = result.modified_action;
        }

        if (result.modified_goal) {
          finalResult.modified_goal = result.modified_goal;
        }

        if (middleware.Name.includes("Summarization")) {
          this.stats.total_summarizations++;
        } else if (middleware.Name.includes("Loop")) {
          this.stats.total_loop_detections++;
        }

      } catch (e) {
        this.stats.total_errors++;
        console.error(`[MiddlewareManager] 中间件 ${middleware.Name} 执行错误:`, e);
      }
    }

    return finalResult;
  }

  getStats(): Record<string, number> {
    return { ...this.stats };
  }

  enableAll(): void {
    for (const middleware of this.middlewares) {
      middleware.enable();
    }
  }

  disableAll(): void {
    for (const middleware of this.middlewares) {
      middleware.disable();
    }
  }
}
