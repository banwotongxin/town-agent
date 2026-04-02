"""
第四层: 限制并发行动 (ConcurrentActionLimitMiddleware)

问题场景:
- 过多智能体同时执行行动,导致资源争抢
- 系统负载过高

解决方案:
- 限制同时执行的行动数量
"""

from typing import Any

from .base import BaseMiddleware, MiddlewareContext, MiddlewareResult


class ConcurrentActionLimitMiddleware(BaseMiddleware):
    """限制并发行动中间件"""

    def __init__(self, max_concurrent: int = 10):
        super().__init__("ConcurrentActionLimitMiddleware")
        self.max_concurrent = max_concurrent
        self._current_actions = 0

    def process(self, context: MiddlewareContext, agent: Any) -> MiddlewareResult:
        if not self.enabled:
            return MiddlewareResult()

        if context.phase.value == "before_action":
            if self._current_actions >= self.max_concurrent:
                return MiddlewareResult(
                    should_continue=False,
                    message=f"[{self.name}] 并发行动数已达上限 ({self.max_concurrent})"
                )
            self._current_actions += 1

        elif context.phase.value == "after_action":
            self._current_actions = max(0, self._current_actions - 1)

        return MiddlewareResult()

    def reset_step(self):
        """每个时间步重置并发计数"""
        self._current_actions = 0
