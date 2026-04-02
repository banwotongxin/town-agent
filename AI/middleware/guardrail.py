"""
第二层: 安全策略检查 (GuardrailMiddleware)

问题场景:
- 智能体尝试执行危险/不安全的行动
- 智能体访问受限地点

解决方案:
- 基于 Allowlist/Denylist 检查行动
- 可扩展的 GuardrailProvider 接口
"""

from typing import List, Optional, Set
from enum import Enum

from .base import BaseMiddleware, MiddlewareContext, MiddlewareResult, MiddlewarePhase


class GuardrailDecision(Enum):
    """安全策略决策"""
    ALLOW = "allow"
    DENY = "deny"
    CLARIFY = "clarify"


class GuardrailProvider:
    """安全策略提供者接口"""

    def check_action(self, action: str, agent_id: str) -> GuardrailDecision:
        raise NotImplementedError

    def check_location(self, location: str, agent_id: str) -> GuardrailDecision:
        raise NotImplementedError


class AllowlistProvider(GuardrailProvider):
    """白名单模式: 只允许列表中的行动"""

    def __init__(self,
                 allowed_actions: Optional[Set[str]] = None,
                 denied_actions: Optional[Set[str]] = None,
                 denied_locations: Optional[Set[str]] = None):
        self.allowed_actions = allowed_actions or set()
        self.denied_actions = denied_actions or set()
        self.denied_locations = denied_locations or set()

    def check_action(self, action: str, agent_id: str) -> GuardrailDecision:
        if any(d in action for d in self.denied_actions):
            return GuardrailDecision.DENY
        return GuardrailDecision.ALLOW

    def check_location(self, location: str, agent_id: str) -> GuardrailDecision:
        if location in self.denied_locations:
            return GuardrailDecision.DENY
        return GuardrailDecision.ALLOW


class CustomGuardrailProvider(GuardrailProvider):
    """自定义策略提供者"""

    def __init__(self, check_fn=None):
        self.check_fn = check_fn

    def check_action(self, action: str, agent_id: str) -> GuardrailDecision:
        if self.check_fn:
            return self.check_fn("action", action, agent_id)
        return GuardrailDecision.ALLOW

    def check_location(self, location: str, agent_id: str) -> GuardrailDecision:
        if self.check_fn:
            return self.check_fn("location", location, agent_id)
        return GuardrailDecision.ALLOW


class GuardrailMiddleware(BaseMiddleware):
    """安全策略检查中间件"""

    def __init__(self,
                 provider: Optional[GuardrailProvider] = None,
                 fail_closed: bool = True):
        super().__init__("GuardrailMiddleware")
        self.provider = provider or AllowlistProvider()
        self.fail_closed = fail_closed

    def process(self, context: MiddlewareContext, agent) -> MiddlewareResult:
        if not self.enabled:
            return MiddlewareResult()

        if context.phase in (MiddlewarePhase.BEFORE_ACTION, MiddlewarePhase.BEFORE_THINK):
            action = context.action or context.goal or ""

            try:
                decision = self.provider.check_action(action, context.agent_id)
            except Exception:
                if self.fail_closed:
                    return MiddlewareResult(
                        should_continue=False,
                        message=f"[{self.name}] 策略检查异常,行动已阻止(fail-closed)"
                    )
                return MiddlewareResult()

            if decision == GuardrailDecision.DENY:
                return MiddlewareResult(
                    should_continue=False,
                    message=f"[{self.name}] 行动被策略阻止: {action}"
                )

            if decision == GuardrailDecision.CLARIFY:
                return MiddlewareResult(
                    should_continue=False,
                    modified_goal=None,
                    message=f"[{self.name}] 需要澄清行动意图: {action}"
                )

        return MiddlewareResult()
