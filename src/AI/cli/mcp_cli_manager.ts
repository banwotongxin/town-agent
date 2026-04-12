/**
 * MCP CLI 工具封装
 * 将MCP工具调用转换为命令行接口形式
 */

import { MCPLazyLoader, getMcpLoader } from '../mcp/lazy_loader';
import { spawn } from 'child_process';
import { join } from 'path';

/**
 * MCP CLI 命令配置接口
 */
export interface MCPCliCommandConfig {
  toolName: string;           // 工具名称
  description: string;        // 工具描述
  params: Record<string, any>; // 参数定义
  serverName?: string;        // 服务器名称（可选）
}

/**
 * MCP CLI 执行结果接口
 */
export interface MCPCliResult {
  success: boolean;
  output?: any;
  error?: string;
  exitCode?: number;
}

/**
 * MCP CLI 管理器类
 * 负责将MCP工具调用转换为CLI命令执行
 */
export class MCPCliManager {
  private mcpLoader: MCPLazyLoader;
  private cliCommands: Map<string, MCPCliCommandConfig>;

  constructor(mcpLoader?: MCPLazyLoader) {
    // 注意：由于 getMcpLoader 现在是异步的，这里如果传入的是 Promise 需要处理
    // 但为了保持构造函数同步，我们通常会在外部初始化好 loader 再传入
    // 或者在 executeCliCommand 等异步方法中 await getMcpLoader()
    this.mcpLoader = mcpLoader || new (require('../mcp/lazy_loader').MCPLazyLoader)(); 
    this.cliCommands = new Map();
  }

  /**
   * 注册MCP工具为CLI命令
   * @param config CLI命令配置
   */
  registerCliCommand(config: MCPCliCommandConfig): void {
    this.cliCommands.set(config.toolName, config);
  }

