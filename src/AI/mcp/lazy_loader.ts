/**
 * MCP服务器配置接口，定义了MCP服务器的配置信息
 */
export interface MCPServerConfig {
  name: string;                 // 服务器名称
  command: string;              // 启动命令
  args: string[];               // 命令参数
  env: Record<string, string>;  // 环境变量
  timeout: number;              // 超时时间
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
      timeout: configDict.timeout || 30
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

      // 模拟实现
      const mockClient = new MockMCPClient(config.name);
      await mockClient.connect();

      return mockClient;
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
 * 模拟MCP客户端类
 */
export class MockMCPClient {
  serverName: string;              // 服务器名称
  isConnected: boolean;            // 是否已连接
  private tools: Record<string, string>[];  // 工具列表

  /**
   * 构造函数
   * @param serverName 服务器名称
   */
  constructor(serverName: string) {
    this.serverName = serverName;
    this.isConnected = false;
    this.tools = [];
  }

  /**
   * 连接服务器
   */
  async connect(): Promise<void> {
    this.isConnected = true;
    console.log(`[MockMCPClient] 连接到服务器：${this.serverName}`);

    // 模拟一些工具
    this.tools = [
      { name: `${this.serverName}_tool_1`, description: "示例工具 1" },
      { name: `${this.serverName}_tool_2`, description: "示例工具 2" }
    ];
  }

  /**
   * 关闭连接
   */
  async close(): Promise<void> {
    this.isConnected = false;
    console.log(`[MockMCPClient] 断开连接：${this.serverName}`);
  }

  /**
   * 列出工具
   * @returns 工具列表
   */
  async listTools(): Promise<Record<string, string>[]> {
    return this.tools;
  }

  /**
   * 调用工具
   * @param toolName 工具名称
   * @param kwargs 工具参数
   * @returns 工具执行结果
   */
  async callTool(toolName: string, kwargs: Record<string, any>): Promise<any> {
    if (!this.isConnected) {
      throw new Error("未连接到服务器");
    }

    console.log(`[MockMCPClient] 调用工具：${toolName}, 参数：`, kwargs);
    return `[${this.serverName}] 工具 ${toolName} 执行结果`;
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
  literature_search: {
    command: "python",
    args: ["-m", "mcp_literature_server"],
    timeout: 30
  },
  medical_database: {
    command: "python",
    args: ["-m", "mcp_medical_server"],
    timeout: 30
  },
  code_analysis: {
    command: "npx",
    args: ["@mcp/code-analyzer"],
    timeout: 60
  },
  education_tools: {
    command: "python",
    args: ["-m", "mcp_education_server"],
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
