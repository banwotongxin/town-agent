# MCP（Model Context Protocol）系统技术文档

> **模块位置**: `src/AI/mcp/`
> **难度等级**: ⭐⭐⭐⭐ (中高级)
> **预计学习时间**: 35 分钟

---

## 一、什么是MCP？（小白通俗解释）

### 1.1 生活化类比

**MCP = Model Context Protocol（模型上下文协议）**

想象你的 AI 助手是一个**超级聪明的员工**，但它只能在办公室里工作。如果它想：
- 🔍 上网搜索最新新闻
- 📊 查询股票数据
- 🗺️ 查地图导航

这些能力它自己没有，需要借助**外部服务商**。**MCP 就是连接 AI 和外部服务的"标准接口"**。

```
┌─────────────┐      ┌───────────┐      ┌─────────────┐
│   AI 助手    │ ◄──► │   MCP     │ ◄───► │  外部服务    │
│ (赛博小镇)   │      │  (翻译官)  │      │ (搜索/数据库) │
└─────────────┘      └───────────┘      └─────────────┘
                          │
                    统一的通信协议
                   不管外部服务是什么，
                   都用同样的方式对接！
```

### 1.2 在赛博小镇中的作用

| 功能 | 说明 |
|------|------|
| 网络搜索 | 让角色能获取实时信息 |
| 扩展能力 | 未来可接入更多外部服务 |
| 标准化 | 用统一方式调用各种服务 |

---

## 二、核心概念

### 2.1 MCPServerConfig（服务器配置）

定义如何连接一个 MCP 服务器：

```typescript
interface MCPServerConfig {
  name: string;                 // ★ 服务器名称（唯一标识）
  command?: string;              // 启动命令（stdio模式）
  args?: string[];               // 命令参数
  env?: Record<string, string>;  // 环境变量
  timeout?: number;              // 超时时间（秒）
  url?: string;                  // HTTP/SSE地址
  apiKey?: string;               // API密钥
  transport?: 'stdio' | 'sse';   // ★ 传输方式
}
```

**两种传输方式对比**：

| 特征 | stdio（标准输入输出） | SSE（Server-Sent Events） |
|------|---------------------|--------------------------|
| 原理 | 启动本地进程通信 | 通过HTTP长连接 |
| 用途 | 本地工具服务 | 远程API服务 |
| 示例 | 运行Python脚本 | 调用阿里云API |
| 当前支持 | ⚠️ 未实现 | ✅ 已支持 |

### 2.2 JSON-RPC 2.0 协议

MCP 使用 JSON-RPC 2.0 协议通信，格式如下：

```json
// 请求：列出可用工具
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/list",
  "params": {}
}

// 请求：调用某个工具
{
  "jsonrpc": "2.0", 
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "web_search",
    "arguments": { "query": "今天天气" }
  }
}
```

---

## 三、MCPLazyLoader（懒加载管理器）⭐ 核心

### 3.1 什么是懒加载？

**普通加载**：程序一启动就连接所有服务器（慢，浪费资源）
**懒加载**：第一次使用时才连接（快，按需加载）

```typescript
// 位置: src/AI/mcp/lazy_loader.ts
export class MCPLazyLoader {
  private configs: Record<string, MCPServerConfig>;   // 服务器配置表
  private clients: Record<string, any>;                // 已连接的客户端
  private loading: Record<string, {                   // 加载状态
    locked: boolean;
    promise?: Promise<any>;
  }>;
}
```

### 3.2 基本使用

```typescript
import { getMcpLoader } from './mcp';

// 1. 获取全局唯一的加载器实例
const loader = getMcpLoader();

// 2. 注册服务器配置
loader.registerServer({
  name: 'my-search',
  url: 'https://api.example.com/mcp',
  transport: 'sse',
  apiKey: 'your-api-key'
});

// 3. 获取客户端（首次调用时自动连接！）
const client = await loader.getClient('my-search');

// 4. 使用客户端调用工具
const results = await client.callTool('web_search', { query: 'AI技术' });
```

### 3.3 API 完整列表

| 方法 | 说明 | 返回值 |
|------|------|--------|
| `registerServer(config)` | 注册服务器配置 | void |
| `registerFromDict(name, dict)` | 从字典注册（简化写法） | void |
| `getClient(name)` | 获取/创建客户端（懒加载） | Promise\<client\> |
| `unloadClient(name)` | 断开并移除客户端 | Promise\<boolean\> |
| `unloadAll()` | 断开所有客户端 | Promise\<void\> |
| `isLoaded(name)` | 检查是否已加载 | boolean |
| `getLoadedServers()` | 获取已加载的服务器名列表 | string[] |

