/**
 * 工具定义适配器
 * 参考 OpenClaw: src/agents/pi-tool-definition-adapter.ts
 * 
 * 将 AgentTool 转换为可执行的工具定义，这是工具执行的核心包装层
 */

import { AgentTool, AnyAgentTool, ToolExecuteArgs, AgentToolResult } from './core';
import { runBeforeToolCallHook } from '../hooks/before-tool-call';
import { normalizeToolExecutionResult, buildToolExecutionErrorResult } from './result-normalizer';

/**
 * 将 AgentTool 转换为可执行的工具定义
 * 这是工具执行的核心包装层
 */
export function toToolDefinitions(tools: AnyAgentTool[]): any[] {
  return tools.map((tool) => ({
    name: tool.name,
    label: tool.label ?? tool.name,
    description: tool.description ?? '',
    parameters: tool.parameters,
    
    execute: async (...args: any[]): Promise<AgentToolResult> => {
      const { toolCallId, params, signal, onUpdate } = splitToolExecuteArgs(args);
      let executeParams = params;
      
      try {
        // ★ Step 1: 运行 before_tool_call Hook
        const hookOutcome = await runBeforeToolCallHook({
          toolName: tool.name,
          params,
          toolCallId,
        });
        
        if (hookOutcome.blocked) {
          throw new Error(hookOutcome.reason);
        }
        
        executeParams = hookOutcome.params;
        
        // ★ Step 2: 执行原始工具
        const rawResult = await tool.execute(
          toolCallId,
          executeParams,
          signal,
          onUpdate
        );
        
        // ★ Step 3: 标准化返回结果
        return normalizeToolExecutionResult({
          toolName: tool.name,
          result: rawResult,
        });
        
      } catch (err) {
        // ★ Step 4: 错误转结果（不中断Agent循环）
        return buildToolExecutionErrorResult({
          toolName: tool.name,
          message: err instanceof Error ? err.message : String(err),
        });
      }
    },
  }));
}

/**
 * 解析工具执行参数（兼容不同调用方式）
 */
function splitToolExecuteArgs(args: ToolExecuteArgs | any[]): ToolExecuteArgs {
  if (Array.isArray(args)) {
    return {
      toolCallId: args[0],
      params: args[1],
      signal: args[2],
      onUpdate: args[3],
    };
  }
  return args as ToolExecuteArgs;
}