  /**
   * 执行MCP CLI命令
   * @param toolName 工具名称
   * @param params 工具参数
   * @returns 执行结果
   */
  async executeCliCommand(toolName: string, params: Record<string, any>): Promise<MCPCliResult> {
    try {
      // 检查是否已注册为CLI命令
      if (!this.cliCommands.has(toolName)) {
        return {
          success: false,
          error: `未找到CLI命令: ${toolName}`
        };
      }

      // 直接调用CLI脚本，避免shell转义问题
      return await this.executeCliScriptDirectly(toolName, params);
    } catch (error) {
      return {
        success: false,
        error: `执行CLI命令失败: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * 直接执行CLI脚本（使用spawn，避免shell转义问题）
   * @param toolName 工具名称
   * @param params 工具参数
   * @returns 执行结果
   */
  private executeCliScriptDirectly(toolName: string, params: Record<string, any>): Promise<MCPCliResult> {
    return new Promise((resolve) => {
      const cliScriptPath = join(process.cwd(), 'dist', 'cli', 'mcp_tool_runner.js');
      const paramStr = JSON.stringify(params);
      
      console.log(`[MCPCliManager] 执行CLI脚本: ${toolName}`);
      console.log(`[MCPCliManager] 参数:`, params);
      
      const childProcess = spawn('node', [
        cliScriptPath,
        '--tool',
        toolName,
        '--params',
        paramStr
      ], {
        shell: false,
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true
      });

  /**
   * 构建CLI命令字符串
   * @param config 命令配置
   * @param params 参数
   * @returns CLI命令字符串
   */
  private buildCliCommand(config: MCPCliCommandConfig, params: Record<string, any>): string {
    // 基础命令格式：node cli/mcp_tool.js --tool <toolName> --params <json>
    const cliScriptPath = join(process.cwd(), 'dist', 'cli', 'mcp_tool_runner.js');
    
    // 构建参数字符串
    const paramStr = JSON.stringify(params).replace(/"/g, '\\"');
    
    return `node "${cliScriptPath}" --tool "${config.toolName}" --params "${paramStr}"`;
  }

  /**
   * 执行Shell命令
   * @param command Shell命令
   * @returns 执行结果
   */
  private executeShellCommand(command: string): Promise<MCPCliResult> {
    return new Promise((resolve) => {
      console.log(`[MCPCliManager] 执行CLI命令: ${command}`);
      
      const childProcess = spawn('node', [
        join(process.cwd(), 'dist', 'cli', 'mcp_tool_runner.js'),
        '--tool',
        command.match(/--tool "([^"]+)"/)?.[1] || '',
        '--params',
        command.match(/--params "(.+)"$/)?.[1] || '{}'
      ], {
        shell: false,
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true
      });

      let stdout = '';
      let stderr = '';

      childProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      childProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      childProcess.on('close', (code) => {
        // 忽略libuv的断言错误（这是Windows上的已知问题，不影响结果）
        if (stderr.includes('UV_HANDLE_CLOSING')) {
          console.warn('[MCPCliManager] 警告: 检测到libuv进程清理警告（可忽略）');
          // 尝试从stdout中提取有效结果
          try {
            const lines = stdout.trim().split('\n');
            // 查找最后一个有效的JSON行
            for (let i = lines.length - 1; i >= 0; i--) {
              const line = lines[i].trim();
              if (line.startsWith('{') || line.startsWith('[')) {
                const output = JSON.parse(line);
                resolve({
                  success: true,
                  output: output,
                  exitCode: code ?? 0
                });
                return;
              }
            }
          } catch (e) {
            // 如果解析失败，继续下面的逻辑
          }
        }
        
        if (code === 0) {
          try {
            // 尝试解析JSON输出
            const output = JSON.parse(stdout.trim());
            resolve({
              success: true,
              output: output,
              exitCode: code
            });
          } catch (e) {
            // 如果不是JSON，返回原始输出
            resolve({
              success: true,
              output: stdout.trim(),
              exitCode: code
            });
          }
        } else {
          resolve({
            success: false,
            error: stderr || `命令执行失败，退出码: ${code}`,
            exitCode: code ?? undefined
          });
        }
      });

      childProcess.on('error', (error) => {
        resolve({
          success: false,
          error: `进程启动失败: ${error.message}`,
          exitCode: -1
        });
      });
    });
  }

  /**
   * 获取所有注册的CLI命令
   * @returns CLI命令列表
   */
  getRegisteredCommands(): MCPCliCommandConfig[] {
    return Array.from(this.cliCommands.values());
  }

  /**
   * 检查命令是否已注册
   * @param toolName 工具名称
   * @returns 是否已注册
   */
  isCommandRegistered(toolName: string): boolean {
    return this.cliCommands.has(toolName);
  }
}

/**
 * 创建MCP CLI管理器实例
 * @returns MCP CLI管理器实例
 */
export function createMcpCliManager(): MCPCliManager {
  return new MCPCliManager();
}

// 全局MCP CLI管理器实例
let globalMcpCliManager: MCPCliManager | null = null;

/**
 * 获取全局MCP CLI管理器
 * @returns MCP CLI管理器实例
 */
export async function getMcpCliManager(): Promise<MCPCliManager> {
  if (!globalMcpCliManager) {
    globalMcpCliManager = createMcpCliManager();
    
    // 启动时预加载：从所有配置的 MCP 服务器发现工具并注册为 CLI 命令
    const { getMcpLoader } = await import('../mcp/lazy_loader');
    const mcpLoader = getMcpLoader();
    const loadedServers = mcpLoader.getLoadedServers();
    
    for (const serverName of loadedServers) {
      try {
        const client = await mcpLoader.getClient(serverName);
        if (client && typeof client.listTools === 'function') {
          console.log(`[CLI预加载] 正在从 ${serverName} 发现工具...`);
          const tools = await client.listTools();
          
          for (const tool of tools) {
            if (!globalMcpCliManager.isCommandRegistered(tool.name)) {
              // 构建符合 JSON Schema 规范的参数定义
              let paramsSchema: any = {};
              
              if (tool.inputSchema) {
                paramsSchema = {
                  type: tool.inputSchema.type || 'object',
                  properties: tool.inputSchema.properties || {},
                  required: tool.inputSchema.required || []
                };
              }
              
              globalMcpCliManager.registerCliCommand({
                toolName: tool.name,
                description: tool.description || '',
                params: paramsSchema,
                serverName: serverName
              });
              console.log(`[CLI预加载] 已注册 CLI 命令: ${tool.name}`);
            }
          }
        }
      } catch (error) {
        console.warn(`[CLI预加载] 服务器 ${serverName} 预加载失败:`, error);
      }
    }
  }
  return globalMcpCliManager;
}