### 3.4 懒加载内部机制（带锁防并发）

```
线程A: getClient('search') ──┐
                              ├──→ 检测到正在加载 → 等待...
线程B: getClient('search') ──┘
                              │
                         加载完成 ↓
                              │
                    A和B都拿到同一个client实例
```

```typescript
async getClient(serverName: string): Promise<any | undefined> {
  // 如果已加载，直接返回
  if (serverName in this.clients) {
    return this.clients[serverName];
  }

  const loadingInfo = this.loading[serverName];

  // 如果正在加载，等待同一个Promise（防止重复加载）
  if (loadingInfo.locked && loadingInfo.promise) {
    return await loadingInfo.promise;
  }

  // 开始加载
  loadingInfo.locked = true;
  loadingInfo.promise = this._loadClient(serverName);

  try {
    const client = await loadingInfo.promise;
    if (client) this.clients[serverName] = client;
    return client;
  } finally {
    loadingInfo.locked = false;
    loadingInfo.promise = undefined;
  }
}
```

---

## 四、SSEMCPClient（HTTP/SSE客户端）

### 4.1 是什么？

专门用于连接基于 **HTTP/SSE** 的 MCP 服务器，比如阿里云 DashScope WebSearch API。

### 4.2 连接流程

```
1. new SSEMCPClient(config)
        ↓
2. .connect()
        ↓
3. 验证配置 (URL + API Key 必须有)
        ↓
4. discoverTools() → 调用 tools/list 获取可用工具列表
        ↓
5. 连接成功！可以 callTool() 了
```

### 4.3 工具名称模糊匹配 ⭐ 特色功能

当AI调用的工具名和实际注册的不完全一致时，自动匹配：

```typescript
private getActualToolName(toolName: string): string | null {
  // 1. 直接精确匹配
  const directMatch = this.tools.find(t => t.name === toolName);
  if (directMatch) return toolName;

  // 2. 去前缀匹配 (如 dashscope_web_search → web_search)
  const parts = toolName.split('_');
  if (parts.length > 1) {
    const shortName = parts.slice(1).join('_');
    const prefixMatch = this.tools.find(
      t => t.name === shortName || t.name.endsWith(shortName)
    );
    if (prefixMatch) return prefixMatch.name;
  }

  // 3. 模糊匹配 (包含关系)
  const fuzzyMatch = this.tools.find(t =>
    toolName.includes(t.name) || t.name.includes(toolName)
  );
  if (fuzzyMatch) return fuzzyMatch.name;

  return null;  // 都匹配不上
}
```

**示例**：
```
AI调用: "dashscope_web_search"
实际工具: "web_search"
→ 匹配成功！（去前缀）

AI调用: "websearch"
实际工具: "web_search"
→ 匹配成功！（模糊包含）
```

### 4.4 完整使用示例

```typescript
import { SSEMCPClient, MCPServerConfig } from './lazy_loader';

// 创建配置
const config: MCPServerConfig = {
  name: 'dashscope-websearch',
  url: 'https://dashscope.aliyuncs.com/api/v1/mcps/WebSearch/mcp',
  apiKey: process.env.DASHSCOPE_API_KEY || '',
  transport: 'sse'
};

// 创建客户端
const client = new SSEMCPClient(config);

// 连接并发现工具
await client.connect();
console.log(`发现了 ${await client.listTools().length} 个工具`);

// 调用工具
const result = await client.callTool('web_search', {
  query: 'TypeScript教程',
  count: 5
});
console.log(result);
```

---

## 五、默认配置与全局实例

### 5.1 默认服务器配置

项目预置了**阿里云DashScope WebSearch** 作为默认MCP服务：

```typescript
export const DEFAULT_MCP_SERVERS = {
  dashscope_websearch: {
    url: "https://dashscope.aliyuncs.com/api/v1/mcps/WebSearch/mcp",
    apiKey: process.env.DASHSCOPE_WEBSERACH_API_KEY 
         || process.env.DASHSCOPE_WEBSEARCH_API_KEY 
         || '',
    transport: "sse",
    timeout: 30
  }
};
```

### 5.2 全局单例实例

整个应用共享一个 MCP 加载器：

