# 赛博小镇中间件防护体系

## 概述

本文档介绍赛博小镇的多智能体系统中间件防护体系,该体系基于AI Agent中间件防护架构设计,为多智能体社会模拟提供七层安全防护。

## 防护体系架构

```
智能体行为请求
    ↓
┌─────────────────────────────────────────────┐
│           七层防护中间件体系                  │
├─────────────────────────────────────────────┤
│ 1. DanglingActionMiddleware                │ ← 修复悬空行动
│    修复中断的行动,补全缺失状态               │
├─────────────────────────────────────────────┤
│ 2. GuardrailMiddleware                     │ ← 安全策略检查
│    行动执行前安全检查,阻止危险操作           │
├─────────────────────────────────────────────┤
│ 3. MemorySummarizationMiddleware           │ ← 压缩记忆
│    记忆过多时压缩,优化决策效率               │
├─────────────────────────────────────────────┤
│ 4. ConcurrentActionLimitMiddleware         │ ← 限制并发行动
│    限制并发行动数,防止系统过载               │
├─────────────────────────────────────────────┤
│ 5. ActionErrorHandlingMiddleware           │ ← 异常处理
│    捕获行动异常,转换为可读错误消息           │
├─────────────────────────────────────────────┤
│ 6. LoopDetectionMiddleware                 │ ← 检测循环行为
│    检测重复行为模式,打破死循环               │
├─────────────────────────────────────────────┤
│ 7. ClarificationMiddleware                 │ ← 澄清拦截
│    拦截澄清请求,中断到用户交互               │
└─────────────────────────────────────────────┘
    ↓
安全的智能体行为
```

## 快速开始

### 1. 基本使用

```python
from cyber_town.middleware_integration import AgentWithMiddleware
from cyber_town.agent import AgentProfile
from cyber_town.middleware import create_default_middleware_manager

# 创建中间件管理器
middleware_manager = create_default_middleware_manager()

# 创建智能体档案
profile = AgentProfile(
    name="张三",
    age=25,
    occupation="程序员",
    personality="开朗",
    background="从小镇来到大城市",
    hobbies=["编程", "阅读"]
)

# 创建带中间件保护的智能体
agent = AgentWithMiddleware(
    agent_id="agent_001",
    profile=profile,
    middleware_manager=middleware_manager
)

# 智能体思考和行动(自动受中间件保护)
decision = agent.think()
action = agent.decide_action([], ["cafe", "park", "office"])
```

### 2. 集成到小镇系统

```python
from cyber_town.town import Town
from cyber_town.middleware_integration import AgentWithMiddleware
from cyber_town.middleware import create_default_middleware_manager

# 创建小镇
town = Town("赛博小镇")

# 创建中间件管理器
middleware_manager = create_default_middleware_manager()

# 添加受保护的智能体
agent = AgentWithMiddleware(
    agent_id="agent_001",
    profile=profile,
    middleware_manager=middleware_manager
)

town.add_agent(agent)

# 运行模拟(自动应用中间件保护)
# ...
```

## 七层防护详解

### 第一层: 修复悬空行动 (DanglingActionMiddleware)

**问题场景:**
- 智能体开始移动但被中断
- 智能体设定了目标但未完成
- 行动计时器被重置但状态未清理

**解决方案:**
- 检测未完成的行动
- 自动补全或回滚状态
- 恢复到安全状态

**示例:**
```python
# 智能体开始移动到咖啡馆
agent.set_goal("socialize")
agent.action_timer = 5

# 突然中断(如用户停止模拟)

# 中间件自动检测并修复:
# - 重置状态为 IDLE
# - 清除当前目标
# - 重置行动计时器
```

### 第二层: 安全策略检查 (GuardrailMiddleware)

**问题场景:**
- 智能体可能执行危险或不合理的行动
- 需要限制智能体的行为范围

**解决方案:**
- 行动执行前进行安全检查
- 支持黑名单/白名单模式
- 可自定义安全策略

**配置示例:**
```yaml
guardrail:
  enabled: true
  fail_closed: true  # 安全优先
  provider:
    type: "allowlist"
    denied_actions:
      - "自杀"
      - "攻击"
      - "破坏"
```

