# 日志系统与Web服务器技术文档

> **模块位置**: `src/utils/` + `src/web_server.ts` + `src/index.ts`
> **难度等级**: ⭐⭐ (初级-中级)
> **预计学习时间**: 40 分钟

---

## 第一部分：日志系统（Logger）

### 一、什么是日志系统？

#### 1.1 通俗解释

**日志 = 程序的"日记本"**

就像人会写日记记录每天发生的事情一样，程序也需要记录：
- 发生了什么操作
- 出了什么错误
- 当时的状态是什么

```
[2024-01-15T10:30:00] [INFO]    小镇初始化完成
[2024-01-15T10:30:01] [DEBUG]   正在连接MCP服务...
[2024-01-15T10:30:02] [WARN]    API响应较慢
[2024-01-15T10:30:05] [ERROR]   连接失败: 超时
```

### 1.2 在赛博小镇中的作用

| 用途 | 说明 |
|------|------|
| 问题排查 | 出错时查看日志找原因 |
| 运行监控 | 了解系统当前状态 |
| 性能分析 | 记录耗时，找出瓶颈 |
| 安全审计 | 记录谁做了什么 |

---

## 二、核心概念

### 2.1 日志级别

```typescript
// 位置: src/utils/logger.ts
enum LogLevel {
  DEBUG = 0,   // 调试信息（开发时用，最详细）
  INFO = 1,    // 一般信息（正常运行记录）
  WARN = 2,    // 警告（有问题但还能运行）
  ERROR = 3,   // 错误（出问题了！）
  NONE = 4     // 关闭所有日志
}
```

**优先级从低到高**：

```
DEBUG < INFO < WARN < ERROR < NONE
  ↓      ↓      ↓       ↓      ↓
 最详细   常用   注意    错误    关闭
```

### 2.2 日志配置

```typescript
interface LogConfig {
  level: LogLevel;          // 显示哪些级别的日志
  enableTimestamp: boolean; // 是否显示时间戳
  enableColors: boolean;    // 是否显示颜色(终端)
}
```

---

## 三、使用方法

### 3.1 基础用法

```typescript
import { debug, info, warn, error } from './utils';

// 输出不同级别的日志
debug('这是调试信息', { userId: 123 });     // 开发调试
info('用户登录成功');                        // 正常记录
warn('API响应延迟过高', { latency: 5000 });  // 需要关注
error('数据库连接失败', new Error('...'));    // 出错了!
```

### 3.2 配置日志

```typescript
import { setLogConfig, getLogConfig, resetLogConfig } from './utils';

// 设置只显示WARN及以上级别
setLogConfig({ level: LogLevel.WARN });

// 启用时间戳和颜色
setLogConfig({
  level: LogLevel.DEBUG,
  enableTimestamp: true,
  enableColors: true
});

// 查看当前配置
console.log(getLogConfig());
// → { level: 0, enableTimestamp: true, enableColors: true }

// 重置为默认配置
resetLogConfig();
```

### 3.3 日志输出格式

```
启用时间戳:
[2024-01-15T10:30:00.123Z] [INFO] 用户登录成功 {"userId":123}

不启用时间戳:
[INFO] 用户登录成功
```

---

## 四、内部实现原理

### 4.1 核心函数

```typescript
function formatMessage(level: string, message: any, ...args: any[]): string {
  const parts: string[] = [];
  
  if (currentConfig.enableTimestamp) {
    parts.push(`[${new Date().toISOString()}]`);  // 添加时间戳
  }
  
  parts.push(`[${level}]`);                        // 添加级别标签
  
  parts.push(typeof message === 'string' ? message : JSON.stringify(message));
  
  if (args.length > 0) {
    parts.push(...args.map(arg => 
      typeof arg === 'string' ? arg : JSON.stringify(arg)
    ));
  }
  
  return parts.join(' ');
}
```

### 4.2 过滤机制

每个日志函数都会检查**当前配置的级别**：

```typescript
export function debug(message: any, ...args: any[]): void {
  if (currentConfig.level <= LogLevel.DEBUG) {  // 只有不高于DEBUG才输出
    console.log(formatMessage('DEBUG', message, ...args));
  }
}

export function error(message: any, ...args: any[]): void {
  if (currentConfig.level <= LogLevel.ERROR) {
    console.error(formatMessage('ERROR', message, ...args));
  }
}
```

