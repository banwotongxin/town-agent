"""
第六层: 检测循环行为 (LoopDetectionMiddleware)

问题场景:
- 智能体反复执行相同行动
- 智能体陷入死循环

解决方案:
- 跟踪行动历史,检测重复模式
"""

from typing import Any, Dict, List
from collections import Counter

from .base import BaseMiddleware, MiddlewareContext, MiddlewareResult


class LoopDetectionMiddleware(BaseMiddleware):
    """检测循环行为中间件"""

    def __init__(self,
                 warn_threshold: int = 3,
                 hard_limit: int = 5,
                 window_size: int = 20):
        super().__init__("LoopDetectionMiddleware")
        self.warn_threshold = warn_threshold
        self.hard_limit = hard_limit
        self.window_size = window_size
        self.action_history: Dict[str, List[str]] = {}

    def process(self, context: MiddlewareContext, agent: Any) -> MiddlewareResult:
        if not self.enabled:
            return MiddlewareResult()

        agent_id = context.agent_id
        action = context.action or context.goal or ""

        if not action:
            return MiddlewareResult()

        # Record action
        if agent_id not in self.action_history:
            self.action_history[agent_id] = []

        self.action_history[agent_id].append(action)

        # Keep window size
        if len(self.action_history[agent_id]) > self.window_size:
            self.action_history[agent_id] = self.action_history[agent_id][-self.window_size:]

        # Check for loops
        recent = self.action_history[agent_id]
        if len(recent) >= self.warn_threshold:
            counter = Counter(recent[-self.warn_threshold:])
            most_common = counter.most_common(1)[0]
            count = most_common[1]

            if count >= self.hard_limit:
                return MiddlewareResult(
                    should_continue=False,
                    modified_goal="explore",
                    message=f"[{self.name}] 检测到死循环,强制变更目标: {most_common[0]} x{count}"
                )

            if count >= self.warn_threshold:
                return MiddlewareResult(
                    should_continue=True,
                    modified_goal="explore",
                    message=f"[{self.name}] 警告: 可能存在循环行为 - {most_common[0]} x{count}"
                )

        return MiddlewareResult()
