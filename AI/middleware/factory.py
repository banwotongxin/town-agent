"""
中间件工厂 - 创建不同环境配置的中间件管理器
"""

from .base import MiddlewareManager
from .dangling_action import DanglingActionMiddleware
from .guardrail import GuardrailMiddleware, AllowlistProvider
from .memory_summarization import MemorySummarizationMiddleware
from .concurrent_limit import ConcurrentActionLimitMiddleware
from .error_handling import ActionErrorHandlingMiddleware
from .loop_detection import LoopDetectionMiddleware
from .clarification import ClarificationMiddleware


def create_default_middleware_manager() -> MiddlewareManager:
    """创建默认(生产环境)中间件管理器"""
    manager = MiddlewareManager()
    manager.add_middleware(DanglingActionMiddleware())
    manager.add_middleware(GuardrailMiddleware(
        provider=AllowlistProvider(
            denied_actions={"自杀", "攻击", "破坏", "偷窃", "伤害"}
        ),
        fail_closed=True
    ))
    manager.add_middleware(MemorySummarizationMiddleware())
    manager.add_middleware(ConcurrentActionLimitMiddleware())
    manager.add_middleware(ActionErrorHandlingMiddleware())
    manager.add_middleware(LoopDetectionMiddleware())
    manager.add_middleware(ClarificationMiddleware())
    return manager


def create_development_middleware_manager() -> MiddlewareManager:
    """创建开发环境中间件管理器(更宽松)"""
    manager = MiddlewareManager()
    manager.add_middleware(DanglingActionMiddleware())
    # Guardrail disabled in dev
    guardrail = GuardrailMiddleware(
        provider=AllowlistProvider(),
        fail_closed=False
    )
    guardrail.disable()
    manager.add_middleware(guardrail)
    manager.add_middleware(MemorySummarizationMiddleware(
        max_memories=50, keep_recent=10
    ))
    manager.add_middleware(ConcurrentActionLimitMiddleware(max_concurrent=20))
    manager.add_middleware(ActionErrorHandlingMiddleware())
    manager.add_middleware(LoopDetectionMiddleware(warn_threshold=2, hard_limit=4))
    manager.add_middleware(ClarificationMiddleware())
    return manager


def create_high_security_middleware_manager() -> MiddlewareManager:
    """创建高安全环境中间件管理器(更严格)"""
    manager = MiddlewareManager()
    manager.add_middleware(DanglingActionMiddleware(timeout_seconds=5))
    manager.add_middleware(GuardrailMiddleware(
        provider=AllowlistProvider(
            allowed_actions={"工作", "休息", "社交", "探索", "吃饭"},
            denied_actions={"自杀", "攻击", "破坏", "偷窃", "伤害"}
        ),
        fail_closed=True
    ))
    manager.add_middleware(MemorySummarizationMiddleware(
        max_memories=50, keep_recent=10, importance_threshold=0.8
    ))
    manager.add_middleware(ConcurrentActionLimitMiddleware(max_concurrent=5))
    manager.add_middleware(ActionErrorHandlingMiddleware())
    manager.add_middleware(LoopDetectionMiddleware(warn_threshold=2, hard_limit=3))
    manager.add_middleware(ClarificationMiddleware())
    return manager
