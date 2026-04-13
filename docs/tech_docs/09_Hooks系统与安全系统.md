# Hooks系统与安全系统技术文档

> **模块位置**: `src/AI/hooks/` + `src/security/`
> **难度等级**: ⭐⭐⭐ (中级)
> **预计学习时间**: 30 分钟

---

## 第一部分：Hooks（钩子）系统

### 一、什么是Hooks？（小白通俗解释）

#### 1.1 生活化类比

想象你在进入一个**高档会所**时的流程：

```
进门 → [安检] → [登记] → [VIP确认] → 进入消费 → [结账记录] → 离开
           ↑         ↑          ↑                      ↑
        Before Hook 1  Before Hook 2  Before Hook 3   After Hook
```

**Hooks（钩子）就是在关键节点上挂载的"检查点"或"触发点"**。

在赛博小镇中：
- **Before Hooks**：工具执行**前**的检查（安全审批）
- **After Hooks**：工具执行**后**的处理（日志、审计）

#### 1.2 在项目中的作用

| 类型 | 作用 | 场景 |
|------|------|------|
| Before-Tool-Call | 执行前拦截/修改 | 循环检测、权限验证 |
| After-Tool-Call | 执行后处理 | 日志记录、审计追踪 |

---

## 二、Before-Tool-Call Hook（前置钩子）

### 2.1 核心数据结构

```typescript
// 位置: src/AI/hooks/before-tool-call.ts

// Hook执行结果 - 只有两种可能
type HookOutcome = 
  | { blocked: true; reason: string }      // 阻止！给出原因
  | { blocked: false; params: unknown };   // 通过，可返回修改后的参数
```

### 2.2 主入口函数

```typescript
export async function runBeforeToolCallHook(
  params: BeforeToolCallHookParams
): Promise<HookOutcome> {
  let currentParams = params.params;
  
  // ★ Hook 1: 循环检测
  const loopDetectionResult = await checkLoopDetection(...);
  if (loopDetectionResult.blocked) return loopDetectionResult;  // 阻止!
  
  // ★ Hook 2: 插件自定义Hook
  const pluginResult = await runPluginBeforeToolCallHook(...);
  if (pluginResult.blocked) return pluginResult;  // 阻止!
  currentParams = pluginResult.params;  // 参数可能被修改
  
  // ★ Hook 3: 审批流程
  const approvalResult = await checkApprovalRequirement(...);
  if (approvalResult.blocked) return approvalResult;  // 阻止!
  
  return { blocked: false, params: currentParams };  // 全部通过!
}
```

### 2.3 三个内置Hook详解

#### Hook 1：循环检测 🔍

```
问题：AI可能会反复调用同一个工具导致死循环
     比如: read文件 → 发现错误 → read文件 → 发现错误 → 无限循环...

解决：维护调用历史，同一工具短时间内超限则阻止
状态: 🔄 TODO (预留接口)
```

```typescript
async function checkLoopDetection(
  toolName: string,
  toolCallId: string
): Promise<HookOutcome> {
  // TODO: 实现循环检测逻辑
  return { blocked: false, params: {} };
}
```

#### Hook 2：插件Hook 🔌

```
用途: 允许第三方插件注册自己的前置逻辑
比如: 某个插件想在执行命令前检查是否有敏感词
状态: 📋 已预留，待扩展
```

```typescript
async function runPluginBeforeToolCallHook(
  params: BeforeToolCallHookParams & { params: unknown }
): Promise<HookOutcome> {
  // TODO: 遍历所有注册的插件Hook
  return { blocked: false, params: params.params };
}
```

#### Hook 3：审批流程 ✅

```
用途: 危险操作需要人工确认
比如: 删除文件、发送邮件等不可逆操作
状态: 📋 TODO (预留接口)
```

```typescript
async function checkApprovalRequirement(
  toolName: string,
  params: unknown
): Promise<HookOutcome> {
  // TODO: 检查工具是否需要审批
  return { blocked: false, params: params };
}
```

---

