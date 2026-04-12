/**
 * MCP服务器配置接口，定义了MCP服务器的配置信息
 */
import dotenv from 'dotenv';
dotenv.config();

export interface MCPServerConfig {
  name: string;                 // 服务器名称
  command?: string;              // 启动命令（用于stdio传输）
  args?: string[];               // 命令参数（用于stdio传输）
  env?: Record<string, string>;  // 环境变量
  timeout?: number;              // 超时时间
  url?: string;                  // HTTP/SSE URL（用于HTTP传输）
  apiKey?: string;               // API密钥（用于认证）
  transport?: 'stdio' | 'sse';   // 传输方式
}

/**
 * MCP懒加载器类，用于延迟加载MCP服务器客户端
 */
export class MCPLazyLoader {
  private configs: Record<string, MCPServerConfig>;  // 服务器配置
  private clients: Record<string, any>;             // 已加载的客户端
  private loading: Record<string, { locked: boolean; promise?: Promise<any> }>; // 加载状态

  /**
   * 构造函数
   */
  constructor() {
    this.configs = {};
    this.clients = {};
    this.loading = {};
  }

  /**
   * 注册服务器
   * @param config 服务器配置
   */
  registerServer(config: MCPServerConfig): void {
    this.configs[config.name] = config;
    this.loading[config.name] = { locked: false };
  }

  /**
   * 从字典注册服务器
   * @param name 服务器名称
   * @param configDict 配置字典
   */
  registerFromDict(name: string, configDict: Record<string, any>): void {
    const config: MCPServerConfig = {
      name,
      command: configDict.command || '',
      args: configDict.args || [],
      env: configDict.env || {},
      timeout: configDict.timeout || 30,
      url: configDict.url,
      apiKey: configDict.apiKey,
      transport: configDict.transport || 'stdio'
    };
    this.registerServer(config);
  }

  /**
   * 获取客户端
   * @param serverName 服务器名称
   * @returns 客户端实例或undefined
   */
  async getClient(serverName: string): Promise<any | undefined> {
    // 如果已加载，直接返回
    if (serverName in this.clients) {
      return this.clients[serverName];
    }

    // 初始化加载状态
    if (!(serverName in this.loading)) {
      this.loading[serverName] = { locked: false };
    }

    const loadingInfo = this.loading[serverName];

    // 如果正在加载，等待完成
    if (loadingInfo.locked && loadingInfo.promise) {
      return await loadingInfo.promise;
    }

    // 开始加载
    loadingInfo.locked = true;
    loadingInfo.promise = this._loadClient(serverName);

    try {
      const client = await loadingInfo.promise;
      if (client) {
        this.clients[serverName] = client;
      }
      return client;
    } finally {
      loadingInfo.locked = false;
      loadingInfo.promise = undefined;
    }
  }

  /**
   * 加载客户端
   * @param serverName 服务器名称
   * @returns 客户端实例或undefined
   */
  private async _loadClient(serverName: string): Promise<any | undefined> {
    if (!(serverName in this.configs)) {
      console.log(`MCP 服务器 ${serverName} 未注册`);
      return undefined;
    }

    const config = this.configs[serverName];

    try {
      console.log(`正在启动 MCP 服务器：${config.name}`);

      // 根据传输方式创建不同的客户端
      if (config.transport === 'sse' && config.url) {
        // 使用HTTP/SSE传输
        const httpClient = new SSEMCPClient(config);
        await httpClient.connect();
        return httpClient;
      } else {
        // 不支持的传输方式
        console.warn(`[MCP] 不支持的传输方式: ${config.transport || 'undefined'}，服务器: ${config.name}`);
        return undefined;
      }
    } catch (e) {
      console.error(`启动 MCP 服务器 ${config.name} 失败：`, e);
      return undefined;
    }
  }

  /**
   * 卸载客户端
   * @param serverName 服务器名称
   * @returns 是否成功卸载
   */
  async unloadClient(serverName: string): Promise<boolean> {
    if (serverName in this.clients) {
      const client = this.clients[serverName];
      if (client.close) {
        await client.close();
      }
      delete this.clients[serverName];
      return true;
    }
    return false;
  }

