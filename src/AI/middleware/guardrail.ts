import { BaseMiddleware, MiddlewareContext, MiddlewareResult } from './base';
import { SecurityConfig } from '../../security/config';
import { SecurityLogger } from '../../security/logger';

export class GuardrailMiddleware extends BaseMiddleware {
  private config: SecurityConfig;
  private logger: SecurityLogger;

  constructor() {
    super("GuardrailMiddleware");
    this.config = new SecurityConfig();
    this.logger = new SecurityLogger();
  }

  process(context: MiddlewareContext, agent: any): MiddlewareResult {
    if (context.action) {
      if (this._detectPathTraversal(context.action)) {
        this.logger.warn('PATH遍历攻击检测', { action: context.action, agent_id: context.agent_id });
        return {
          should_continue: false,
          message: "安全警告：检测到路径遍历攻击",
          metadata: { blocked: true, reason: "path_traversal" }
        };
      }

      if (this._detectBlacklistedInput(context.action)) {
        this.logger.warn('黑名单输入检测', { action: context.action, agent_id: context.agent_id });
        return {
          should_continue: false,
          message: "安全警告：检测到危险操作",
          metadata: { blocked: true, reason: "blacklisted_input" }
        };
      }
    }

    if (context.action_result) {
      const filteredResult = this._filterBlacklistedOutput(context.action_result);
      if (filteredResult !== context.action_result) {
        this.logger.info('输出敏感信息过滤', { agent_id: context.agent_id });
        return {
          should_continue: true,
          modified_action: context.action,
          metadata: { filtered: true }
        };
      }
    }

    return {
      should_continue: true,
      metadata: {}
    };
  }

  private _detectPathTraversal(input: string): boolean {
    const pathTraversalPatterns = [
      /\.\.\//g,
      /\.\.\\/g,
      /\/\.\./g,
      /\\\.\./g,
      /%2e%2e%2f/i,
      /%2e%2e%5c/i,
    ];

    return pathTraversalPatterns.some(pattern => pattern.test(input));
  }

  private _detectBlacklistedInput(input: string): boolean {
    const blacklistedPatterns = this.config.getInputBlacklist();
    return blacklistedPatterns.some(pattern => new RegExp(pattern).test(input));
  }

  private _filterBlacklistedOutput(output: string): string {
    let filtered = output;
    const blacklistedPatterns = this.config.getOutputBlacklist();
    
    blacklistedPatterns.forEach(pattern => {
      filtered = filtered.replace(new RegExp(pattern, 'g'), '[REDACTED]');
    });

    return filtered;
  }
}
