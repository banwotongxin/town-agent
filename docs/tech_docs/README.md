# 赛博小镇 V2 - 技术文档索引

## 文档概述

本目录包含赛博小镇V2项目的完整技术文档，涵盖了系统的所有核心组件和模块。

## 文档列表

### 核心模块文档

1. **[核心AI代理系统](./01_核心AI代理系统.md)**
   - BaseAgent基类设计
   - 消息类型系统
   - Agent生命周期管理
   - 持久化机制

2. **[记忆管理系统](./02_记忆管理系统.md)**
   - 双层记忆架构（短期+长期）
   - ChromaDB向量数据库集成
   - 会话记忆提取
   - Token管理和压缩算法

3. **[图工作流引擎](./03_图工作流引擎.md)**
   - TownOrchestrator编排器
   - AgentGraph智能体图谱
   - 节点系统和路由机制
   - 多智能体协作

4. **[中间件系统](./04_中间件系统.md)**
   - 七层防护机制
   - 安全策略检查
   - 循环检测和错误处理
   - 上下文压缩

5. **[技能系统](./05_技能系统.md)**
   - Skill架构设计
   - 技能匹配算法
   - MCP懒加载机制
   - 职业专属技能

### 其他模块文档（概要）

6. **工具系统** (详见下方概要)
7. **Web服务器和前端** (详见下方概要)
8. **安全系统** (详见下方概要)
9. **MCP集成** (详见下方概要)
10. **情感系统** (详见下方概要)

---

## 6. 工具系统技术概要

### 6.1 概述

工具系统为Agent提供外部能力扩展，包括文件系统操作、命令执行、网络请求等。

### 6.2 核心组件

- **ToolRegistry**: 工具注册中心
- **BaseTool**: 工具基类
- **FSTools**: 文件系统工具
- **ExecTools**: 命令执行工具
- **ToolAdapter**: MCP工具适配器

### 6.3 工具分类

#### 6.3.1 核心工具
- `read_file`: 读取文件内容
- `write_file`: 写入文件
- `list_directory`: 列出目录
- `bash`: 执行shell命令

#### 6.3.2 扩展工具
- `search_web`: 网络搜索
- `fetch_url`: 获取网页内容
- `code_execution`: 代码执行

### 6.4 工具调用流程

```
Agent决定调用工具 → ToolRegistry查找工具 
→ 执行工具 → 返回结果 → Agent处理结果
```

### 6.5 安全机制

- **权限控制**: 基于角色的工具访问控制
- **路径限制**: 限制文件操作的目录范围
- **命令白名单**: 只允许执行安全的命令
- **资源限制**: 限制工具执行的资源和时间

### 6.6 工具注册

```typescript
// 注册新工具
toolRegistry.register("my_tool", new MyTool());

// 工具组管理
toolRegistry.registerGroup("filesystem", [
  new ReadFileTool(),
  new WriteFileTool(),
  new ListDirectoryTool()
]);
```

---

## 7. Web服务器和前端技术概要

### 7.1 后端架构

#### 7.1.1 Express服务器

使用Express.js构建RESTful API：

```typescript
const app = express();
app.use(cors());
app.use(bodyParser.json());

// API路由
app.post('/api/chat', chatHandler);
app.get('/api/agents', listAgentsHandler);
app.post('/api/multi-chat', multiChatHandler);
```

#### 7.1.2 主要API端点

**POST /api/chat**
- 功能: 单角色对话
- 参数: `{ user_input, target_agent_id, conversation_history }`
- 返回: `{ response, agent_id, agent_name, conversation_history }`

**POST /api/multi-chat**
- 功能: 多角色群聊
- 参数: `{ topic, participant_ids, max_rounds }`
- 返回: `[{ round, agent_id, agent_name, response }]`

**GET /api/agents**
- 功能: 列出所有角色
- 返回: `[{ agent_id, name, profession, status }]`

**GET /api/town/status**
- 功能: 获取小镇状态
- 返回: `{ town_name, agent_count, agents, skill_count }`

### 7.2 前端架构

#### 7.2.1 技术栈

- **HTML5 Canvas**: 2D游戏渲染
- **Vanilla JavaScript**: 交互逻辑
- **CSS3**: 样式和动画
- **Fetch API**: HTTP请求

#### 7.2.2 核心功能