---

## 五、文件清单

| 文件 | 行数 | 作用 |
|------|------|------|
| `src/utils/logger.ts` | 138 | 日志核心实现 |
| `src/utils/index.ts` | 16 | 统一导出 |

**导出列表**：
- `LogLevel` - 枚举
- `LogConfig` - 配置接口
- `setLogConfig()` - 设置配置
- `getLogConfig()` - 获取配置
- `resetLogConfig()` - 重置配置
- `debug()`, `info()`, `warn()`, `error()` - 四个日志函数

---

---

## 第二部分：Web 服务器

### 六、什么是Web服务器？

#### 6.1 通俗解释

**Web服务器就是赛博小镇的"前台接待处"**

```
┌─────────────────────────────────────────────┐
│              浏览器 (用户)                    │
│         http://localhost:8888               │
└───────────────────┬─────────────────────────┘
                    │ HTTP请求
                    ↓
┌─────────────────────────────────────────────┐
│           Web服务器 (Express)                │
│                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │ GET /    │  │ POST     │  │ POST     │  │
│  │ 返回页面 │  │ /api/chat│  │/api/teams│  │
│  └──────────┘  └──────────┘  └──────────┘  │
│                                             │
│  后端: 小镇逻辑 + AI模型调用                 │
└─────────────────────────────────────────────┘
```

**职责**：
- 🌐 提供网页给用户访问
- 📨 接收用户的对话请求
- 🤖 调用AI模型生成回复
- 👥 管理团队创建和任务执行

---

## 七、技术栈

| 技术 | 作用 | 说明 |
|------|------|------|
| **Express** | Web框架 | Node.js最流行的Web框架 |
| **CORS** | 跨域支持 | 允许前端调用后端API |
| **dotenv** | 环境变量 | 管理 API Key 等敏感配置 |

---

## 八、项目入口结构

### 8.1 两个入口文件

```
src/
├── index.ts        ← 模块导出入口（给其他代码import用）
└── web_server.ts   ← 服务器启动入口（运行 npm run dev 执行这个）
```

#### `src/index.ts` — 模块统一导出

```typescript
// 这个文件让外部可以用一句话导入所有AI功能
export * from './AI/agents';    // 智能体
export * from './AI/emotion';   // 情感系统
export * from './AI/graph';     // 图工作流
export * from './AI/memory';    // 记忆系统
export * from './AI/middleware'; // 中间件
export * from './AI/skills';    // 技能系统
export * from './AI/mcp';       // MCP协议
```

#### `src/web_server.ts` — 主程序入口

这是整个应用启动的地方！

---

## 九、服务器核心组件详解

### 9.1 DeepSeekModel 类（AI模型封装）

```typescript
class DeepSeekModel {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.baseUrl = 'https://api.deepseek.com/v1/chat/completions';
  }

  async invoke(
    messages: BaseMessage[], 
    options?: { tools?: any[] }
  ): Promise<{ content: string; tool_calls?: any[] }>
}
```

**工作流程**：

```
1. 接收消息数组 (我们的格式)
        ↓
2. 转换为DeepSeek格式 ({role, content})
        ↓
3. 构建请求体 (model, messages, temperature...)
        ↓
4. 发送HTTP POST到DeepSeek API
        ↓
5. 解析响应，提取内容和工具调用
        ↓
6. 返回标准化结果
```

**消息格式转换**：

```typescript
// 我们的项目格式 → DeepSeek格式
{ type: 'human', content: '你好' }
    ↓
{ role: 'user', content: '你好' }

{ type: 'ai', content: '你好呀!' }
    ↓
{ role: 'assistant', content: '你好呀!' }

{ type: system, content: '你是助手' }
    ↓
{ role: 'system', content: '你是助手' }
```

### 9.2 API密钥加载

