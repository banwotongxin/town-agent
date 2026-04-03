export interface MCPServerConfig {
  name: string;
  command: string;
  args: string[];
  env: Record<string, string>;
  timeout: number;
}

export class MCPLazyLoader {
  private configs: Record<string, MCPServerConfig>;
  private clients: Record<string, any>;
  private loading: Record<string, { locked: boolean; promise?: Promise<any> }>;

  constructor() {
    this.configs = {};
    this.clients = {};
    this.loading = {};
  }

  registerServer(config: MCPServerConfig): void {
    this.configs[config.name] = config;
    this.loading[config.name] = { locked: false };
  }

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

  async unloadAll(): Promise<void> {
    for (const serverName of Object.keys(this.clients)) {
      await this.unloadClient(serverName);
    }
  }

  isLoaded(serverName: string): boolean {
    return serverName in this.clients;
  }

  getLoadedServers(): string[] {
    return Object.keys(this.clients);
  }
}

export class MockMCPClient {
  serverName: string;
  isConnected: boolean;
  private tools: Record<string, string>[];

  constructor(serverName: string) {
    this.serverName = serverName;
    this.isConnected = false;
    this.tools = [];
  }

  async connect(): Promise<void> {
    this.isConnected = true;
    console.log(`[MockMCPClient] 连接到服务器：${this.serverName}`);

    // 模拟一些工具
    this.tools = [
      { name: `${this.serverName}_tool_1`, description: "示例工具 1" },
      { name: `${this.serverName}_tool_2`, description: "示例工具 2" }
    ];
  }

  async close(): Promise<void> {
    this.isConnected = false;
    console.log(`[MockMCPClient] 断开连接：${this.serverName}`);
  }

  async listTools(): Promise<Record<string, string>[]> {
    return this.tools;
  }

  async callTool(toolName: string, kwargs: Record<string, any>): Promise<any> {
    if (!this.isConnected) {
      throw new Error("未连接到服务器");
    }

    console.log(`[MockMCPClient] 调用工具：${toolName}, 参数：`, kwargs);
    return `[${this.serverName}] 工具 ${toolName} 执行结果`;
  }
}

export function createMcpLoader(): MCPLazyLoader {
  return new MCPLazyLoader();
}

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

export function setupDefaultMcpServers(loader: MCPLazyLoader): void {
  for (const [name, config] of Object.entries(DEFAULT_MCP_SERVERS)) {
    loader.registerFromDict(name, config);
  }
}

let globalLoader: MCPLazyLoader | null = null;

export function getMcpLoader(): MCPLazyLoader {
  if (!globalLoader) {
    globalLoader = createMcpLoader();
    setupDefaultMcpServers(globalLoader);
  }
  return globalLoader;
}
