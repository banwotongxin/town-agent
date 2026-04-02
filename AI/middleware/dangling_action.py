"""
第一层: 修复悬空行动 (DanglingActionMiddleware)

问题场景:
- 智能体开始移动但被中断
- 智能体设定了目标但未完成
- 行动计时器被重置但状态未清理

解决方案:
- 检测未完成的行动
- 自动补全或回滚状态
"""

import time
from typing import Dict, Any

from .base import BaseMiddleware, MiddlewareContext, MiddlewareResult, MiddlewarePhase


class DanglingActionMiddleware(BaseMiddleware):
    """修复悬空行动"""

    def __init__(self, timeout_seconds: int = 10):
        """
        Args:
            timeout_seconds: 悬空超时时间(秒)
        """
        super().__init__("DanglingActionMiddleware")
        self.timeout_seconds = timeout_seconds
        self.dangling_actions: Dict[str, Dict] = {}

    def process(self, context: MiddlewareContext, agent: Any) -> MiddlewareResult:
        if not self.enabled:
            return MiddlewareResult()

        agent_id = context.agent_id

        # 检查是否有悬空行动
        if agent_id in self.dangling_actions:
            dangling = self.dangling_actions[agent_id]
            age = time.time() - dangling.get("timestamp", time.time())

            # 如果悬空超过一定时间,自动修复
            if age > self.timeout_seconds:
                self._fix_dangling_action(agent, dangling)
                del self.dangling_actions[agent_id]

                return MiddlewareResult(
                    should_continue=True,
                    message=f"[{self.name}] 修复了悬空行动: {dangling.get('action', 'unknown')}"
                )

        # 记录当前行动
        if context.action and context.phase == MiddlewarePhase.BEFORE_ACTION:
            self.dangling_actions[agent_id] = {
                "action": context.action,
                "location": context.current_location,
                "timestamp": time.time()
            }

        # 清理已完成的行动
        if context.phase == MiddlewarePhase.AFTER_ACTION:
            if agent_id in self.dangling_actions:
                del self.dangling_actions[agent_id]

        return MiddlewareResult()

    def _fix_dangling_action(self, agent: Any, dangling: Dict):
        """修复悬空行动"""
        # 恢复到安全状态
        agent.state = agent.__class__.__bases__[0].IDLE if hasattr(agent, 'IDLE') else "idle"
        agent.current_goal = None
        agent.action_timer = 0