```typescript
function loadApiKey(): string | null {
  // 优先从环境变量读取
  let apiKey = process.env.DEEPSEEK_API_KEY;
  if (apiKey) return apiKey;

  // 备用方案：从 .env 文件读取
  try {
    const content = fs.readFileSync('.env', 'utf-8');
    for (const line of content.split('\n')) {
      if (line.startsWith('DEEPSEEK_API_KEY=')) {
        return line.split('=', 2)[1];
      }
      // 同时加载其他API Key...
    }
  } catch (e) {}
  return null;
}
```

---

## 十、API路由详解

### 10.1 GET `/` — 首页

返回前端HTML页面：

```typescript
app.get('/', (req, res) => {
  const htmlPath = path.join(BASE_DIR, 'frontend', 'index.html');
  const content = fs.readFileSync(htmlPath, 'utf-8');
  res.send(content);
});
```

**访问**: `http://localhost:8888` → 看到 `frontend/index.html`

### 10.2 GET `/api/agents` — 获取角色列表

返回小镇中所有角色的信息：

```typescript
app.get('/api/agents', (req, res) => {
  const agents = [];
  for (const [agentId, agent] of Object.entries(townInstance.Agents)) {
    const profile = agent.Profile;
    
    agents.push({
      id: agentId,
      name: profile.name,
      age: profile.age,
      profession: profile.profession,  // 职业
      personality: profile.personality, // 性格
      background: profile.background,  // 背景
      x: ..., y: ...                   // 地图位置坐标
    });
  }
  res.json(agents);
});
```

**返回示例**：
```json
[
  {
    "id": "agent_001",
    "name": "张三",
    "age": 28,
    "profession": "作家",
    "personality": "文静内向",
    "x": 20, "y": 30
  },
  ...
]
```

### 10.3 POST `/api/chat` — 与角色对话

**最重要的API！处理用户对话请求**

```typescript
app.post('/api/chat', async (req, res) => {
  const data = req.body;
  const userInput = data.user_input;           // 用户输入
  const targetAgentId = data.target_agent_id;  // 目标角色ID
  const conversationHistory = data.conversation_history; // 历史消息

  // 调用小镇的chat方法（触发完整的Agent工作流）
  const result = await townInstance.chat(
    userInput,
    targetAgentId,
    conversationHistory
  );

  res.json({
    response: result.response,                // AI回复内容
    agent_id: result.agent_id,                // 角色ID
    agent_name: result.agent_name,            // 角色名
    conversation_history: result.conversation_history // 更新后的历史
  });
});
```

**请求体**：
```json
{
  "user_input": "你好，今天天气怎么样？",
  "target_agent_id": "agent_001",
  "conversation_history": [
    { "role": "user", "content": "...", "type": "text" },
    { "role": "assistant", "content": "...", "type": "text" }
  ]
}
```

### 10.4 POST `/api/teams` — 创建团队

创建一个多智能体协作团队：

```typescript
app.post('/api/teams', (req, res) => {
  const profession = data.profession;  // 团队专业领域

  const team = createTeamAgent(profession);

  res.json({
    team_id: team.TeamId,
    profession: team.Profession,
    leader_agent: team.LeaderAgent?.AgentId,
    sub_agents_count: team.SubAgents.length,
    verification_agent: team.VerificationAgent?.AgentId
  });
});
```

### 10.5 POST `/api/teams/task` — 执行团队任务

```typescript
app.post('/api/teams/task', async (req, res) => {
  const { team_id, task } = req.body;

  const team = teams[team_id];
  const result = await team.executeTask(task);

  res.json({ team_id, task, result });
});
```

---

## 十一、服务器启动流程

```
npm run dev
     ↓
node dist/web_server.js (编译后的)
     ↓
startServer() 函数开始执行
     ↓
┌─────────────────────────────────────┐
│ Step 1: checkEnv()                  │
│   ├─ 加载 .env 文件                  │
│   └─ 检查 DEEPSEEK_API_KEY 是否存在   │
│   ❌ 没有 → 程序退出                 │
└──────────────┬──────────────────────┘
               ↓
┌─────────────────────────────────────┐
│ Step 2: initializeTown()            │
│   ├─ createDefaultTown(8)            │
│   │   └─ 创建8个不同职业的角色         │
│   └─ 为每个角色设置LLM模型            │
└──────────────┬──────────────────────┘
               ↓
┌─────────────────────────────────────┐
│ Step 3: findAvailablePort(8888)      │
│   └─ 如果8888被占用，尝试8889...      │
└──────────────┬──────────────────────┘
               ↓
┌─────────────────────────────────────┐
│ Step 4: app.listen(PORT)             │
│   └─ 服务器启动，监听端口              │
│                                      │
│   ✅ 可以访问了!                      │
│   http://localhost:8888              │
└─────────────────────────────────────┘
```