**自定义策略:**
```python
from cyber_town.middleware import GuardrailMiddleware, AllowlistProvider

# 黑名单模式
provider = AllowlistProvider(
    denied_actions=["攻击", "破坏"]
)

# 白名单模式
provider = AllowlistProvider(
    allowed_actions=["工作", "休息", "社交"]
)

middleware = GuardrailMiddleware(provider=provider, fail_closed=True)
```

### 第三层: 记忆压缩 (MemorySummarizationMiddleware)

**问题场景:**
- 智能体记忆过多,影响决策效率
- 记忆系统占用过多内存

**解决方案:**
- 当记忆数量超过阈值时压缩
- 保留重要记忆和最近记忆
- 优化决策效率

**配置示例:**
```yaml
memory_summarization:
  enabled: true
  max_memories: 100  # 最大记忆数量
  keep_recent: 20    # 保留最近20条
  importance_threshold: 0.7  # 重要记忆阈值
```

**效果:**
```
原始记忆 (150条):
- 记忆1: 来到小镇 (重要性: 0.9) ✓
- 记忆2: 在咖啡馆聊天 (重要性: 0.6)
- 记忆3: 在公园散步 (重要性: 0.5)
- ... (147条记忆)
- 记忆149: 刚刚喝了咖啡 (重要性: 0.7) ✓
- 记忆150: 正在走路 (重要性: 0.4)

压缩后 (50条):
- 保留所有重要性 > 0.7 的记忆
- 保留最近 20 条记忆
- 删除不重要且陈旧的记忆
```

### 第四层: 限制并发行动 (ConcurrentActionLimitMiddleware)

**问题场景:**
- 多个智能体同时执行大量行动
- 系统资源过载
- 性能下降

**解决方案:**
- 限制每个时间步同时执行行动的智能体数量
- 超过限制的智能体推迟到下一时间步

**配置示例:**
```yaml
concurrent_limit:
  enabled: true
  max_concurrent: 10  # 最大10个智能体同时行动
```

**效果:**
```
时间步 1:
- 智能体1: 行动中
- 智能体2: 行动中
- ...
- 智能体10: 行动中
- 智能体11-20: 等待队列

时间步 2:
- 智能体1-10: 等待
- 智能体11-20: 行动中
```

### 第五层: 行动异常处理 (ActionErrorHandlingMiddleware)

**问题场景:**
- 智能体行动失败
- 异常导致模拟中断
- 用户看到错误堆栈

**解决方案:**
- 捕获所有异常
- 转换为友好的错误消息
- 让智能体选择其他行动

**示例:**
```python
# 智能体尝试移动到不存在的地点
try:
    agent.move_to("神秘地点")  # 不存在
except Exception as e:
    # 中间件捕获异常
    # 转换为: "找不到目标地点"
    # 智能体可以选择其他地点
```

### 第六层: 检测循环行为 (LoopDetectionMiddleware)

**问题场景:**
- 智能体陷入重复行为的死循环
- 例如:来回移动、重复相同的对话
- 浪费计算资源

**解决方案:**
- 追踪智能体的行为历史
- 检测重复模式
- 警告并强制打破循环

**配置示例:**
```yaml
loop_detection:
  enabled: true
  warn_threshold: 3  # 第3次重复时警告
  hard_limit: 5      # 第5次重复时强制停止
  window_size: 20    # 追踪最近20次行为
```

**两级保护机制:**
```
第 3 次重复: ⚠️ 警告
  注入警告消息: "检测到重复行为,请改变行动"
  智能体看到警告,自我纠正 ✅

第 5 次重复: 🛑 强制停止
  重置状态为 IDLE
  清除当前目标
  智能体必须选择新行动 ✅
```

### 第七层: 澄清拦截 (ClarificationMiddleware)

**问题场景:**
- 智能体无法决定行动
- 多个目标冲突
- 需要外部输入

**解决方案:**
- 拦截澄清请求
- 中断到用户交互
- 等待用户回复

**示例:**
```python
# 智能体无法决定
agent.set_goal("need_clarification")

# 中间件拦截
# 提取问题: "我该去咖啡馆还是图书馆?"
# 中断模拟,等待用户回复

# 用户回复
user_input = "去咖啡馆"
agent.current_goal = "explore"
agent.location = "cafe"
```