**角色移动系统**
```javascript
// WASD或方向键控制角色移动
document.addEventListener('keydown', (e) => {
  switch(e.key) {
    case 'w': case 'ArrowUp': movePlayer(0, -speed); break;
    case 's': case 'ArrowDown': movePlayer(0, speed); break;
    case 'a': case 'ArrowLeft': movePlayer(-speed, 0); break;
    case 'd': case 'ArrowRight': movePlayer(speed, 0); break;
  }
});
```

**碰撞检测**
```javascript
function checkCollision(player, building) {
  return player.x < building.x + building.width &&
         player.x + player.width > building.x &&
         player.y < building.y + building.height &&
         player.y + player.height > building.y;
}
```

**对话系统**
```javascript
async function sendMessage(message, targetAgentId) {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_input: message,
      target_agent_id: targetAgentId,
      conversation_history: currentHistory
    })
  });
  return await response.json();
}
```

#### 7.2.3 游戏循环

```javascript
function gameLoop() {
  update();  // 更新游戏状态
  render();  // 渲染画面
  requestAnimationFrame(gameLoop);
}
```

### 7.3 前后端通信

#### 7.3.1 请求格式

```json
{
  "user_input": "你好",
  "target_agent_id": "agent_writer",
  "conversation_history": [
    {"type": "human", "content": "你好"},
    {"type": "ai", "content": "你好！我是作家..."}
  ]
}
```

#### 7.3.2 响应格式

```json
{
  "response": "你好！很高兴见到你...",
  "agent_id": "agent_writer",
  "agent_name": "李四",
  "conversation_history": [...]
}
```

### 7.4 性能优化

- **Canvas优化**: 使用requestAnimationFrame
- **懒加载**: 按需加载角色和资源
- **缓存**: 缓存API响应和静态资源
- **防抖**: 对话输入防抖处理

### 7.5 部署配置

```javascript
const PORT = process.env.PORT || 8888;
app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
});
```

---

## 8. 安全系统技术概要

### 8.1 安全架构

```
Security Layer
├── Input Validation (输入验证)
├── Guardrail Middleware (护栏中间件)
├── Tool Permission (工具权限)
├── Write Approval (写入审批)
└── Security Logger (安全日志)
```

### 8.2 核心组件

#### 8.2.1 安全配置

YAML配置文件定义安全规则：

```yaml
security:
  input_validation:
    max_length: 10000
    blocked_patterns:
      - "<script>"
      - "DROP TABLE"
  
  tool_permissions:
    denied_tools:
      - "bash"
      - "rm"
    allowed_paths:
      - "./workspace"
      - "./data"
  
  write_approval:
    require_approval: true
    max_file_size: 1048576  # 1MB
    allowed_extensions:
      - ".txt"
      - ".md"
      - ".json"
```

#### 8.2.2 输入验证

```typescript
class InputValidator {
  static validate(input: string): boolean {
    // 长度检查
    if (input.length > MAX_LENGTH) return false;
    
    // 危险模式检查
    for (const pattern of BLOCKED_PATTERNS) {
      if (input.includes(pattern)) return false;
    }
    
    return true;
  }
}
```

#### 8.2.3 安全日志

记录所有安全相关事件：

```typescript
class SecurityLogger {
  logEvent(event: SecurityEvent): void {
    console.log(`[${event.timestamp}] ${event.type}: ${event.details}`);
    // 同时写入文件
    fs.appendFileSync(LOG_FILE, JSON.stringify(event) + '\n');
  }
}
```

### 8.3 防护措施

#### 8.3.1 注入攻击防护
- SQL注入过滤
- XSS攻击防护
- 命令注入阻止

#### 8.3.2 资源滥用防护
- 请求频率限制
- Token使用监控
- 文件大小限制

#### 8.3.3 数据保护
- 敏感信息加密
- 访问控制列表
- 审计日志

### 8.4 应急响应

**检测到安全威胁时：**
1. 立即阻断操作
2. 记录详细日志
3. 通知管理员
4. 触发应急流程

---

## 9. MCP集成技术概要

### 9.1 MCP协议概述

Model Context Protocol (MCP) 是标准化的AI工具集成协议，允许Agent动态发现和调用外部工具。

### 9.2 架构设计

```
MCPLazyLoader
├── MCPServer Registry (服务器注册)
├── Tool Discovery (工具发现)
├── Tool Adapter (工具适配)
└── Connection Manager (连接管理)
```

