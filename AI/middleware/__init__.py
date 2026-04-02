"""
中间件防护系统 - 赛博小镇智能体行为保护机制

基于AI Agent中间件防护体系设计,为多智能体系统提供七层防护:
1. DanglingActionMiddleware - 修复悬空行动
2. GuardrailMiddleware - 安全策略检查
3. MemorySummarizationMiddleware - 记忆压缩
4. ConcurrentActionLimitMiddleware - 限制并发行动
5. ActionErrorHandlingMiddleware - 行动异常处理
6. LoopDetectionMiddleware - 检测循环行为
7. ClarificationMiddleware - 澄清拦截
"""

from .base import (
    MiddlewarePhase,
    MiddlewareContext,
    MiddlewareResult,
    BaseMiddleware,
    MiddlewareManager,
)
from .dangling_action import DanglingActionMiddleware
from .guardrail import (
    GuardrailDecision,
    GuardrailProvider,
    AllowlistProvider,
    CustomGuardrailProvider,
    GuardrailMiddleware,
)
from .memory_summarization import MemorySummarizationMiddleware
from .concurrent_limit import ConcurrentActionLimitMiddleware
from .error_handling import ActionErrorHandlingMiddleware
from .loop_detection import LoopDetectionMiddleware
from .clarification import ClarificationMiddleware
from .factory import (
    create_default_middleware_manager,
    create_development_middleware_manager,
    create_high_security_middleware_manager,
)

__all__ = [
    # 基础类
    "MiddlewarePhase",
    "MiddlewareContext",
    "MiddlewareResult",
    "BaseMiddleware",
    "MiddlewareManager",
    # 第一层
    "DanglingActionMiddleware",
    # 第二层
    "GuardrailDecision",
    "GuardrailProvider",
    "AllowlistProvider",
    "CustomGuardrailProvider",
    "GuardrailMiddleware",
    # 第三层
    "MemorySummarizationMiddleware",
    # 第四层
    "ConcurrentActionLimitMiddleware",
    # 第五层
    "ActionErrorHandlingMiddleware",
    # 第六层
    "LoopDetectionMiddleware",
    # 第七层
    "ClarificationMiddleware",
    # 工厂函数
    "create_default_middleware_manager",
    "create_development_middleware_manager",
    "create_high_security_middleware_manager",
]
