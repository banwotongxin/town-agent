/**
 * MCP工具适配器
 * 参考 OpenClaw: src/agents/pi-bundle-mcp-materialize.ts
 */

import { AgentTool, AgentToolResult } from '../tools/core';
import { MCPLazyLoader } from './lazy_loader';
import { z } from 'zod';

/**
 * MCP工具定义
 */
interface MCPToolDefinition {
  name: string;
  description: string;
  inputSchema: any;  // JSON Schema
}

/**
 * 将MCP工具转换为AgentTool
 */
export function wrapMcpToolAsAgentTool(
  mcpTool: MCPToolDefinition,
  mcpClient: any,
  serverName: string
): AgentTool {
  return {
    name: `${serverName}_${mcpTool.name}`,
    label: mcpTool.name,
    description: mcpTool.description,
    parameters: z.any(),  // TODO: 从inputSchema转换
    
    async execute(toolCallId, params) {
      try {
        // 调用MCP客户端
        const result = await mcpClient.callTool(mcpTool.name, params);
        
        return {
          content: [{
            type: 'text',
            text: typeof result === 'string' ? result : JSON.stringify(result),
          }],
        };
      } catch (error) {
        throw new Error(`MCP工具执行失败: ${error instanceof Error ? error.message : String(error)}`);
      }
    },
  };
}

/**
 * 从MCP服务器加载所有工具
 */
export async function loadMcpTools(
  loader: MCPLazyLoader,
  serverName: string
): Promise<AgentTool[]> {
  const client = await loader.getClient(serverName);
  
  if (!client) {
    console.warn(`[MCP] 无法连接到服务器: ${serverName}`);
    return [];
  }
  
  // 获取工具列表
  const tools = await client.listTools();
  
  // 转换为AgentTool
  return tools.map((tool: MCPToolDefinition) =>
    wrapMcpToolAsAgentTool(tool, client, serverName)
  );
}
