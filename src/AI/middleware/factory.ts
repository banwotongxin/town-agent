import { MiddlewareManager } from './base';
import { GuardrailMiddleware } from './guardrail';
import { ToolPermissionMiddleware } from './tool_permission';
import { WriteOperationApprovalMiddleware } from './write_approval';

export function createSecurityMiddlewareManager(): MiddlewareManager {
  const manager = new MiddlewareManager();
  
  manager.addMiddleware(new GuardrailMiddleware());
  manager.addMiddleware(new ToolPermissionMiddleware());
  manager.addMiddleware(new WriteOperationApprovalMiddleware());
  
  return manager;
}
