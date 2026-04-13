# 赛博小镇 (CyberTown) V2

<div align="center">

**基于 LangGraph 的多智能体协作系统**

[![Python](https://img.shields.io/badge/Python-3.10+-blue.svg)](https://www.python.org/)
[![LangGraph](https://img.shields.io/badge/LangGraph-0.2+-green.svg)](https://langchain-ai.github.io/langgraph/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

</div>

---

## 📖 项目简介

赛博小镇是一个创新的多智能体协作平台，模拟真实小镇中不同职业角色的 Agent 之间的交互与协作。每个 Agent 拥有独立的职业身份、人格特征和专业技能，能够通过自然语言进行深度对话和任务协作。

### ✨ 核心特性

- **🎭 多角色 Agent 系统**: 支持作家、医生、程序员、教师等多种职业角色，每个角色拥有独特的人格和技能
- **🧠 双层记忆架构**: 短期记忆（会话级滑动窗口）+ 长期记忆（向量数据库持久化），实现持续学习和上下文感知
- **🔄 智能对话压缩**: 基于 LLM 的自动摘要机制，超过 5 轮对话自动压缩历史，平衡上下文质量和 Token 成本
- **🛠️ 插件化技能系统**: 每个职业对应独立 Skill，支持动态加载和专业能力沉淀
- **🔌 MCP 懒加载机制**: Skill 内声明外部工具依赖，按需加载 Model Context Protocol 服务，节省资源
- **💝 五级情感关系系统**: Agent 间关系随对话动态演变（陌生人→泛泛之交→朋友→好友→挚友），影响对话风格和互动深度
- **🛡️ 七层中间件防护**: 完整的安全防护体系，包括悬空调用修复、安全策略检查、循环检测、异常处理等

---

## 🏗️ 系统架构

```
                        ┌──────────────────────────────────┐
                        │         用户 / 小镇调度器           │
                        └──────────────┬───────────────────┘
                                       │
                        ┌──────────────▼───────────────────┐
                        │      TownOrchestrator (小镇编排)    │
                        │   基于 LangGraph StateGraph 构建   │
                        └──┬──────┬──────┬──────┬──────────┘
                           │      │      │      │
              ┌────────────▼┐ ┌───▼────┐ ┌▼───────▼┐ ┌─────────┐
              │  WriterAgent │ │ Doctor │ │ Coder   │ │  ...    │
              │  (作家)      │ │ Agent  │ │ Agent   │ │         │
              │              │ │(医生)  │ │(程序员) │ │         │
              └──────┬───────┘ └───┬────┘ └──┬──────┘ └────┬────┘
                     │            │         │              │
        ┌────────────▼────────────▼─────────▼──────────────▼────┐
        │                   Agent Runtime Layer                  │
        ├──────────┬──────────┬──────────┬─────────────────────┤
        │  Memory  │  Skill   │   MCP    │  Emotion    │ Graph  │
        │  System  │  Engine  │ Loader   │  Engine     │ State  │
        │          │          │          │  (五级情感)  │ Store  │
        ├──────────┴──────────┴──────────┴─────────────────────┤
        │              Middleware Layer (七层防护)              │
        ├──────────┬──────────┬──────────┬─────────────────────┤
        │ 修复悬空  │ 安全策略  │ 上下文压缩 │  子代理限制  │ 异常处理│
        │ Dangling  │ Guardrail │ Summarize │ Subagent    │ ToolErr│
        ├──────────┼──────────┼──────────┼─────────────────────┤
        │ 检测循环  │ 澄清拦截  │
        │ Loop     │ Clarify  │
        ├──────────┴──────────┴──────────┴─────────────────────┤
        │                   Storage Layer                       │
        ├──────────────┬───────────────┬───────────────────────┤
        │  ChromaDB /  │  Redis /      │  LangGraph           │
        │  FAISS       │  SQLite       │  Checkpointer        │
        │  (长期记忆)   │  (会话缓存)    │  (状态快照)           │
        └──────────────┴───────────────┴───────────────────────┘
```

---

## 📂 项目结构

```
cyber_town/
├── src/                          # 源代码目录
│   ├── AI/                       # AI 核心模块
│   │   ├── agents/               # Agent 实现
│   │   │   ├── base_agent.ts     # Agent 基类
│   │   │   ├── sub_agent.ts      # 子 Agent
│   │   │   ├── team_agent.ts     # 团队 Agent
│   │   │   ├── leader_agent.ts   # 领导者 Agent
│   │   │   └── models.ts         # 数据模型定义
│   │   ├── graph/                # LangGraph 图编排
│   │   │   ├── agent_graph.ts    # Agent 子图
│   │   │   ├── town_graph.ts     # 小镇总编排图
│   │   │   └── nodes/            # 图节点实现
│   │   │       ├── conversation_compress_node.ts  # 对话压缩节点
│   │   │       ├── memory_query_node.ts           # 记忆检索节点
│   │   │       ├── skill_invoke_node.ts           # 技能调用节点
│   │   │       ├── mcp_load_node.ts               # MCP 加载节点
│   │   │       └── middleware_nodes.ts            # 中间件节点
│   │   ├── memory/               # 记忆管理系统
│   │   │   ├── modules/          # 记忆模块
│   │   │   │   ├── vector_database.ts    # 向量数据库
│   │   │   │   ├── embedding.ts          # Embedding 引擎
│   │   │   │   ├── text_chunker.ts       # 文本分块器
│   │   │   │   ├── reranker.ts           # 重排序器
│   │   │   │   └── chat_compressor.ts    # 聊天压缩器
│   │   │   ├── chroma_long_term_memory.ts  # ChromaDB 长期记忆
│   │   │   ├── dual_memory.ts            # 双层记忆管理器
│   │   │   ├── memory_manager.ts         # 统一记忆管理
│   │   │   └── conversation_compressor.ts # 对话压缩器
│   │   ├── skills/               # 技能系统
│   │   │   ├── write/            # 写作相关技能
│   │   │   │   ├── chinese-writing/
│   │   │   │   ├── novel-writer-cn/
│   │   │   │   └── write-xiaohongshu/
│   │   │   ├── skill_system.ts   # 技能系统核心
│   │   │   └── index.ts          # 导出
│   │   ├── middleware/           # 中间件防护体系
│   │   │   ├── base.ts           # 中间件基类
│   │   │   ├── clarification.ts  # 澄清拦截
│   │   │   ├── concurrent_limit.ts  # 并发限制
│   │   │   ├── dangling_action.ts   # 悬空调用修复
│   │   │   ├── error_handling.ts    # 异常处理
│   │   │   ├── guardrail.ts         # 安全策略
│   │   │   ├── loop_detection.ts    # 循环检测
│   │   │   ├── memory_summarization.ts  # 记忆摘要
│   │   │   ├── tool_permission.ts     # 工具权限
│   │   │   ├── write_approval.ts      # 写入审批
│   │   │   └── factory.ts             # 工厂模式
│   │   ├── mcp/                  # MCP 集成
│   │   │   ├── mcp-tool-adapter.ts  # MCP 工具适配器
│   │   │   ├── lazy_loader.ts       # 懒加载器
│   │   │   └── index.ts
│   │   ├── emotion/              # 情感引擎
│   │   │   ├── emotion_engine.ts    # 情感引擎核心
│   │   │   └── index.ts
│   │   ├── tools/                # 工具系统
│   │   │   ├── core.ts           # 工具核心
│   │   │   ├── adapter.ts        # 工具适配器
│   │   │   ├── fs-tools.ts       # 文件系统工具
│   │   │   ├── exec-tools.ts     # 执行工具
│   │   │   └── tool-registry.ts  # 工具注册表
│   │   └── hooks/                # LangGraph Hooks
│   │       ├── before-tool-call.ts
│   │       └── after-tool-call.ts
│   ├── config/                   # 配置文件
│   │   ├── compression_config.yaml
│   │   └── security_rules.yaml
│   ├── security/                 # 安全模块
│   │   ├── config.ts
│   │   └── logger.ts
│   ├── types/                    # TypeScript 类型定义
│   ├── index.ts                  # 主入口
│   └── web_server.ts             # Web 服务器
├── frontend/                     # 前端界面
│   └── index.html
├── docs/                         # 文档
│   ├── tech_docs/                # 技术文档
│   │   ├── 01_核心AI代理系统.md
│   │   ├── 02_记忆管理系统.md
│   │   ├── 03_图工作流引擎.md
│   │   ├── 04_中间件系统.md
│   │   ├── 05_技能系统.md
│   │   └── SUMMARY.md
│   └── value_investing.md
├── chroma/                       # ChromaDB 数据存储
├── memory_storage/               # 记忆存储
├── test_memory_storage/          # 测试记忆存储
├── dist/                         # 编译输出
├── .env                          # 环境变量配置
├── package.json                  # Node.js 依赖
├── tsconfig.json                 # TypeScript 配置
├── jest.config.js                # Jest 测试配置
└── middleware_config.yaml        # 中间件配置
```

---

## 🚀 快速开始

### 前置要求

- **Node.js**: >= 18.0.0
- **npm**: >= 9.0.0
- **Python**: >= 3.10 (用于 MCP Server)
- **ChromaDB**: 本地运行或远程服务

### 安装步骤

1. **克隆仓库**
```bash
git clone https://github.com/your-org/cyber_town.git
cd cyber_town
```

2. **安装依赖**
```bash
npm install
```

3. **配置环境变量**
```bash
cp .env.example .env
# 编辑 .env 文件，填写必要的 API Key 和配置
```

4. **启动开发服务器**
```bash
npm run dev
```

5. **访问 Web 界面**
打开浏览器访问 `http://localhost:3000`

### 构建生产版本

```bash
npm run build
npm start
```

---

## 🔧 核心模块详解

### 1. Agent 系统

赛博小镇支持多种类型的 Agent：

- **BaseAgent**: Agent 基类，提供通用功能
- **SubAgent**: 子 Agent，执行具体任务
- **TeamAgent**: 团队 Agent，协调多个子 Agent
- **LeaderAgent**: 领导者 Agent，负责任务分配和决策

每个 Agent 拥有：
- 独特的职业身份和人格配置
- 专属的技能集合
- 独立的记忆空间
- 情感关系网络

### 2. 记忆管理系统

#### 双层记忆架构

**短期记忆 (Short-Term Memory)**
- 基于 LangGraph State 管理
- 滑动窗口机制（默认保留最近 5 轮对话）
- 超出窗口自动触发压缩

**长期记忆 (Long-Term Memory)**
- 基于 ChromaDB 向量数据库
- 语义相似度检索 + 时间衰减 + 重要性权重
- 永久持久化，支持跨会话检索

#### 对话压缩

当对话超过设定轮数时，系统自动：
1. 提取需要压缩的历史消息
2. 调用 LLM 生成简洁摘要
3. 用摘要替换原始消息，保留关键信息
4. 更新记忆状态

### 3. 技能系统 (Skills)

每个职业 Agent 拥有专属技能集：

```typescript
// 示例：作家技能
skills/write/novel-writer-cn/SKILL.md
```

技能特点：
- **声明式配置**: YAML/Markdown 格式定义技能元数据
- **MCP 依赖声明**: 明确标注所需的外部工具
- **动态加载**: 仅在需要时激活对应技能
- **可扩展**: 支持自定义新技能

### 4. MCP 懒加载机制

Model Context Protocol (MCP) 提供标准化的外部工具集成：

**工作流程：**
1. Skill 声明 MCP 依赖
2. 技能激活时检查 MCP 是否已加载
3. 未加载则启动 MCP Server 进程
4. 转换 MCP Tools 为 LangChain 兼容格式
5. 绑定到 LLM 供调用

**优势：**
- 按需加载，节省资源
- 隔离性强，避免冲突
- 声明式配置，清晰可控

### 5. 五级情感关系系统

Agent 之间的关系会随互动动态演变：

```
情感值:  0─────────20─────────40─────────60─────────80────────100
          │          │          │          │          │          │
     ┌────┴────┐┌────┴────┐┌────┴────┐┌────┴────┐┌────┴────┐
     │ Lv.1    ││ Lv.2    ││ Lv.3    ││ Lv.4    ││ Lv.5    │
     │ 陌生人  ││ 泛泛之交││ 朋友    ││ 好友    ││ 挚友    │
     │ 0~20    ││ 20~40   ││ 40~60   ││ 60~80   ││ 80~100  │
     └─────────┘└─────────┘└─────────┘└─────────┘└─────────┘
```

**影响维度：**
- 称呼方式（尊称 → 昵称）
- 对话风格（客气 → 随意）
- 话题深度（寒暄 → 交心）
- 帮助意愿（礼貌 → 主动）

### 6. 七层中间件防护

| 中间件 | 功能 | 执行顺序 |
|--------|------|---------|
| DanglingToolCall | 修复悬空工具调用 | 1 |
| Guardrail | 安全策略检查 | 2 |
| Summarization | 上下文压缩 | 3 |
| SubagentLimit | 截断子代理调用 | 4 |
| ToolErrorHandling | 异常处理 | 5 |
| LoopDetection | 检测循环 | 6 |
| Clarification | 澄清拦截 | 7 |

---

## 📊 技术栈

### 核心技术

| 组件 | 技术选型 | 说明 |
|------|---------|------|
| **运行时** | Node.js + TypeScript | 类型安全的异步运行时 |
| **Agent 框架** | LangGraph | 状态图编排，支持子图嵌套 |
| **LLM** | OpenAI GPT-4o / Claude-3.5 | 主模型；GPT-4o-mini 用于辅助任务 |
| **向量数据库** | ChromaDB | 轻量级，支持本地持久化 |
| **Embedding** | text-embedding-3-small | OpenAI Embedding |
| **MCP 协议** | mcp Python SDK | 官方 MCP 协议实现 |
| **状态持久化** | LangGraph Checkpointer + SQLite | 会话状态快照 |
| **配置管理** | YAML | Skill 清单、MCP 配置、Agent Profile |

### 主要依赖

```json
{
  "dependencies": {
    "@langchain/core": "^0.3.0",
    "@langchain/openai": "^0.3.0",
    "langgraph": "^0.2.0",
    "chromadb": "^1.0.0",
    "mcp": "^1.0.0",
    "yaml": "^2.0.0",
    "express": "^4.18.0"
  }
}
```

---

## 🧪 测试

运行单元测试：

```bash
npm test
```

运行特定测试：

```bash
npm test -- memory/compression.test.ts
```

---

## 📚 文档

详细的技术文档位于 `docs/tech_docs/` 目录：

- [01_核心AI代理系统.md](docs/tech_docs/01_核心AI代理系统.md) - Agent 系统架构
- [02_记忆管理系统.md](docs/tech_docs/02_记忆管理系统.md) - 双层记忆设计
- [03_图工作流引擎.md](docs/tech_docs/03_图工作流引擎.md) - LangGraph 编排
- [04_中间件系统.md](docs/tech_docs/04_中间件系统.md) - 七层防护体系
- [05_技能系统.md](docs/tech_docs/05_技能系统.md) - 插件化技能

---

## 🗺️ 开发路线图

### Phase 1: 基础框架 ✅
- [x] LangGraph 图结构搭建
- [x] Agent 基类和 Profile 定义
- [x] 短期记忆 + 滑动窗口
- [x] 基础对话流程

### Phase 2: 记忆系统 ✅
- [x] ChromaDB 集成
- [x] 长期记忆读写
- [x] 语义检索 + 重要性评分
- [x] 对话压缩 (LLM Summarization)

### Phase 3: 技能 + MCP ✅
- [x] Skill 基类和注册中心
- [x] YAML Skill 清单
- [x] MCP 懒加载器
- [x] MCP → LangChain Tool 转换
- [x] 3-5 个职业 Agent + Skill 实现

### Phase 4: 多 Agent 协作 🚧
- [ ] TownGraph 编排
- [ ] Agent 间通信
- [ ] 五级情感系统
- [ ] 小镇模拟场景
- [ ] 事件系统

### Phase 5: 优化 + 部署 📋
- [ ] 性能优化 (缓存、并发)
- [ ] Checkpointer 持久化
- [ ] 监控和日志
- [ ] Docker 部署

---
## 待做事项
- MCP：考虑一下是先加载他的元数据(也就是skill形式)，然后扫描到了全部加载。还是说现在的放在skill里面再加载。

<div align="center">

**⭐ 如果这个项目对您有帮助，请给我们一个 Star！**

Made with ❤️ by CyberTown Team

</div>
