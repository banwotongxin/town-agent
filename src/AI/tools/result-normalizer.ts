/**
 * 工具执行结果标准化
 * 参考 OpenClaw: src/agents/pi-tool-definition-adapter.ts
 */

import { AgentToolResult } from './core';

/**
 * 标准化工具执行结果
 * 确保所有工具返回统一的格式
 */
export function normalizeToolExecutionResult(params: {
  toolName: string;
  result: AgentToolResult;
}): AgentToolResult {
  const { result } = params;
  
  // 如果结果已经是标准格式，直接返回
  if (result && result.content && Array.isArray(result.content)) {
    return result;
  }
  
  // 否则转换为标准格式
  return {
    content: [{
      type: 'text',
      text: typeof result === 'string' ? result : JSON.stringify(result),
    }],
  };
}

/**
 * 构建工具执行错误结果
 * 采用"错误转结果"策略，不中断Agent循环
 */
export function buildToolExecutionErrorResult(params: {
  toolName: string;
  message: string;
}): AgentToolResult {
  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        status: 'error',
        tool: params.toolName,
        error: params.message,
      }),
    }],
  };
}

/**
 * 创建文本结果辅助函数
 */
export function textResult(text: string): AgentToolResult {
  return {
    content: [{ type: 'text', text }],
  };
}

/**
 * 创建JSON结果辅助函数
 */
export function jsonResult(data: any): AgentToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
    details: data,
  };
}
