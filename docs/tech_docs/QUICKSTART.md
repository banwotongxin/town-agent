# 赛博小镇 V2 - 快速开始指南

## 📚 技术文档导航

欢迎来到赛博小镇V2技术文档！本指南帮助您快速找到所需信息。

---

## 🎯 我想...

### 了解项目整体架构
👉 阅读 [README.md](./README.md) - 包含完整的架构图和技术栈说明

### 学习如何创建和自定义Agent
👉 阅读 [01_核心AI代理系统.md](./01_核心AI代理系统.md)
- BaseAgent基类详解
- 消息系统设计
- Agent类型和扩展

### 理解记忆是如何工作的
👉 阅读 [02_记忆管理系统.md](./02_记忆管理系统.md)
- 双层记忆架构
- ChromaDB集成
- Token管理和压缩

### 掌握工作流引擎
👉 阅读 [03_图工作流引擎.md](./03_图工作流引擎.md)
- TownOrchestrator编排器
- 节点系统和路由
- 多智能体协作

### 配置安全和稳定性
👉 阅读 [04_中间件系统.md](./04_中间件系统.md)
- 七层防护机制
- 安全策略配置
- 错误处理

### 扩展Agent能力
👉 阅读 [05_技能系统.md](./05_技能系统.md)
- Skill架构设计
- 技能匹配算法
- MCP懒加载

### 查看完整总结
👉 阅读 [SUMMARY.md](./SUMMARY.md) - 所有文档的概览和统计

---

## 🚀 快速上手

### 1. 环境准备

```bash
# 克隆项目
git clone <repository-url>
cd cyber_town

# 安装依赖
npm install

# 配置环境变量
cp .env.example .env
# 编辑 .env 文件，填入你的API密钥
```

### 2. 运行项目

```bash
# 开发模式（带热重载）
npm run dev

# 生产模式
npm run build
npm start
```

### 3. 访问应用

打开浏览器访问：`http://localhost:8888`

---

## 💡 常见场景

### 场景1：添加新角色

```typescript
import { createBaseAgent } from './src/AI/agents/base_agent';

// 创建自定义角色
const musician = createBaseAgent(
  "王五",
  "音乐家",
  "agent_musician",
  {
    age: 28,
    personality: "热情开朗，热爱音乐",
    background: "专业钢琴演奏家，曾在维也纳金色大厅演出"
  }
);

// 添加到小镇
town.addAgent(musician);
```

详细文档：[01_核心AI代理系统.md](./01_核心AI代理系统.md) - 第5章

---

### 场景2：与角色对话

```typescript
// 单角色对话
const result = await town.chat(
  "你好，请介绍一下你自己",
  "agent_writer"  // 目标角色ID
);

console.log(`${result.agent_name}: ${result.response}`);
```

详细文档：[03_图工作流引擎.md](./03_图工作流引擎.md) - 第11章

---

### 场景3：多角色讨论

```typescript
// 多个角色讨论话题
const records = await town.multiAgentChat(
  "人工智能的未来发展",
  ["agent_scientist", "agent_engineer", "agent_writer"],
  3  // 3轮对话
);

records.forEach(record => {
  console.log(`${record.agent_name}: ${record.response}`);
});
```

详细文档：[03_图工作流引擎.md](./03_图工作流引擎.md) - 第6章

---

### 场景4：自定义技能

```typescript
class MusicCompositionSkill extends BaseSkill {
  constructor() {
    super({
      name: "music_composition",
      description: "音乐创作技能",
      triggerKeywords: ["作曲", "编曲", "旋律", "和弦"],
      priority: 10
    });
  }
  
  async execute(context: any): Promise<string> {
    // 音乐创作逻辑
    return "为您创作了一段优美的旋律...";
  }
}

// 注册技能
skillRegistry.register("musician", new MusicCompositionSkill());
```

详细文档：[05_技能系统.md](./05_技能系统.md) - 第9章

---

## 🔧 配置示例

### 环境变量 (.env)

```env
DEEPSEEK_API_KEY=sk-your-api-key-here
LLM_BASE_URL=https://api.deepseek.com
LLM_MODEL=deepseek-chat
LLM_TEMPERATURE=0.7
LLM_MAX_TOKENS=4096
PORT=8888
```

### 中间件配置 (middleware_config.yaml)

```yaml
middleware:
  guardrails:
    enabled: true
    denied_tools: ["bash", "rm"]
  
  summarization:
    enabled: true
    trigger_tokens: 6000
    keep_messages: 20
  
  loop_detection:
    warn_threshold: 3
    hard_limit: 5
```

---

## 📖 推荐阅读顺序

### 初学者路径
1. [README.md](./README.md) - 了解整体
2. [01_核心AI代理系统.md](./01_核心AI代理系统.md) - 理解基础
3. [03_图工作流引擎.md](./03_图工作流引擎.md) - 学习使用
4. 其他文档按需阅读

### 开发者路径
1. [README.md](./README.md) - 技术栈和架构
2. [01_核心AI代理系统.md](./01_核心AI代理系统.md) - 核心概念
3. [02_记忆管理系统.md](./02_记忆管理系统.md) - 数据管理
4. [03_图工作流引擎.md](./03_图工作流引擎.md) - 工作流
5. [04_中间件系统.md](./04_中间件系统.md) - 安全防护
6. [05_技能系统.md](./05_技能系统.md) - 能力扩展

### 运维人员路径
1. [README.md](./README.md) - 部署章节
2. [04_中间件系统.md](./04_中间件系统.md) - 监控和日志
3. [SUMMARY.md](./SUMMARY.md) - 故障排查

---

## ❓ 常见问题

### Q: 如何修改角色数量？
A: 使用 `createDefaultTown(numAgents)` 函数，传入想要的数量。

### Q: 记忆保存在哪里？
A: 短期记忆在内存中，长期记忆在 `./chroma` 目录下的ChromaDB中。

### Q: 如何添加新的MCP服务器？
A: 在 `mcp/servers/` 目录下创建YAML配置文件，然后在Skill中声明依赖。

### Q: 性能优化有什么建议？
A: 
- 合理设置记忆窗口大小
- 启用中间件缓存
- 使用异步操作
- 定期清理不活跃角色

详细答案请查阅对应文档。

---

## 🆘 获取帮助

### 文档问题
- 检查 [SUMMARY.md](./SUMMARY.md) 中的故障排查章节
- 查看各文档的"最佳实践"部分

### 代码问题
- 查看源代码注释
- 参考测试用例
- 提交Issue到GitHub

### 社区支持
- GitHub Discussions
- Discord频道
- 邮件列表

---

## 📝 文档更新日志

### v1.0 (2026-04-11)
- ✅ 创建5个核心模块详细文档
- ✅ 创建综合索引文档
- ✅ 创建总结文档
- ✅ 创建快速开始指南
- 总计约120,000字的技术文档

---

## 🎉 开始探索

现在您已经了解了文档结构，可以：

1. 📖 从 [README.md](./README.md) 开始全面了解项目
2. 💻 运行 `npm run dev` 启动开发服务器
3. 🎮 打开浏览器体验赛博小镇
4. 🔧 根据需求查阅相应的技术文档

祝您使用愉快！

---

*最后更新: 2026-04-11*
*维护者: CyberTown Team*