  /**
   * 卸载所有客户端
   */
  async unloadAll(): Promise<void> {
    for (const serverName of Object.keys(this.clients)) {
      await this.unloadClient(serverName);
    }
  }

  /**
   * 检查服务器是否已加载
   * @param serverName 服务器名称
   * @returns 是否已加载
   */
  isLoaded(serverName: string): boolean {
    return serverName in this.clients;
  }

  /**
   * 获取已加载的服务器列表
   * @returns 服务器名称数组
   */
  getLoadedServers(): string[] {
    return Object.keys(this.clients);
  }
}

/**
 * HTTP/SSE MCP客户端类
 * 用于连接基于HTTP/SSE的MCP服务器（如阿里云DashScope）
 */
export class SSEMCPClient {
  private config: MCPServerConfig;
  private isConnected: boolean;
  private tools: Array<{
    name: string;
    description: string;
    inputSchema?: any;
  }>;
  private baseUrl: string;
  private apiKey: string;

  /**
   * 构造函数
   * @param config MCP服务器配置
   */
  constructor(config: MCPServerConfig) {
    this.config = config;
    this.isConnected = false;
    this.tools = [];
    this.baseUrl = config.url || '';
    this.apiKey = config.apiKey || process.env.DASHSCOPE_WEBSERACH_API_KEY || process.env.DASHSCOPE_WEBSEARCH_API_KEY || '';
    console.log(`[SSEMCPClient] 构造函数 - API Key: ${this.apiKey ? '已配置 (' + this.apiKey.substring(0, 5) + '...)' : '未配置'}`);
  }

  /**
   * 连接服务器
   */
  async connect(): Promise<void> {
    try {
      console.log(`[SSEMCPClient] 连接到SSE服务器：${this.baseUrl}`);
      console.log(`[SSEMCPClient] API Key: ${this.apiKey ? '已配置' : '未配置'}`);
      
      // 验证配置
      if (!this.baseUrl) {
        throw new Error('MCP服务器URL未配置');
      }
      if (!this.apiKey) {
        throw new Error('API密钥未配置');
      }

      // 发现可用工具
      await this.discoverTools();
      
      this.isConnected = true;
      console.log(`[SSEMCPClient] 成功连接到服务器，发现 ${this.tools.length} 个工具`);
    } catch (error) {
      console.error('[SSEMCPClient] 连接失败:', error);
      throw error;
    }
  }