## 三、After-Tool-Call Hook（后置钩子）

### 3.1 核心数据结构

```typescript
// 位置: src/AI/hooks/after-tool-call.ts

interface AfterToolCallHookParams {
  toolName: string;       // 工具名
  toolCallId: string;     // 调用ID
  result: AgentToolResult;// 执行结果
  duration: number;       // 执行耗时(毫秒)
}
```

### 3.2 四个内置Hook详解

| # | Hook | 功能 | 状态 |
|---|------|------|------|
| 1 | `logToolCall` | 记录工具调用日志 | ✅ 已实现 |
| 2 | `sendAuditEvent` | 发送安全审计事件 | 📋 TODO |
| 3 | `extractMediaContent` | 提取图片等媒体内容 | 📋 TODO |
| 4 | `triggerUIUpdate` | 触发前端UI刷新 | 📋 TODO |

### 3.3 已实现的日志Hook

```typescript
async function logToolCall(params: AfterToolCallHookParams): Promise<void> {
  console.log(`[工具调用日志] ${params.toolName} (${params.toolCallId}) - ${params.duration}ms`);
  // TODO: 写入持久化日志系统
}
```

---

## 四、Hooks在系统中的位置

```
用户请求 → AI决定调用工具
                ↓
┌─────────────────────────────────────┐
│   BEFORE TOOL CALL HOOKS            │
│                                     │
│   ① 循环检测                        │
│   ② 插件Hook                       │
│   ③ 审批流程                        │
│          ↓                          │
│   [任一Hook阻止 → 返回错误]         │
│   [全部通过 → 继续执行]              │
└─────────────────┬───────────────────┘
                  ↓
         ┌──────────────┐
         │  工具实际执行   │
         └──────┬───────┘
                ↓
┌─────────────────────────────────────┐
│   AFTER TOOL CALL HOOKS             │
│                                     │
│   ① 记录日志    ← ✅               │
│   ② 审计事件    ← TODO             │
│   ③ 媒体提取    ← TODO             │
│   ④ UI更新      ← TODO             │
└─────────────────┬───────────────────┘
                  ↓
            结果返回给AI
```

---

## 五、如何扩展自定义Hook

虽然当前版本主要使用TODO占位，但架构已预留扩展点：

```typescript
// 未来可以这样扩展循环检测
async function checkLoopDetection(toolName, callId): Promise<HookOutcome> {
  const recentCalls = getRecentCalls();  // 获取最近N次调用
  
  // 同一工具10秒内调用超过5次就阻止
  const sameToolCalls = recentCalls.filter(
    c => c.toolName === toolName && Date.now() - c.time < 10000
  );
  
  if (sameToolCalls.length >= 5) {
    return { 
      blocked: true, 
      reason: `工具 ${toolName} 短时间内调用过于频繁，可能存在死循环` 
    };
  }
  
  recordCall(toolName, callId);  // 记录这次调用
  return { blocked: false, params: {} };
}
```

---

## 第二部分：Security（安全）系统

### 六、什么是安全系统？

保护赛博小镇免受恶意输入和危险操作的系统。

**核心职责**：
- 🔒 过滤危险的输入内容
- 🛡️ 控制哪些工具可以使用
- 📝 记录安全相关日志

---

## 七、SecurityConfig（安全配置类）

**位置**: `src/security/config.ts`

### 7.1 配置来源

从 YAML 文件加载配置（优先），如果不存在则使用默认配置：

```
config/security_rules.yaml  ← 优先读取
        ↓ (不存在)
    getDefaultConfig()       ← 使用内置默认值
```

### 7.2 三大安全机制

#### 机制1：输入黑名单 ⛔

阻止包含危险模式的输入：

```typescript
getInputBlacklist(): string[]
// 默认:
[
  'rm\\s+-rf',      // 删除命令
  'sudo',           // 超级管理员
  'chmod\\s+777',   // 权限设置
  'eval\\(',        // 代码执行
  '/etc\\/passwd',  // 系统文件
  '/etc\\/shadow',  // 密码文件
  'API_KEY',        // 敏感关键词
  'SECRET_KEY',
  'password',
  'token'
]
```