## 环境配置

### 生产环境

```python
from cyber_town.middleware import create_default_middleware_manager

# 生产环境配置(推荐)
manager = create_default_middleware_manager()
```

**特点:**
- 启用所有防护机制
- 适中的限制阈值
- 安全优先

### 开发环境

```python
from cyber_town.middleware import create_development_middleware_manager

# 开发环境配置
manager = create_development_middleware_manager()
```

**特点:**
- 禁用部分检查(方便测试)
- 更宽松的限制
- 更早的警告

### 高安全环境

```python
from cyber_town.middleware import create_high_security_middleware_manager

# 高安全环境配置
manager = create_high_security_middleware_manager()
```

**特点:**
- 最严格的限制
- 只允许白名单行动
- 更早检测循环

## 监控和调试

### 查看统计信息

```python
# 获取中间件统计
stats = agent.get_middleware_stats()

print(f"总处理次数: {stats['total_processed']}")
print(f"阻止次数: {stats['total_blocked']}")
print(f"记忆压缩次数: {stats['total_summarizations']}")
print(f"循环检测次数: {stats['total_loop_detections']}")
```

### 查看中间件日志

```python
# 获取中间件日志
logs = agent.middleware_logs

for log in logs:
    print(f"{log['timestamp']}: {log['message']}")
```

### 启用/禁用中间件

```python
# 禁用所有中间件
manager.disable_all()

# 启用所有中间件
manager.enable_all()

# 禁用特定中间件
for middleware in manager.middlewares:
    if "Guardrail" in middleware.name:
        middleware.disable()
```

## 最佳实践

### 1. 中间件顺序

**必须按照以下顺序添加中间件:**
1. DanglingActionMiddleware
2. GuardrailMiddleware
3. MemorySummarizationMiddleware
4. ConcurrentActionLimitMiddleware
5. ActionErrorHandlingMiddleware
6. LoopDetectionMiddleware
7. ClarificationMiddleware

### 2. 生产环境部署清单

- [ ] 启用所有中间件
- [ ] 配置安全策略(至少禁止危险行动)
- [ ] 设置记忆压缩阈值
- [ ] 配置并发限制
- [ ] 启用循环检测
- [ ] 配置日志记录

### 3. 性能优化

**Token/内存优化:**
- 启用 MemorySummarizationMiddleware
- 设置合理的 max_memories 值
- 使用较高的 importance_threshold

**响应速度优化:**
- 调整并发限制
- 减少不必要的中间件
- 优化日志级别

### 4. 故障排查

**检查清单:**
- [ ] 中间件是否正确注册
- [ ] 执行顺序是否正确
- [ ] 配置参数是否合理
- [ ] 日志是否正常

**常见问题:**

Q: 合法行动被阻止?
```python
# 检查安全策略配置
guardrail.provider.denied_actions  # 是否过于严格

# 解决方案:调整黑名单或使用白名单
```

Q: 记忆压缩丢失重要信息?
```yaml
# 调整配置
memory_summarization:
  keep_recent: 30  # 增加保留数量
  importance_threshold: 0.6  # 降低阈值
```

Q: 正常行为被误判为循环?
```python
# 调整阈值
LoopDetectionMiddleware(
    warn_threshold=5,  # 提高警告阈值
    hard_limit=10,     # 提高强制停止阈值
    window_size=50     # 增大窗口
)
```

## 配置文件说明

配置文件 `middleware_config.yaml` 包含所有中间件的配置选项:

```yaml
# 第一层: 修复悬空行动
dangling_action:
  enabled: true
  timeout_seconds: 10

# 第二层: 安全策略检查
guardrail:
  enabled: true
  fail_closed: true
  provider:
    type: "allowlist"
    denied_actions: [...]
  
# ... 其他配置
```

## 示例代码

完整示例代码请参考 `middleware_integration.py`:

```bash
# 运行示例
python -m cyber_town.middleware_integration
```

## 参考资料

- [AI Agent中间件防护体系技术文档](./AI_Agent中间件防护体系技术文档.md)
- [赛博小镇主文档](./README.md)

---

**文档版本:** v1.0  
**最后更新:** 2026-03-31  
**适用版本:** Cyber Town v1.0+
