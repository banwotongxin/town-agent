"""
第七层: 澄清拦截 (ClarificationMiddleware)

问题场景:
- 智能体目标模糊或不确定
- 行动意图不清晰

解决方案:
- 在目标模糊时拦截并请求澄清
"""

import re
from typing import Any

from .base import BaseMiddleware, MiddlewareContext, MiddlewareResult


class ClarificationMiddleware(BaseMiddleware):
    """澄清拦截中间件"""

    def __init__(self):
        super().__init__("ClarificationMiddleware")

    # Vague goal patterns
    VAGUE_PATTERNS = [
        re.compile(r'.*(?:可能|也许|大概|或者).*(?:吧|呢|吗)'),
        re.compile(r'^(?:嗯|啊|哦|呃|这个)'),
        re.compile(r'^(?:不知道|不确定|没想好)'),
        re.compile(r'^(?:随便|都可以|无所谓)'),
    ]

    def process(self, context: MiddlewareContext, agent: Any) -> MiddlewareResult:
        if not self.enabled:
            return MiddlewareResult()

        goal = context.goal or ""
        action = context.action or ""

        if context.phase.value == "before_think" and goal:
            if self._is_vague(goal):
                return MiddlewareResult(
                    should_continue=True,
                    modified_goal="explore",
                    message=f"[{self.name}] 目标模糊,建议探索: {goal}"
                )

        if context.phase.value == "before_action" and action:
            if self._is_vague(action):
                return MiddlewareResult(
                    should_continue=True,
                    message=f"[{self.name}] 行动意图不清晰: {action}"
                )

        return MiddlewareResult()

    def _is_vague(self, text: str) -> bool:
        for pattern in self.VAGUE_PATTERNS:
            if pattern.match(text):
                return True
        return False