#### 机制2：输出黑名单 🚫

防止输出中泄露敏感信息：

```typescript
getOutputBlacklist(): string[]
// 默认:
['API_KEY', 'SECRET_KEY', 'password', 'token', 'private_key', 'secret']
```

#### 机制3：工具权限控制 🔐

定义每个工具是否可用及权限级别：

```typescript
getToolPermissions(): Record<string, { enabled: boolean; level: string }>
// 默认:
{
  read_file:   { enabled: true,  level: 'read-only' },   // ✅ 可用
  write_file:  { enabled: true,  level: 'read-write' },  // ✅ 可用
  ls:          { enabled: true,  level: 'read-only' },   // ✅ 可用
  bash:        { enabled: false, level: 'execute' },     // ❌ 禁用
  run_command: { enabled: false, level: 'execute' }      // ❌ 禁用
}
```

### 7.3 写入工具列表

标记所有涉及"写入"操作的工具：

```typescript
getWriteTools(): string[]
// → ['write_file', 'append_file', 'delete_file', 'mkdir', 'rmdir']
```

这些工具通常需要额外的安全检查。

---

## 八、SecurityLogger（安全日志器）

**位置**: `src/security/logger.ts`

专门用于记录安全相关的日志，格式为JSON：

```typescript
class SecurityLogger {
  info(message: string, metadata?: any)  // 信息级别
  warn(message: string, metadata?: any)  // 警告级别
  error(message: string, metadata?: any) // 错误级别
}

// 使用示例
const logger = new SecurityLogger();
logger.warn('检测到可疑输入', { input: '...', ip: '192.168.1.1' });
logger.error('权限拒绝', { user: 'guest', action: 'delete' });
```

**输出格式**：
```json
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "level": "WARN",
  "message": "检测到可疑输入",
  "metadata": { "input": "...", "ip": "192.168.1.1" }
}
```

---

## 九、文件清单

### Hooks 模块 (`src/AI/hooks/`)

| 文件 | 行数 | 作用 | 重要程度 |
|------|------|------|----------|
| `before-tool-call.ts` | 95 | 前置钩子（循环检测/插件/审批） | ⭐⭐⭐ |
| `after-tool-call.ts` | 65 | 后置钩子（日志/审计/媒体/UI） | ⭐⭐ |

### 安全模块 (`src/security/`)

| 文件 | 行数 | 作用 | 重要程度 |
|------|------|------|----------|
| `config.ts` | 84 | 安全配置加载（黑白名单+权限） | ⭐⭐⭐ |
| `logger.ts` | 26 | JSON格式的安全日志器 | ⭐⭐ |

---

## 十、小结卡片

```
┌──────────────────────────────────────────────┐
│      Hooks + 安全系统核心知识点              │
├──────────────────────────────────────────────┤
│                                              │
│  【Hooks 系统】                               │
│                                              │
│  1. Before Hooks (执行前):                   │
│     - 循环检测 → 防死循环                    │
│     - 插件Hook → 第三方扩展                  │
│     - 审批流程 → 危险操作确认                │
│                                              │
│  2. After Hooks (执行后):                    │
│     - 日志记录 ✅                            │
│     - 审计事件 📋                            │
│     - 媒体提取 📋                            │
│     - UI更新 📋                              │
│                                              │
│  【安全系统】                                 │
│                                              │
│  3. 三大防护:                                │
│     - 输入黑名单 (过滤危险命令)               │
│     - 输出黑名单 (防止信息泄露)               │
│     - 工具权限 (启用/禁用 + 级别)            │
│                                              │
│  4. SecurityLogger = JSON格式安全日志        │
│                                              │
└──────────────────────────────────────────────┘
```

---

> **下一篇**: [10_日志系统与Web服务器](./10_日志系统与Web服务器.md)
>
> **返回目录**: [SUMMARY.md](./SUMMARY.md)