### 9.3 核心组件

#### 9.3.1 MCPLazyLoader

懒加载MCP服务器：

```typescript
class MCPLazyLoader {
  private loadedServers: Map<string, MCPServer>;
  
  async loadServer(serverName: string, requiredTools?: string[]): Promise<any[]> {
    // 检查是否已加载
    if (this.loadedServers.has(serverName)) {
      return this.getCachedTools(serverName, requiredTools);
    }
    
    // 启动MCP服务器
    const server = await this.startMCPServer(serverName);
    
    // 发现可用工具
    const tools = await server.discoverTools();
    
    // 转换为LangChain工具
    const lcTools = this.adaptToLangChain(tools);
    
    // 缓存
    this.loadedServers.set(serverName, { server, tools: lcTools });
    
    return requiredTools 
      ? lcTools.filter(t => requiredTools.includes(t.name))
      : lcTools;
  }
}
```

#### 9.3.2 工具适配器

将MCP工具转换为LangChain兼容格式：

```typescript
adaptToLangChain(mcpTool: MCPTool): StructuredTool {
  return StructuredTool.fromFunction({
    name: mcpTool.name,
    description: mcpTool.description,
    schema: this.buildSchema(mcpTool.inputSchema),
    func: async (args: any) => {
      const result = await mcpTool.call(args);
      return result.content[0].text;
    }
  });
}
```

### 9.4 MCP服务器配置

```yaml
# mcp/servers/search_server.yaml
name: "web_search"
description: "网络搜索服务"
command: "npx"
args:
  - "-y"
  - "@anthropic/mcp-server-web-search"
env:
  API_KEY: "${SEARCH_API_KEY}"
tools:
  - name: "search"
    description: "搜索互联网"
  - name: "fetch_url"
    description: "获取网页内容"
```

### 9.5 懒加载优势

- **资源节约**: 避免启动时加载所有服务器
- **快速启动**: 减少初始化时间
- **按需加载**: 只在需要时建立连接
- **自动清理**: 长时间不用的服务器自动卸载

### 9.6 常见MCP服务器

1. **web_search**: 网络搜索
2. **file_system**: 文件系统操作
3. **database**: 数据库查询
4. **code_executor**: 代码执行
5. **medical_db**: 医疗知识库

---

## 10. 情感系统技术概要

### 10.1 五级情感阶梯

```
情感值:  0─────────20─────────40─────────60─────────80────────100
          │          │          │          │          │          │
     ┌────┴────┐┌────┴────┐┌────┴────┐┌────┴────┐┌────┴────┐
     │ Lv.1    ││ Lv.2    ││ Lv.3    ││ Lv.4    ││ Lv.5    │
     │ 陌生人  ││ 泛泛之交││ 朋友    ││ 好友    ││ 挚友    │
     │ 0~20    ││ 20~40   ││ 40~60   ││ 60~80   ││ 80~100  │
     └─────────┘└─────────┘└─────────┘└─────────┘└─────────┘
```

### 10.2 情感等级定义

| 等级 | 名称 | 情感值 | 称呼方式 | 对话特征 |
|------|------|--------|---------|---------|
| Lv.1 | 陌生人 | 0-20 | 尊称 | 礼貌客套，话题浅表 |
| Lv.2 | 泛泛之交 | 20-40 | 姓+称呼 | 友好但保持距离 |
| Lv.3 | 朋友 | 40-60 | 名字 | 愿意分享日常 |
| Lv.4 | 好友 | 60-80 | 昵称 | 开玩笑、分享秘密 |
| Lv.5 | 挚友 | 80-100 | 专属昵称 | 无话不谈，深度信任 |

### 10.3 情感计算

#### 10.3.1 情感评估

使用LLM评估每轮对话的情感倾向：

```typescript
async evaluateInteraction(conversation: Message[]): Promise<{
  sentiment: string;  // very_positive, positive, neutral, negative, very_negative
  score: number;      // -1.0 to 1.0
  reason: string;
}> {
  const prompt = `分析以下对话的情感倾向...`;
  const result = await llm.invoke(prompt);
  return parseJSON(result.content);
}
```

#### 10.3.2 情感值更新

