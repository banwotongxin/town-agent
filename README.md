# 赛博小镇 V2 - Cyber Town V2

## 简介

赛博小镇 V2 是基于 **LangGraph 框架**重构的多智能体社会模拟系统。相比 V1 版本，V2 引入了以下核心特性：

### V2 核心特性

1. **LangGraph 图编排**: 基于 StateGraph 构建清晰的对话流程
2. **双层记忆系统**: 短期记忆（滑动窗口）+ 长期记忆（向量数据库）
3. **Skill 插件化体系**: YAML 声明式配置，支持专业技能扩展
4. **MCP 懒加载机制**: 按需启动外部工具，节省资源
5. **五级情感关系系统**: 从陌生人到挚友，动态影响对话风格

## 架构设计

```
┌──────────────────────────────────────────────┐
│          用户 / 小镇调度器                     │
└─────────────────┬────────────────────────────┘
                  │
┌─────────────────▼────────────────────────────┐
│    TownOrchestrator (小镇编排图)              │
└──┬──────┬──────┬──────┬──────────────────────┘
   │      │      │      │
┌──▼───┐ ┌─▼────┐ ┌▼────┐ ┌────────┐
│作家   │ │医生  │ │程序员│ │ ...    │
│Agent  │ │Agent │ │Agent │ │        │
└──┬───┘ └─┬────┘ └┬─────┘ └───┬────┘
   │       │       │           │
┌──▼───────▼───────▼───────────▼────────────┐
│         Agent Runtime Layer                │
│  Memory | Skill | MCP | Emotion | State   │
└────────────────────────────────────────────┘
```

## 安装

### 环境要求

- Python 3.9+
- pip

### 安装依赖

```bash
cd v2
pip install -r requirements.txt
```

## 快速开始

### 方式一：运行演示

```bash
python -m cyber_town.v2.main
```

### 方式二：在代码中使用

```python
import asyncio
from cyber_town.v2.graph.town_graph import create_default_town

async def main():
    # 创建小镇
    town = await create_default_town(num_agents=4)
    
    # 与智能体对话
    result = await town.chat(
        user_input="你好，最近怎么样？",
        target_agent_id="agent_0",
    )
    
    print(f"{result['agent_name']}: {result['response']}")
    
    # 清理资源
    await town.cleanup()

asyncio.run(main())
```

### 方式三：自定义智能体

```python
from cyber_town.v2.agents.base_agent import BaseAgent
from cyber_town.v2.agents.models import AgentProfile, Profession
from cyber_town.v2.graph.town_graph import TownOrchestrator

# 创建自定义智能体
profile = AgentProfile(
    name="小明",
    age=25,
    profession=Profession.PROGRAMMER,
    personality="理性、逻辑性强",
    background="互联网公司工程师",
    hobbies=["编程", "游戏"],
    skills=["code_review", "debugging"],
)

agent = BaseAgent(
    agent_id="custom_agent_001",
    profile=profile,
)

# 添加到小镇
town = TownOrchestrator(town_name="我的小镇")
town.add_agent(agent)
```

## 核心模块

### 1. Agents (智能体)

位置：`v2/agents/`

- `models.py`: 智能体档案和数据模型
- `base_agent.py`: 智能体基类

```python
from cyber_town.v2.agents import AgentProfile, Profession, BaseAgent

profile = AgentProfile(
    name="林墨",
    age=32,
    profession=Profession.WRITER,
    personality="内向、敏感、富有想象力",
    background="自由撰稿人，出版过三本小说",
)
```

### 2. Memory (记忆系统)

位置：`v2/memory/`

- `dual_memory.py`: 双层记忆系统实现

**短期记忆**: 保留最近 5 轮对话，超出自动压缩  
**长期记忆**: ChromaDB 向量存储，语义检索

```python
from cyber_town.v2.memory import create_memory_system

memory = create_memory_system(
    agent_id="agent_0",
    window_size=5,
)

# 添加消息
from langchain_core.messages import HumanMessage, AIMessage
memory.add_message(HumanMessage(content="你好"))
memory.add_message(AIMessage(content="你好！有什么可以帮助你的？"))

# 获取上下文
context = memory.get_context(query="打招呼")
```

### 3. Skills (技能系统)

位置：`v2/skills/`

- `skill_system.py`: 技能注册和执行

**YAML 配置示例**:

```yaml
name: creative_writing
description: 创意写作技能
trigger_keywords: [写小说，写故事，创作]
trigger_intent: creative_writing
system_prompt_enhancement: |
  你是一位经验丰富的作家...
```

```python
from cyber_town.v2.skills import get_skill_registry

registry = get_skill_registry()

# 查找匹配的技能
matched = registry.find_matching_skills("我想写一部小说")

# 执行技能
for skill in matched:
    result = await skill.execute("写一部关于 AI 的小说")
```