### 端口自动检测

```typescript
async function findAvailablePort(startPort: number): Promise<number> {
  let port = startPort;
  while (port < startPort + 10) {
    if (await checkPort(port)) return port;  // 端口可用
    console.log(`端口 ${port} 已被占用，尝试下一个...`);
    port++;
  }
  throw new Error('没有可用的端口');
}
```

---

## 十二、全局变量

```typescript
let townInstance: any = null;   // 小镇实例（包含所有角色）
const teams: Record<string, any> = {};  // 团队字典
```

这些变量在内存中保存状态：
- `townInstance`: 整个小镇的数据，包括所有角色
- `teams`: 存储已创建的团队

> **注意**: 当前版本数据存储在内存中，重启后会丢失。生产环境需要数据库持久化。

---

## 十三、环境变量配置

在项目根目录的 `.env` 文件中：

```bash
# 必需: DeepSeek API 密钥
DEEPSEEK_API_KEY=sk-xxxxxxxxxxxxxxxx

# 可选: 其他AI模型的Key
HUGGINGFACE_API_KEY=hf_xxxxxxxxxxxxxxxx
QWEN_API_KEY=sk-xxxxxxxxxxxxxxxx
QWEN_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1

# 可选: DashScope搜索API
DASHSCOPE_WEBSERACH_API_KEY=sk-xxxxxxxxxxxxxxxx
```

---

## 十四、文件清单

| 文件 | 行数 | 作用 |
|------|------|------|
| `src/web_server.ts` | 621 | 主程序（服务器+API+AI调用） |
| `src/index.ts` | 42 | 模块统一导出入口 |
| `src/utils/logger.ts` | 138 | 日志工具 |
| `src/utils/index.ts` | 16 | 工具模块导出 |

---

## 十五、常见问题FAQ

### Q1: 如何修改默认端口号？
**A**: 修改 `web_server.ts` 中的 `let PORT = 8888;`

### Q2: 为什么我的API Key不起作用？
**A**: 检查以下几点：
1. `.env` 文件是否在项目根目录
2. 变量名是否正确：`DEEPSEEK_API_KEY`（不是 `API_KEY`）
3. Key 是否有效（去 DeepSeek 平台确认）

### Q3: 如何添加新的API接口？
**A**: 在 `web_server.ts` 中添加新的路由：
```typescript
app.get('/api/my-endpoint', (req, res) => {
  res.json({ message: 'Hello!' });
});
```

### Q4: 数据重启后会丢失吗？
**A**: 是的，当前版本全部存储在内存中。如需持久化需要对接数据库。

---

## 十六、小结卡片

```
┌────────────────────────────────────────────┐
│      日志系统 + Web服务器 核心知识点        │
├────────────────────────────────────────────┤
│                                            │
│  【日志系统】                               │
│                                            │
│  1. 五个级别: DEBUG < INFO < WARN < ERROR  │
│                                            │
│  2. 四个函数: debug/info/warn/error        │
│                                            │
│  3. 可配置: 级别过滤、时间戳、颜色          │
│                                            │
│  【Web服务器】                              │
│                                            │
│  4. Express框架 + CORS                     │
│                                            │
│  5. 五个API路由:                           │
│     GET  /          → 前端页面             │
│     GET  /api/agents → 角色列表            │
│     POST /api/chat   → 对话接口            │
│     POST /api/teams  → 创建团队            │
│     POST /api/teams/task → 执行任务        │
│                                            │
│  6. DeepSeekModel 封装AI调用              │
│                                            │
│  7. .env 管理API密钥                       │
│                                            │
└────────────────────────────────────────────┘
```

---

> **🎉 恭喜！你已经学完了所有模块的技术文档！**
>
> **返回目录**: [SUMMARY.md](./SUMMARY.md)
