/**
 * 工具注册表
 * 参考 OpenClaw: src/agents/pi-tools.ts
 * 
 * 统一管理所有工具的注册、查询和过滤
 */

import { AnyAgentTool } from './core';
import { createReadTool, createWriteTool } from './fs-tools';
import { createExecTool } from './exec-tools';
import { createMCPCliTool } from './mcp_cli_tool';
import { applyToolPolicyPipeline, buildDefaultToolPolicyPipelineSteps } from './tool-policy-pipeline';
import { filterOwnerOnlyTools } from './tool-policy';
import { toToolDefinitions } from './adapter';

/**
 * 工具注册表
 * 统一管理所有工具的注册、查询和过滤
 */
export class ToolRegistry {
  private tools: Map<string, AnyAgentTool>;
  private isOwner: boolean;
  
  constructor(options?: { isOwner?: boolean }) {
    this.tools = new Map();
    this.isOwner = options?.isOwner ?? true;
  }
  
  /**
   * 注册工具
   */
  registerTool(tool: AnyAgentTool): void {
    this.tools.set(tool.name, tool);
  }
  
  /**
   * 注销工具
   */
  unregisterTool(toolName: string): boolean {
    return this.tools.delete(toolName);
  }
  
  /**
   * 获取工具
   */
  getTool(toolName: string): AnyAgentTool | undefined {
    return this.tools.get(toolName);
  }
  
  /**
   * 获取所有工具（经过策略过滤）
   */
  getAllTools(options?: {
    profilePolicy?: any;
    globalPolicy?: any;
    agentPolicy?: any;
    groupPolicy?: any;
    subagentPolicy?: any;
  }): AnyAgentTool[] {
    let tools = Array.from(this.tools.values());
    
    // ★ 应用策略管线
    const pipelineSteps = buildDefaultToolPolicyPipelineSteps({
      profilePolicy: options?.profilePolicy,
      globalPolicy: options?.globalPolicy,
      agentPolicy: options?.agentPolicy,
      groupPolicy: options?.groupPolicy,
      subagentPolicy: options?.subagentPolicy,
    });
    
    tools = applyToolPolicyPipeline({
      tools,
      steps: pipelineSteps,
    });
    
    // ★ 过滤 owner-only 工具
    tools = filterOwnerOnlyTools(tools, this.isOwner);
    
    return tools;
  }
  
  /**
   * 获取工具定义（用于传递给LLM）
   */
  getToolDefinitions(options?: any): any[] {
    const tools = this.getAllTools(options);
    return toToolDefinitions(tools);
  }
}

/**
 * 创建默认工具注册表
 */
export function createDefaultToolRegistry(options?: {
  isOwner?: boolean;
  workspaceRoot?: string;
}): ToolRegistry {
  const registry = new ToolRegistry({ isOwner: options?.isOwner });
  
  // 注册内置工具
  registry.registerTool(createReadTool({ workspaceRoot: options?.workspaceRoot }));
  registry.registerTool(createWriteTool({ workspaceRoot: options?.workspaceRoot }));
  registry.registerTool(createExecTool({
    allowedCommands: ['ls', 'cat', 'pwd', 'echo', 'dir'],  // 默认只允许安全命令
    timeout: 30000,
  }));
  
  // 注册MCP CLI工具示例
  // 注意：实际使用时需要根据MCP服务器的工具定义来创建
  // registry.registerTool(createMCPCliTool({
  //   toolName: 'web_search',
  //   description: '使用网络搜索获取最新信息',
  //   parameters: z.object({
  //     query: z.string().describe('搜索查询'),
  //     count: z.number().optional().describe('返回结果数量')
  //   })
  // }));
  
  return registry;
}
