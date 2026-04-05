import { BaseMiddleware, MiddlewareContext, MiddlewareResult } from './base';
import { SecurityConfig } from '../../security/config';
import { SecurityLogger } from '../../security/logger';

export class ToolPermissionMiddleware extends BaseMiddleware {
  private config: SecurityConfig;
  private logger: SecurityLogger;

  constructor() {
    super("ToolPermissionMiddleware");
    this.config = new SecurityConfig();
    this.logger = new SecurityLogger();
  }

  process(context: MiddlewareContext, agent: any): MiddlewareResult {
    if (!context.action) {
      return {
        should_continue: true,
        metadata: {}
      };
    }

    const toolCall = this._parseToolCall(context.action);
    if (!toolCall) {
      return {
        should_continue: true,
        metadata: {}
      };
    }

    if (!this._checkToolPermission(toolCall.name, toolCall.args)) {
      this.logger.warn('工具权限校验失败', { tool: toolCall.name, agent_id: context.agent_id });
      return {
        should_continue: false,
        message: `安全警告：工具 ${toolCall.name} 无权限执行`,
        metadata: { blocked: true, reason: "permission_denied" }
      };
    }

    return {
      should_continue: true,
      metadata: {}
    };
  }

  private _parseToolCall(action: string): { name: string; args: any } | null {
    const match = action.match(/(\w+)\((.*)\)/);
    if (match) {
      return {
        name: match[1],
        args: match[2]
      };
    }
    return null;
  }

  private _checkToolPermission(toolName: string, args: any): boolean {
    const toolPermissions = this.config.getToolPermissions();
    const permission = toolPermissions[toolName];

    if (!permission) {
      return false;
    }

    return permission.enabled;
  }
}
