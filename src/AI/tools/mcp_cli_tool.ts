/**
 * MCP CLI 工具适配器
 * 将MCP CLI调用封装为标准AgentTool接口
 */

import { AgentTool, AgentToolResult } from './core';
import { z } from 'zod';
import { getMcpCliManager } from '../cli/mcp_cli_manager';

/**
 * MCP CLI 工具配置接口
 */
export interface MCPCliToolConfig {
  toolName: string;              // MCP工具名称
  description: string;           // 工具描述
  parameters: z.ZodType<any>;    // 参数Schema
  serverName?: string;           // 服务器名称（可选）
}

/**
 * 创建MCP CLI工具
 * @param config 工具配置
 * @returns AgentTool实例
 */
export function createMCPCliTool(config: MCPCliToolConfig): AgentTool<any, unknown> {
  // 注意：由于 getMcpCliManager 现在是异步的，我们在 execute 内部 await
  return {
    name: config.toolName,
    description: config.description,
    parameters: config.parameters,
    ownerOnly: false,
    
    execute: async (
      toolCallId: string,
      params: any,
      signal?: AbortSignal,
      onUpdate?: (progress: string) => void
    ): Promise<AgentToolResult<unknown>> => {
      try {
        const { getMcpCliManager } = await import('../cli/mcp_cli_manager');
        const cliManager = await getMcpCliManager();
        
        if (onUpdate) {
          onUpdate(`正在通过 CLI 调用 MCP 工具: ${config.toolName}`);
        }
        
        // 通过 CLI 管理器执行命令
        const result = await cliManager.executeCliCommand(config.toolName, params);
        
        if (!result.success) {
          throw new Error(result.error || 'CLI命令执行失败');
        }
        
        // 返回标准格式结果
        return {
          content: [
            {
              type: 'text',
              text: typeof result.output === 'string' 
                ? result.output 
                : JSON.stringify(result.output, null, 2)
            }
          ],
          details: result.output
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          content: [
            {
              type: 'text',
              text: `MCP CLI工具调用失败: ${errorMessage}`
            }
          ]
        };
      }
    }
  };
}

/**
 * 从MCP服务器自动发现并创建CLI工具
 * @param serverName 服务器名称
 * @returns AgentTool数组
 */
export async function discoverAndCreateMCPCliTools(serverName: string): Promise<AgentTool<any, unknown>[]> {
  const tools: AgentTool<any, unknown>[] = [];
  
  try {
    console.log(`[MCPCliTool] 开始从服务器 ${serverName} 自动发现工具...`);
    
    const { getMcpLoader } = await import('../mcp/lazy_loader');
    const mcpLoader = await getMcpLoader();
    
    // 获取 MCP 客户端
    const client = await mcpLoader.getClient(serverName);
    if (!client || typeof client.listTools !== 'function') {
      console.warn(`[MCPCliTool] 服务器 ${serverName} 不支持列出工具或客户端未加载`);
      return tools;
    }
    
    // 获取工具列表
    const mcpTools = await client.listTools();
    console.log(`[MCPCliTool] 从 ${serverName} 发现了 ${mcpTools.length} 个工具`);
    
    // 为每个工具创建 CLI 包装
    for (const mcpTool of mcpTools) {
      try {
        // 动态构建 Zod Schema
        let paramSchema: z.ZodType<any> = z.object({});
        
        if (mcpTool.inputSchema && mcpTool.inputSchema.properties) {
          const shape: Record<string, z.ZodTypeAny> = {};
          const properties = mcpTool.inputSchema.properties;
          const required = mcpTool.inputSchema.required || [];
          
          for (const [key, value] of Object.entries(properties as Record<string, any>)) {
            let zodType: z.ZodTypeAny;
            
            switch (value.type) {
              case 'string':
                zodType = z.string().describe(value.description || '');
                break;
              case 'number':
              case 'integer':
                zodType = z.number().describe(value.description || '');
                break;
              case 'boolean':
                zodType = z.boolean().describe(value.description || '');
                break;
              case 'array':
                zodType = z.array(z.any()).describe(value.description || '');
                break;
              case 'object':
                zodType = z.record(z.string(), z.any()).describe(value.description || '');
                break;
              default:
                zodType = z.any().describe(value.description || '');
            }
            
            // 如果是必填项，则使用 .min(1) 或其他校验（这里简单处理）
            if (required.includes(key)) {
              shape[key] = zodType;
            } else {
              shape[key] = zodType.optional();
            }
          }
          
          paramSchema = z.object(shape);
        }
        
        // 创建 CLI 工具
        const cliTool = createMCPCliTool({
          toolName: mcpTool.name,
          description: mcpTool.description || `MCP工具: ${mcpTool.name}`,
          parameters: paramSchema,
          serverName: serverName
        });
        
        tools.push(cliTool);
        console.log(`[MCPCliTool] 已注册 CLI 工具: ${mcpTool.name}`);
      } catch (error) {
        console.error(`[MCPCliTool] 处理工具 ${mcpTool.name} 失败:`, error);
      }
    }
    
    return tools;
  } catch (error) {
    console.error(`[MCPCliTool] 发现工具失败:`, error);
    return tools;
  }
}