```typescript
// 获取全局实例（自动初始化默认服务器）
const loader = getMcpLoader();
// 等价于:
// if (!globalLoader) globalLoader = createMcpLoader();
// setupDefaultMcpServers(globalLoader);
// return globalLoader;
```

---

## 六、环境变量配置

要使用 MCP 网络搜索功能，需要在 `.env` 文件中配置：

```bash
# 阿里云 DashScope API 密钥
DASHSCOPE_WEBSERACH_API_KEY=sk-xxxxxxxxxxxxxxxx
# 或
DASHSCOPE_WEBSEARCH_API_KEY=sk-xxxxxxxxxxxxxxxx
```

**获取API密钥步骤**：
1. 访问 [阿里云 DashScope 控制台](https://dashscope.console.aliyun.com/)
2. 注册/登录账号
3. 创建 API Key
4. 复制到 `.env` 文件

---

## 七、文件清单

| 文件 | 大小 | 作用 | 重要程度 |
|------|------|------|----------|
| `index.ts` | 31 B | 重导出 lazy_loader | ⭐ |
| `lazy_loader.ts` | 13.11 KB | 核心实现（Loader + Client + 配置） | ⭐⭐⭐⭐ |

---

## 八、架构图

```
┌────────────────────────────────────────────────────────────┐
│                     MCP 系统架构                             │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  ┌─────────────────────────────────────────────────────┐  │
│  │              MCPLazyLoader (全局单例)                  │  │
│  │                                                      │  │
│  │  configs: {                                          │  │
│  │    'dashscope_websearch': {...}                      │  │
│  │    'custom_service': {...}       ← 可扩展            │  │
│  │  }                                                   │  │
│  │                                                      │  │
│  │  clients: {                                          │  │
│  │    'dashscope_websearch': SSEMCPClient  ← 懒加载     │  │
│  │  }                                                   │  │
│  └───────────────────────┬─────────────────────────────┘  │
│                          │                                │
│          ┌───────────────▼───────────────┐                │
│          │       SSEMCPClient           │                │
│          │                               │                │
│          │  ┌─────────────────────────┐  │                │
│          │  │  discoverTools()        │  │                │
│          │  │  listTools()            │  │                │
│          │  │  callTool()             │  │                │
│          │  │  getActualToolName()    │ ← 模糊匹配       │  │
│          │  └─────────────────────────┘  │                │
│          └───────────────┬───────────────┘                │
│                          │                                │
│          ┌───────────────▼───────────────┐                │
│          │   阿里云 DashScope API        │                │
│          │   (JSON-RPC 2.0 over HTTPS)  │                │
│          └──────────────────────────────┘                │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

---

## 九、常见问题FAQ

### Q1: MCP 和普通API调用有什么区别？
**A**: MCP 是标准化协议，任何符合 MCP 规范的服务都能用同一套代码对接。就像USB接口——不管什么设备，插上就能用。

### Q2: 为什么叫"懒加载"?
**A**: 不是说开发者懒😄 而是指资源在需要的时候才加载。如果注册了10个MCP服务器但只用了1个，其他9个就不会连接，节省资源。

### Q3: 如何添加新的MCP服务器？
**A**: 
```typescript
const loader = getMcpLoader();
loader.registerServer({
  name: 'my-service',
  url: 'https://my-api.com/mcp',
  transport: 'sse',
  apiKey: 'xxx'
});
```

### Q4: stdio 模式什么时候会支持？
**A**: 目前代码中有预留结构，但 `_loadClient` 中只实现了 sse 分支。后续可以通过添加 stdio 客户端实现来支持。

---

## 十、小结

```
┌────────────────────────────────────────┐
│         MCP 系统核心知识点              │
├────────────────────────────────────────┤
│                                        │
│  1. MCP = AI连接外部服务的标准协议       │
│                                        │
│  2. MCPLazyLoader = 懒加载管理器        │
│     - 全局单例                         │
│     - 按需连接                         │
│     - 并发锁保护                       │
│                                        │
│  3. SSEMCPClient = HTTP/SSE客户端       │
│     - 连接远程MCP服务                   │
│     - 自动发现工具                      │
│     - 名称模糊匹配                      │
│                                        │
│  4. 默认服务: 阿里云 DashScope 搜索     │
│                                        │
└────────────────────────────────────────┘
```

---

> **下一篇**: [08_情感系统.md](./08_情感系统.md) - 了解角色之间如何建立情感关系
>
> **返回目录**: [SUMMARY.md](./SUMMARY.md)
