# 文档知识库使用指南

## 📁 目录结构

```
cyber_town/
├── docs/                    # 知识文档目录
│   ├── value_investing.md  # 价值投资
│   ├── technical_analysis.md  # 技术分析
│   └── ...
├── src/
└── ...
```

---

## 🚀 快速开始

### **1. 准备文档**

在 `docs/` 目录下创建 Markdown 或 TXT 文件：

```markdown
# 价值投资原则

价值投资的核心理念是寻找被市场低估的股票...

## 能力圈原则

只投资自己理解的行业和公司...
```

### **2. 启动服务器**

```bash
npm run dev
```

### **3. 加载文档到知识库**

#### **方法一：使用 curl**
```bash
curl -X POST http://localhost:8891/api/memory/agent_business/load-docs
```

#### **方法二：使用 JavaScript**
```javascript
fetch('http://localhost:8891/api/memory/agent_business/load-docs', {
  method: 'POST'
})
.then(res => res.json())
.then(data => console.log(data));
```

#### **响应示例：**
```json
{
  "total": 3,
  "success": 3,
  "failed": 0,
  "message": "成功加载 3 个文档，失败 0 个"
}
```

---

## 📊 工作流程

```
docs/ 目录
  ↓
读取所有 .md/.txt 文件
  ↓
文本分块（TextChunker）
  ↓
向量化（Qwen Embedding）
  ↓
存储到 ChromaDB
  ↓
用户提问时检索相关知识
```

---

## 🔍 查看知识库

```bash
GET http://localhost:8891/api/memory/agent_business
```

**响应：**
```json
{
  "agent_id": "agent_business",
  "memory_count": 45,
  "memories": [
    {
      "content": "价值投资的核心理念是寻找被市场低估的股票...",
      "importance": 0.8,
      "metadata": {
        "source": "value_investing.md",
        "category": "value_investing",
        "type": "knowledge"
      }
    }
  ]
}
```

---

## 🗑️ 清空知识库

```bash
DELETE http://localhost:8891/api/memory/agent_business/knowledge
```

---

## ➕ 手动添加知识

如果不想通过文档，也可以直接添加：

```bash
POST http://localhost:8891/api/memory/agent_business/knowledge
Content-Type: application/json

{
  "knowledge": "市盈率低于15通常被认为是低估",
  "category": "valuation"
}
```

---

## 💡 最佳实践

### **1. 文档组织**

按主题分类：
```
docs/
├── investing/
│   ├── value_investing.md
│   ├── growth_investing.md
│   └── dividend_investing.md
├── trading/
│   ├── technical_analysis.md
│   └── risk_management.md
└── economics/
    ├── macro_economics.md
    └── monetary_policy.md
```

### **2. 文档格式**

- ✅ 使用清晰的标题层级
- ✅ 包含关键概念和定义
- ✅ 提供实际案例
- ✅ 列出要点和总结

### **3. 文件大小**

- 单个文档建议 < 50KB
- 过大的文档会自动分块
- 每块约 500-1000 tokens

### **4. 更新知识库**

修改文档后，重新加载：
```bash
# 先清空
curl -X DELETE http://localhost:8891/api/memory/agent_business/knowledge

# 再加载
curl -X POST http://localhost:8891/api/memory/agent_business/load-docs
```

---

## 🎯 实际效果

### **用户问："什么是价值投资？"**

LLM 收到的上下文：

```
[短期记忆]
用户：你好

[会话记忆]
（空）

[相关知识库] ← 从 docs/value_investing.md 检索
- 价值投资的核心理念是寻找被市场低估的股票，以低于其内在价值的价格买入...
- 能力圈原则：只投资自己理解的行业和公司...
- 安全边际：以显著低于内在价值的价格买入...
```

---

## 🔧 技术细节

### **分块策略**

- 使用 `TextChunker` 自动分块
- 每块约 500-1000 tokens
- 保持语义完整性

### **向量化**

- 使用 Qwen Embedding API
- 模型：`text-embedding-v2`
- 向量维度：1536

### **存储**

- ChromaDB 向量数据库
- 每个智能体独立集合
- 支持元数据过滤

---

## 📝 示例文档

参见：`docs/value_investing.md`

```markdown
# 标题

## 小节

内容...

### 要点

- 要点1
- 要点2

## 案例

具体案例...
```

---

## ❓ 常见问题

### **Q: 支持哪些文件格式？**
A: 目前支持 `.md` (Markdown) 和 `.txt` (纯文本)

### **Q: 文档太大怎么办？**
A: 系统会自动分块，无需担心

### **Q: 如何知道哪些知识已加载？**
A: 调用 `GET /api/memory/:agentId` 查看所有知识

### **Q: 可以删除单条知识吗？**
A: 目前只能清空整个知识库，后续会添加细粒度删除

---

## 🎓 总结

1. **准备文档** → 放在 `docs/` 目录
2. **加载知识** → 调用 `/load-docs` API
3. **自动检索** → 用户提问时自动匹配相关知识
4. **持续更新** → 修改文档后重新加载

**优势：**
- ✅ 易于维护（直接编辑 Markdown）
- ✅ 批量导入（一次加载所有文档）
- ✅ 智能检索（向量相似度搜索）
- ✅ 持久化存储（ChromaDB）
