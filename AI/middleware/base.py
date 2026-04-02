"""
中间件基础类 - 定义核心抽象和数据结构
"""

from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field
from enum import Enum


class MiddlewarePhase(Enum):
    """中间件执行阶段"""
    BEFORE_THINK = "before_think"      # 思考前
    AFTER_THINK = "after_think"        # 思考后
    BEFORE_ACTION = "before_action"    # 行动前
    AFTER_ACTION = "after_action"      # 行动后
    ON_ERROR = "on_error"              # 错误时


@dataclass
class MiddlewareContext:
    """中间件上下文"""
    agent_id: str
    agent_name: str
    phase: MiddlewarePhase
    current_state: str
    current_location: str
    goal: Optional[str] = None
    action: Optional[str] = None
    action_result: Optional[str] = None
    error: Optional[Exception] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class MiddlewareResult:
    """中间件处理结果"""
    should_continue: bool = True
    modified_action: Optional[str] = None
    modified_goal: Optional[str] = None
    message: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


class BaseMiddleware:
    """中间件基类"""

    def __init__(self, name: str):
        self.name = name
        self.enabled = True

    def process(self, context: MiddlewareContext, agent: Any) -> MiddlewareResult:
        """
        处理中间件逻辑

        Args:
            context: 中间件上下文
            agent: 智能体实例

        Returns:
            处理结果
        """
        raise NotImplementedError("Subclasses must implement process()")

    def enable(self):
        """启用中间件"""
        self.enabled = True

    def disable(self):
        """禁用中间件"""
        self.enabled = False


class MiddlewareManager:
    """中间件管理器"""

    def __init__(self):
        self.middlewares: List[BaseMiddleware] = []
        self.stats = {
            "total_processed": 0,
            "total_blocked": 0,
            "total_errors": 0,
            "total_summarizations": 0,
            "total_loop_detections": 0,
        }

    def add_middleware(self, middleware: BaseMiddleware):
        """添加中间件"""
        self.middlewares.append(middleware)

    def remove_middleware(self, name: str):
        """移除中间件"""
        self.middlewares = [m for m in self.middlewares if m.name != name]

    def process(self, context: MiddlewareContext, agent: Any) -> MiddlewareResult:
        """
        处理中间件链

        执行顺序:
        1. DanglingActionMiddleware
        2. GuardrailMiddleware
        3. MemorySummarizationMiddleware
        4. ConcurrentActionLimitMiddleware
        5. ActionErrorHandlingMiddleware
        6. LoopDetectionMiddleware
        7. ClarificationMiddleware
        """
        self.stats["total_processed"] += 1

        final_result = MiddlewareResult()

        for middleware in self.middlewares:
            if not middleware.enabled:
                continue

            try:
                result = middleware.process(context, agent)

                # 累积结果
                if result.message:
                    if final_result.message:
                        final_result.message += "\n" + result.message
                    else:
                        final_result.message = result.message

                if not result.should_continue:
                    self.stats["total_blocked"] += 1
                    final_result.should_continue = False
                    break

                if result.modified_action:
                    final_result.modified_action = result.modified_action

                if result.modified_goal:
                    final_result.modified_goal = result.modified_goal

                # 更新统计
                if "Summarization" in middleware.name:
                    self.stats["total_summarizations"] += 1
                elif "Loop" in middleware.name:
                    self.stats["total_loop_detections"] += 1

            except Exception as e:
                self.stats["total_errors"] += 1
                print(f"[MiddlewareManager] 中间件 {middleware.name} 执行错误: {e}")

        return final_result

    def get_stats(self) -> Dict[str, Any]:
        """获取统计信息"""
        return self.stats.copy()

    def enable_all(self):
        """启用所有中间件"""
        for middleware in self.middlewares:
            middleware.enable()

    def disable_all(self):
        """禁用所有中间件"""
        for middleware in self.middlewares:
            middleware.disable()
