/**
 * MCP CLI 命令行入口
 * 用于通过命令行调用MCP工具
 */

import { getMcpLoader } from '../src/AI/mcp/lazy_loader';
import { parseArgs } from 'util';

interface CliArgs {
  tool: string;
  params: string;
}

/**
 * 解析命令行参数
 */
function parseCliArguments(): CliArgs {
  const args = process.argv.slice(2);
  
  // 简单解析 --tool 和 --params 参数
  let tool = '';
  let params = '{}';
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--tool' && i + 1 < args.length) {
      tool = args[i + 1];
      i++; // 跳过下一个参数
    } else if (args[i] === '--params' && i + 1 < args.length) {
      params = args[i + 1];
      i++; // 跳过下一个参数
    }
  }
  
  return { tool, params };
}

/**
 * 主函数：执行MCP工具调用
 */
async function main() {
  try {
    // 解析命令行参数
    const { tool, params } = parseCliArguments();
    
    if (!tool) {
      console.error('错误: 缺少 --tool 参数');
      process.exit(1);
    }
    
    // 解析JSON参数
    let parsedParams: Record<string, any>;
    try {
      parsedParams = JSON.parse(params);
    } catch (e) {
      console.error(`错误: 无法解析参数JSON: ${params}`);
      process.exit(1);
    }
    
    console.log(`[MCP CLI] 调用工具: ${tool}`);
    console.log(`[MCP CLI] 参数:`, parsedParams);
    
    // 获取MCP加载器
    const mcpLoader = await getMcpLoader();
    
    // 尝试查找并调用工具
    // 首先检查已注册的服务器配置
    const { DEFAULT_MCP_SERVERS } = await import('../src/AI/mcp/lazy_loader');
    const configuredServers = Object.keys(DEFAULT_MCP_SERVERS);
    
    if (configuredServers.length === 0) {
      console.error('错误: 没有配置的MCP服务器');
      process.exit(1);
    }
    
    console.log(`[MCP CLI] 发现 ${configuredServers.length} 个配置的服务器:`, configuredServers);
    
    // 连接到所有配置的服务器
    for (const serverName of configuredServers) {
      try {
        console.log(`[MCP CLI] 正在连接服务器: ${serverName}`);
        await mcpLoader.getClient(serverName);
        console.log(`[MCP CLI] ✓ 成功连接到 ${serverName}`);
      } catch (error) {
        console.warn(`[MCP CLI] ✗ 连接服务器 ${serverName} 失败:`, error instanceof Error ? error.message : String(error));
      }
    }
    
    // 检查已加载的服务器
    const loadedServers = mcpLoader.getLoadedServers();
    
    if (loadedServers.length === 0) {
      console.error('错误: 没有可用的MCP服务器（所有连接都失败了）');
      process.exit(1);
    }
    
    console.log(`[MCP CLI] 已加载 ${loadedServers.length} 个服务器:`, loadedServers);
    
    // 遍历所有已加载的服务器，尝试调用工具
    let lastError: Error | null = null;
    for (const serverName of loadedServers) {
      try {
        const client = await mcpLoader.getClient(serverName);
        if (client && typeof client.callTool === 'function') {
          console.log(`[MCP CLI] 在服务器 ${serverName} 上调用工具 ${tool}`);
          const result = await client.callTool(tool, parsedParams);
          
          // 输出结果为JSON格式，便于上层解析
          console.log(JSON.stringify(result, null, 2));
          process.exit(0);
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.warn(`[MCP CLI] 在服务器 ${serverName} 上调用失败:`, error);
        continue; // 尝试下一个服务器
      }
    }
    
    // 如果所有服务器都失败了
    if (lastError) {
      console.error(`[MCP CLI] 所有服务器调用失败:`, lastError.message);
      process.exit(1);
    } else {
      console.error(`[MCP CLI] 未找到工具: ${tool}`);
      process.exit(1);
    }
  } catch (error) {
    console.error('[MCP CLI] 执行失败:', error);
    process.exit(1);
  }
}

// 执行主函数
main();
