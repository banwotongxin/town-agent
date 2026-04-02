"""
第五层: 行动异常处理 (ActionErrorHandlingMiddleware)

问题场景:
- 智能体行动执行过程中抛出异常
- 异常未被捕获导致整个模拟崩溃

解决方案:
- 捕获并记录异常
- 提供优雅的降级处理
"""

from typing import Any, Dict, List

from .base import BaseMiddleware, MiddlewareContext, MiddlewareResult


class ActionErrorHandlingMiddleware(BaseMiddleware):
    """行动异常处理中间件"""

    def __init__(self, log_errors: bool = True, max_error_log: int = 100):
        super().__init__("ActionErrorHandlingMiddleware")
        self.log_errors = log_errors
        self.max_error_log = max_error_log
        self.error_log: List[Dict] = []

    def process(self, context: MiddlewareContext, agent: Any) -> MiddlewareResult:
        if not self.enabled:
            return MiddlewareResult()

        if context.phase.value == "on_error" and context.error:
            error_msg = str(context.error)

            if self.log_errors:
                self.error_log.append({
                    "agent_id": context.agent_id,
                    "phase": context.phase.value,
                    "error": error_msg,
                    "location": context.current_location,
                })
                if len(self.error_log) > self.max_error_log:
                    self.error_log = self.error_log[-self.max_error_log:]

            return MiddlewareResult(
                should_continue=True,
                message=f"[{self.name}] 捕获异常: {error_msg}"
            )

        return MiddlewareResult()
