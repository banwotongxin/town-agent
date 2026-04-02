# 赛博小镇快速启动指南

## 快速开始

### 1. 运行快速演示

**Windows:**
```cmd
cd cyber_town
python -m cyber_town.main --mode quick
```

**Linux/Mac:**
```bash
cd cyber_town
python3 -m cyber_town.main --mode quick
```

### 2. 使用交互式菜单

```bash
python -m cyber_town.main
```

然后选择:
- `1` - 快速演示 (5个智能体, 20步)
- `2` - 标准模拟 (10个智能体, 50步)
- `3` - 大规模模拟 (25个智能体, 100步)
- `4` - 交互式模式
- `5` - 自定义模拟
- `6` - 查看小镇状态

### 3. 在代码中使用

```python
from cyber_town.town import create_default_town
from cyber_town.simulation import create_simulation

# 创建小镇
town = create_default_town("赛博小镇", num_agents=10)

# 运行模拟
engine = create_simulation(town, time_step_delay=0.2)
engine.run(steps=50, verbose=True)
```

## 项目结构

```
cyber_town/
├── __init__.py          # 包初始化
├── agent.py             # 智能体实现
├── memory.py            # 记忆系统
├── environment.py       # 环境系统
├── town.py              # 小镇管理
├── simulation.py        # 模拟引擎
├── main.py              # 主程序
├── config.py            # 配置文件
├── examples.py          # 使用示例
├── test_cyber_town.py   # 单元测试
├── requirements.txt     # 依赖包
├── run.bat              # Windows启动脚本
├── run.sh               # Linux/Mac启动脚本
├── README.md            # 详细文档
└── QUICKSTART.md        # 本文件
```

## 核心功能

### 1. 智能体系统
每个智能体都有:
- 📋 独特的个人档案(姓名、年龄、职业、性格、背景)
- 🧠 记忆系统(记录、反思、检索)
- 😊 情绪系统(正面/负面情绪)
- 🎯 需求系统(能量、饱腹度、社交需求)
- 💬 社交能力(对话、建立关系)

### 2. 小镇环境
- 🏠 10+个不同类型的地点
- 🌅 昼夜循环系统
- ⚡ 随机事件系统

### 3. 模拟引擎
- 可配置的模拟参数
- 多种运行模式
- 回调函数支持

## 运行示例

### 运行所有示例
```bash
python examples.py
```

### 运行特定示例
```bash
python examples.py 1  # 基本使用
python examples.py 2  # 自定义智能体
python examples.py 3  # 自定义地点
# ... 更多示例 1-10
```

## 运行测试

```bash
python test_cyber_town.py
```

## 常见问题

### Q: 如何修改智能体数量?
A: 使用 `--agents` 参数或在代码中调用 `create_default_town(num_agents=N)`

### Q: 如何修改模拟步数?
A: 使用 `--steps` 参数或在代码中调用 `engine.run(steps=N)`

### Q: 如何调整模拟速度?
A: 使用 `--delay` 参数调整每步延迟(秒)

### Q: 能否添加自定义地点?
A: 可以! 参考 `examples.py` 中的示例3

### Q: 智能体能记住什么?
A: 智能体会记录对话、事件、地点、情绪等所有重要经历

## 更多信息

查看详细文档: [README.md](README.md)

## 支持

如有问题,请查看:
- README.md - 完整文档
- examples.py - 10个详细示例
- test_cyber_town.py - 单元测试

---

**赛博小镇 - 让AI智能体生活在虚拟世界** 🏙️