### 4. Emotion (情感系统)

位置：`v2/emotion/`

- `emotion_engine.py`: 五级情感关系引擎

**情感等级**:
- Lv.1 陌生人 (0-20)
- Lv.2 泛泛之交 (20-40)
- Lv.3 朋友 (40-60)
- Lv.4 好友 (60-80)
- Lv.5 挚友 (80-100)

```python
from cyber_town.v2.emotion import get_emotion_engine

engine = get_emotion_engine()

# 互动
result = engine.interact(
    agent_a_id="agent_0",
    agent_b_id="user",
    interaction_type="conversation",
    sentiment="positive",
)

print(f"情感变化：{result['delta']}, 新等级：{result['new_level']}")
```

### 5. MCP (懒加载器)

位置：`v2/mcp/`

- `lazy_loader.py`: MCP 懒加载机制

```python
from cyber_town.v2.mcp import get_mcp_loader

loader = get_mcp_loader()

# 懒加载 MCP 客户端
client = await loader.get_client("literature_search")

# 使用工具
tools = await client.list_tools()
result = await client.call_tool("search_classic_literature", query="鲁迅")
```

### 6. Graph (图编排)

位置：`v2/graph/`

- `agent_graph.py`: 单智能体对话流程
- `town_graph.py`: 小镇编排图

**单智能体流程**:
```
START → load_profile → query_memory → skill_match 
→ inject_emotion → load_mcp → invoke_llm → save_memory 
→ evaluate_emotion → END
```

## 高级用法

### 多智能体讨论

```python
# 组织多个智能体讨论话题
records = await town.multi_agent_chat(
    topic="人工智能的未来发展",
    participant_ids=["agent_0", "agent_1", "agent_2"],
    max_rounds=2,
)

for record in records:
    print(f"{record['agent_name']}: {record['response']}")
```

### 自定义技能

```python
from cyber_town.v2.skills import BaseSkill, SkillManifest

class CustomSkill(BaseSkill):
    async def execute(self, query: str, **kwargs) -> str:
        # 实现具体技能逻辑
        return f"执行结果：{query}"

# 注册技能
manifest = SkillManifest(
    name="custom_skill",
    description="自定义技能",
    trigger_keywords=["自定义"],
)
skill = CustomSkill(manifest)
registry.register_skill(skill)
```

## 项目结构

```
v2/
├── __init__.py              # 包初始化
├── main.py                  # 主程序入口
├── requirements.txt         # 依赖配置
├── agents/                  # 智能体模块
│   ├── models.py           # 数据模型
│   └── base_agent.py       # 智能体基类
├── memory/                  # 记忆系统
│   └── dual_memory.py      # 双层记忆
├── skills/                  # 技能系统
│   └── skill_system.py     # 技能管理
├── emotion/                 # 情感系统
│   └── emotion_engine.py   # 情感引擎
├── mcp/                     # MCP 模块
│   └── lazy_loader.py      # 懒加载器
├── graph/                   # LangGraph 编排
│   ├── agent_graph.py      # 单智能体图
│   └── town_graph.py       # 小镇编排图
└── configs/                 # 配置文件
    ├── skills/             # 技能 YAML 配置
    └── mcp/                # MCP 服务器配置
```

## 技术特点

1. **模块化设计**: 清晰的模块划分，易于理解和扩展
2. **异步支持**: 全面使用 asyncio，支持高并发
3. **类型安全**: 完整的类型注解
4. **可扩展性**: 插件化的技能和 MCP 系统
5. **状态管理**: LangGraph State 提供清晰的状态流

## 开发路线图

参考主文档 `../赛博小镇 V2 技术方案.md` 中的 6 周开发计划。

## 与 V1 的区别

| 特性 | V1 | V2 |
|------|----|----|
| 框架 | 规则引擎 | LangGraph |
| 记忆 | 内存列表 | 双层（短期 + 向量） |
| 技能 | 硬编码 | YAML 插件化 |
| 工具 | 无 | MCP 协议 |
| 情感 | 简单随机 | 五级关系系统 |
| 对话 | 基础 | 滑动窗口压缩 |

## 注意事项

1. **LLM 配置**: 需要配置 LLM API（如 OpenAI、Claude）
2. **向量数据库**: 生产环境建议使用 FAISS，开发环境可用 ChromaDB
3. **资源管理**: 使用完毕后调用 `cleanup()` 清理资源
4. **异步编程**: 所有主要方法都是异步的，需要使用 `await`

## 许可证

MIT License

---

**赛博小镇 V2 - 让 AI 智能体拥有记忆、技能和情感**
