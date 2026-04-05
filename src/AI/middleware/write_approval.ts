import { BaseMiddleware, MiddlewareContext, MiddlewareResult } from './base';
import { SecurityConfig } from '../../security/config';
import { SecurityLogger } from '../../security/logger';

export class WriteOperationApprovalMiddleware extends BaseMiddleware {
  private config: SecurityConfig;
  private logger: SecurityLogger;
  private approvalRequests: Map<string, ApprovalRequest>;

  constructor() {
    super("WriteOperationApprovalMiddleware");
    this.config = new SecurityConfig();
    this.logger = new SecurityLogger();
    this.approvalRequests = new Map();
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

    if (this._isWriteOperation(toolCall.name)) {
      const requestId = this._generateRequestId();
      
      const request: ApprovalRequest = {
        id: requestId,
        tool: toolCall.name,
        args: toolCall.args,
        agentId: context.agent_id,
        status: 'pending',
        createdAt: new Date()
      };

      this.approvalRequests.set(requestId, request);
      this.logger.info('写操作审批请求创建', { request_id: requestId, tool: toolCall.name, agent_id: context.agent_id });

      const approved = this._simulateApproval(request);

      if (approved) {
        this.logger.info('写操作审批通过', { request_id: requestId, tool: toolCall.name, agent_id: context.agent_id });
        return {
          should_continue: true,
          metadata: { approved: true, request_id: requestId }
        };
      } else {
        this.logger.warn('写操作审批拒绝', { request_id: requestId, tool: toolCall.name, agent_id: context.agent_id });
        return {
          should_continue: false,
          message: "安全警告：写操作未获得批准",
          metadata: { blocked: true, reason: "approval_denied", request_id: requestId }
        };
      }
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

  private _isWriteOperation(toolName: string): boolean {
    const writeTools = this.config.getWriteTools();
    return writeTools.includes(toolName);
  }

  private _generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private _simulateApproval(request: ApprovalRequest): boolean {
    return true;
  }
}

interface ApprovalRequest {
  id: string;
  tool: string;
  args: any;
  agentId: string;
  status: 'pending' | 'approved' | 'denied';
  createdAt: Date;
}