  /**
   * 发现可用工具
   */
  private async discoverTools(): Promise<void> {
    try {
      console.log('[SSEMCPClient] 正在发现工具...');
      
      // 调用MCP的tools/list方法
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/list',
          params: {}
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[SSEMCPClient] 获取工具列表失败:', errorText);
        throw new Error(`HTTP错误 ${response.status}: ${errorText}`);
      }

      const result: any = await response.json();
      console.log('[SSEMCPClient] tools/list响应:', JSON.stringify(result, null, 2));

      // 解析工具列表
      if (result.result && result.result.tools) {
        this.tools = result.result.tools.map((tool: any) => ({
          name: tool.name,
          description: tool.description || '',
          inputSchema: tool.inputSchema
        }));
        console.log(`[SSEMCPClient] 发现 ${this.tools.length} 个工具`);
      } else {
        console.warn('[SSEMCPClient] 未找到工具列表，使用默认工具');
        // 如果无法获取工具列表，使用默认工具
        this.tools = [
          {
            name: 'web_search',
            description: '使用阿里云WebSearch进行网络搜索，获取最新的网络信息',
            inputSchema: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: '搜索查询词'
                },
                count: {
                  type: 'number',
                  description: '返回结果数量',
                  default: 10
                }
              },
              required: ['query']
            }
          }
        ];
      }
    } catch (error) {
      console.error('[SSEMCPClient] 发现工具失败:', error);
      throw error;
    }
  }

  /**
   * 关闭连接
   */
  async close(): Promise<void> {
    this.isConnected = false;
    console.log(`[SSEMCPClient] 断开连接：${this.config.name}`);
  }

  /**
   * 列出工具
   * @returns 工具列表
   */
  async listTools(): Promise<Array<{name: string; description: string; inputSchema?: any}>> {
    return this.tools;
  }

  /**
   * 调用工具
   * @param toolName 工具名称
   * @param params 工具参数
   * @returns 工具执行结果
   */
  async callTool(toolName: string, params: Record<string, any>): Promise<any> {
    if (!this.isConnected) {
      throw new Error("未连接到服务器");
    }

    console.log(`[SSEMCPClient] 调用工具：${toolName}, 参数：`, params);

    try {
      // 根据工具名称调用相应的API
      // 支持多种工具名称格式
      const actualToolName = this.getActualToolName(toolName);
      
      if (actualToolName) {
        return await this.callMCPTool(actualToolName, params);
      } else {
        throw new Error(`未知工具: ${toolName}`);
      }
    } catch (error) {
      console.error('[SSEMCPClient] 工具调用失败:', error);
      throw error;
    }
  }

  /**
   * 获取实际的MCP工具名称
   * @param toolName 用户提供的工具名称
   * @returns 实际的MCP工具名称
   */
  private getActualToolName(toolName: string): string | null {
    // 直接匹配
    const directMatch = this.tools.find(t => t.name === toolName);
    if (directMatch) {
      return toolName;
    }

    // 尝试去除前缀（如 dashscope_websearch_）
    const parts = toolName.split('_');
    if (parts.length > 1) {
      const shortName = parts.slice(1).join('_');
      const prefixMatch = this.tools.find(t => t.name === shortName || t.name.endsWith(shortName));
      if (prefixMatch) {
        return prefixMatch.name;
      }
    }

    // 尝试模糊匹配
    const fuzzyMatch = this.tools.find(t => 
      toolName.includes(t.name) || t.name.includes(toolName)
    );
    if (fuzzyMatch) {
      return fuzzyMatch.name;
    }

    return null;
  }

  /**
   * 调用MCP工具
   * @param toolName MCP工具名称
   * @param params 工具参数
   * @returns 工具执行结果
   */
  private async callMCPTool(toolName: string, params: Record<string, any>): Promise<any> {
    try {
      console.log(`[SSEMCPClient] 发送MCP工具调用请求: ${toolName}`);
      
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: {
            name: toolName,
            arguments: params
          }
        })
      });

      console.log('[SSEMCPClient] 响应状态:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[SSEMCPClient] API响应错误详情:', errorText);
        throw new Error(`HTTP错误 ${response.status}: ${errorText}`);
      }

      const result: any = await response.json();
      console.log('[SSEMCPClient] 工具调用结果:', JSON.stringify(result, null, 2));

      // 检查是否有错误
      if (result.error) {
        throw new Error(`MCP工具调用错误: ${JSON.stringify(result.error)}`);
      }

      if (result.result && result.result.isError) {
        const errorMessage = result.result.content?.[0]?.text || '未知错误';
        throw new Error(`工具执行错误: ${errorMessage}`);
      }

      return result.result || result;
    } catch (error) {
      console.error('[SSEMCPClient] MCP工具调用失败:', error);
      throw error;
    }
  }
}

/**
 * 创建MCP加载器
 * @returns MCP加载器实例
 */
export function createMcpLoader(): MCPLazyLoader {
  return new MCPLazyLoader();
}

/**
 * 默认MCP服务器配置
 */
export const DEFAULT_MCP_SERVERS = {
  // 阿里云DashScope WebSearch MCP
  dashscope_websearch: {
    url: "https://dashscope.aliyuncs.com/api/v1/mcps/WebSearch/mcp",
    apiKey: process.env.DASHSCOPE_WEBSERACH_API_KEY || process.env.DASHSCOPE_WEBSEARCH_API_KEY || '',
    transport: "sse",
    timeout: 30
  }
};

/**
 * 设置默认MCP服务器
 * @param loader MCP加载器实例
 */
export function setupDefaultMcpServers(loader: MCPLazyLoader): void {
  for (const [name, config] of Object.entries(DEFAULT_MCP_SERVERS)) {
    loader.registerFromDict(name, config);
  }
}

// 全局MCP加载器实例
let globalLoader: MCPLazyLoader | null = null;

/**
 * 获取全局MCP加载器
 * @returns MCP加载器实例
 */
export function getMcpLoader(): MCPLazyLoader {
  if (!globalLoader) {
    globalLoader = createMcpLoader();
    setupDefaultMcpServers(globalLoader);
  }
  return globalLoader;
}
