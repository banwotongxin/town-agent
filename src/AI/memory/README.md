# Memory System Architecture / 记忆系统架构

## 📁 Directory Structure / 目录结构

```
memory/
├── compression/          # 上下文压缩模块 (Context Compression)
│   ├── index.ts         # 压缩模块导出
│   ├── active_compaction.ts        # Layer 5: 主动压缩（LLM摘要）
│   ├── context_engine.ts           # Layer 1: 上下文引擎接口
│   ├── context_pruning.ts          # Layer 2: 上下文裁剪
│   ├── conversation_compressor.ts  # 对话压缩器
│   ├── preemptive_compaction.ts    # Layer 4: 预防性压缩
│   ├── session_truncation.ts       # Layer 7: 会话截断
│   ├── summary_audit.ts            # Layer 6: 摘要质量审计
│   ├── tool_result_truncation.ts   # Layer 3: 工具结果截断
│   └── token_utils.ts              # Token计算工具
│
├── storage/             # 记忆存储模块 (Memory Storage)
│   ├── index.ts         # 存储模块导出
│   ├── dual_memory.ts              # 双记忆系统（核心）
│   ├── chroma_long_term_memory.ts  # ChromaDB长期记忆
│   ├── pg_long_term_memory.ts      # PostgreSQL长期记忆
│   ├── session_memory.ts           # 会话记忆管理
│   ├── role_history_manager.ts     # 角色历史管理
│   ├── memory_manager.ts           # 记忆管理器
│   └── document_loader.ts          # 文档知识库加载器
│
├── modules/             # 共享工具模块 (Shared Utilities)
│   ├── index.ts         # 工具模块导出
│   ├── embedding.ts                # 文本嵌入
│   ├── text_chunker.ts             # 文本分块
│   ├── question_rewriter.ts        # 问题重写
│   ├── reranker.ts                 # 结果重排序
│   ├── vector_database.ts          # 向量数据库
│   └── chat_compressor.ts          # 聊天压缩
│
└── index.ts             # 主导出文件
```

## 🎯 Architecture Design / 架构设计

### 1. Context Compression Layer / 上下文压缩层

**职责**: 管理和优化发送给LLM的上下文，确保在token限制内

**七层防御体系**:
- **Layer 1**: Context Engine - 可插拔的上下文管理框架
- **Layer 2**: Context Pruning - 轻量级上下文裁剪（无需LLM）
- **Layer 3**: Tool Result Truncation - 智能截断过长的工具输出
- **Layer 4**: Preemptive Compaction - 预防性压缩策略决策
- **Layer 5**: Active Compaction - 使用LLM生成智能摘要（核心）
- **Layer 6**: Summary Quality Audit - 确保重要信息被保留
- **Layer 7**: Session Truncation - 物理删除已摘要的消息

**特点**:
- ✅ 多层防护，逐级压缩
- ✅ 自适应策略，根据上下文大小选择最优方案
- ✅ 信息保全，确保关键内容不丢失
- ✅ 零LLM调用选项（Layer 2-3）

### 2. Memory Storage Layer / 记忆存储层

**职责**: 持久化存储和管理智能体的长短期记忆

**核心组件**:
- **Dual Memory System**: 结合短期记忆（窗口）和长期记忆（向量数据库）
- **Session Memory**: 会话级别的记忆提取和摘要
- **Role History Manager**: 多角色对话历史管理
- **Long-term Memory Backends**:
  - ChromaDB: 向量相似度搜索
  - PostgreSQL: 关系型存储

**特点**:
- ✅ 分离关注点：知识库 vs 聊天历史
- ✅ 多种存储后端支持
- ✅ 自动记忆提取和压缩
- ✅ 基于重要性的记忆检索

### 3. Shared Modules / 共享工具层

**职责**: 提供通用的AI工具和功能

**核心工具**:
- **Embedding**: 文本向量化（Qwen API）
- **Text Chunking**: 智能文本分块
- **Question Rewriting**: 查询扩展和优化
- **Reranking**: 搜索结果重排序
- **Vector Database**: ChromaDB封装

**特点**:
- ✅ 模块化设计，易于替换
- ✅ 统一的接口规范
- ✅ 支持多种AI服务提供商

## 🔄 Data Flow / 数据流

```
User Input
    ↓
[Storage Layer] ← 检索相关记忆
    ↓
[Compression Layer] ← 优化上下文
    ↓
LLM Processing
    ↓
[Storage Layer] ← 保存新记忆
    ↓
Response to User
```

## 📝 Usage Examples / 使用示例

### 使用上下文压缩

```typescript
import { activeCompact, pruneContext } from './memory/compression';

// 主动压缩对话历史
const result = await activeCompact(messages, 8000, llmModel);
console.log(`压缩率: ${result.tokensBefore} → ${result.tokensAfter}`);

// 轻量级上下文裁剪
const pruned = pruneContext(messages, undefined, 8000);
```

### 使用记忆存储

```typescript
import { DualMemorySystem } from './memory/storage';

// 创建双记忆系统
const memory = new DualMemorySystem('agent_001');

// 添加消息
await memory.addMessage(userMessage);

// 获取上下文（包含短期记忆 + 会话摘要 + 相关知识）
const context = await memory.getContext(query);
```

### 使用共享工具

```typescript
import { QwenEmbedding, TextChunker } from './memory/modules';

// 文本分块
const chunker = new TextChunker(256, 32);
const chunks = chunker.chunk(longText);

// 向量化
const embedder = new QwenEmbedding();
const embeddings = await embedder.embed(chunks);
```

## 🔧 Configuration / 配置

### 环境变量

```bash
# Qwen API 配置
QWEN_API_KEY=your_api_key
QWEN_BASE_URL=https://dashscope.aliyuncs.com/api/v1

# PostgreSQL 配置（可选）
PG_HOST=localhost
PG_PORT=5432
PG_DATABASE=cyber_town
PG_USER=postgres
PG_PASSWORD=your_password
```

## 🚀 Key Features / 核心特性

1. **七层上下文压缩防御**
   - 从轻量级裁剪到智能摘要
   - 自适应策略选择
   - 质量保证机制

2. **双记忆架构**
   - 短期记忆：快速访问最近对话
   - 长期记忆：持久化存储重要信息
   - 会话记忆：自动提取和摘要

3. **模块化设计**
   - 清晰的职责分离
   - 易于扩展和替换
   - 统一的接口规范

4. **多存储后端支持**
   - ChromaDB：向量搜索
   - PostgreSQL：关系型存储
   - 可扩展到其他数据库

## 📊 Performance Metrics / 性能指标

- **压缩率**: 50-70%
- **压缩延迟**: 2-5秒（含LLM调用）
- **Token节省**: 3000-6000 tokens/次压缩
- **记忆检索**: <100ms（ChromaDB）

## 🛠️ Future Enhancements / 未来改进

- [ ] 添加 Redis 缓存层
- [ ] 支持更多向量数据库（Pinecone, Weaviate）
- [ ] 实现增量压缩
- [ ] 添加记忆重要性自动评分
- [ ] 支持多模态记忆（图片、音频）