```typescript
calculateDelta(sentiment: string, currentScore: number): number {
  const baseDelta = BASE_DELTA[sentiment];  // +8, +5, +1, -3, -6等
  
  // 边际递减：互动越多，单次影响越小
  const decayFactor = 1.0 / (1.0 + 0.03 * interactionCount);
  
  // 高等级减速：越高的等级升级越慢
  const slowFactor = currentScore > 60 ? 0.6 : 1.0;
  
  return baseDelta * decayFactor * slowFactor;
}
```

### 10.4 关系持久化

```typescript
interface RelationshipState {
  agentA: string;
  agentB: string;
  score: number;           // 情感值
  level: EmotionLevel;     // 情感等级
  interactionCount: number; // 互动次数
  history: InteractionRecord[]; // 互动历史
  nicknameAtoB: string;    // A对B的称呼
  nicknameBtoA: string;    // B对A的称呼
}
```

### 10.5 对话风格注入

根据情感等级动态调整对话风格：

```typescript
// Lv.1 陌生人
"请使用礼貌的尊称，保持正式和距离感"

// Lv.3 朋友
"可以直接叫名字，语气轻松自然，可以开玩笑"

// Lv.5 挚友
"使用专属昵称，完全放松，坦诚相待，无话不谈"
```

### 10.6 时间衰减

长时间不互动，情感值缓慢下降：

```typescript
applyTimeDecay(relationship: RelationshipState): void {
  const daysElapsed = getDaysSince(relationship.lastInteraction);
  
  if (daysElapsed > 7) {  // 超过7天开始衰减
    const decay = Math.min(daysElapsed - 7, 30) * 0.5;
    relationship.score = Math.max(relationship.score - decay, -20);
    relationship.updateLevel();
  }
}
```

---

## 项目整体架构总结

```
赛博小镇 V2 架构
│
├── 表现层 (Presentation Layer)
│   ├── Web前端 (HTML5 Canvas + JavaScript)
│   └── REST API (Express.js)
│
├── 业务层 (Business Layer)
│   ├── TownOrchestrator (小镇编排器)
│   ├── AgentGraph (智能体图谱)
│   └── Multi-Agent Collaboration (多智能体协作)
│
├── 智能层 (Intelligence Layer)
│   ├── BaseAgent (基础智能体)
│   ├── Skill System (技能系统)
│   ├── Memory System (记忆系统)
│   ├── Emotion Engine (情感引擎)
│   └── MCP Integration (MCP集成)
│
├── 防护层 (Protection Layer)
│   ├── Middleware Chain (中间件链)
│   ├── Security System (安全系统)
│   └── Tool Permission (工具权限)
│
└── 数据层 (Data Layer)
    ├── ChromaDB (向量数据库)
    ├── File System (文件系统)
    └── Session Storage (会话存储)
```

## 技术栈

- **运行时**: Node.js >= 16.0.0
- **语言**: TypeScript 5.3+
- **Web框架**: Express.js 4.18+
- **AI框架**: LangGraph, LangChain
- **向量数据库**: ChromaDB
- **嵌入模型**: text-embedding-3-small
- **LLM**: DeepSeek, GPT-4, Claude
- **测试**: Jest
- **包管理**: npm

## 开发指南

### 环境搭建

```bash
# 安装依赖
npm install

# 编译TypeScript
npm run build

# 开发模式
npm run dev

# 运行测试
npm test

# 启动服务器
npm start
```

### 配置环境变量

创建 `.env` 文件：

```env
DEEPSEEK_API_KEY=your_api_key_here
LLM_BASE_URL=https://api.deepseek.com
LLM_MODEL=deepseek-chat
LLM_TEMPERATURE=0.7
LLM_MAX_TOKENS=4096
PORT=8888
```

## 部署

### Docker部署

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist
COPY frontend ./frontend
EXPOSE 8888
CMD ["node", "dist/web_server.js"]
```

### 生产环境配置

- 使用PM2进行进程管理
- 配置Nginx反向代理
- 启用HTTPS
- 设置日志轮转
- 配置监控告警

## 贡献指南

1. Fork项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启Pull Request

## 许可证

MIT License

## 联系方式

- 项目主页: [GitHub Repository]
- 问题反馈: [Issues]
- 邮箱: [contact@cybertown.ai]

---

*文档版本: 1.0*
*最后更新: 2026-04-11*
*维护者: CyberTown Team*
