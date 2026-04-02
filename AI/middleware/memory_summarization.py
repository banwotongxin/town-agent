"""
第三层: 记忆压缩 (MemorySummarizationMiddleware)

问题场景:
- 智能体记忆无限增长,导致上下文窗口溢出
- 旧记忆占用过多空间

解决方案:
- 定期压缩旧记忆
- 保留重要记忆
"""

from typing import Any, List
import random

from .base import BaseMiddleware, MiddlewareContext, MiddlewareResult


class MemorySummarizationMiddleware(BaseMiddleware):
    """记忆压缩中间件"""

    def __init__(self,
                 max_memories: int = 100,
                 keep_recent: int = 20,
                 importance_threshold: float = 0.7):
        super().__init__("MemorySummarizationMiddleware")
        self.max_memories = max_memories
        self.keep_recent = keep_recent
        self.importance_threshold = importance_threshold

    def process(self, context: MiddlewareContext, agent: Any) -> MiddlewareResult:
        if not self.enabled:
            return MiddlewareResult()

        # Check if agent has memory
        if hasattr(agent, 'memory'):
            memories = agent.memory
            memory_count = len(memories) if hasattr(memories, '__len__') else 0

            if memory_count > self.max_memories:
                self._compress_memories(agent)

        return MiddlewareResult()

    def _compress_memories(self, agent: Any):
        """压缩记忆"""
        memories = agent.memory
        if not hasattr(memories, 'memories'):
            return

        mem_list = memories.memories
        if len(mem_list) <= self.max_memories:
            return

        # Keep recent + important memories
        recent = mem_list[-self.keep_recent:]
        old = mem_list[:-self.keep_recent]

        important = [m for m in old if getattr(m, 'importance', 0.5) >= self.importance_threshold]

        # Random sample if still too many
        remaining = max(0, self.max_memories - len(recent) - len(important))
        if len(old) - len(important) > remaining:
            others = random.sample(
                [m for m in old if getattr(m, 'importance', 0.5) < self.importance_threshold],
                remaining
            )
        else:
            others = [m for m in old if getattr(m, 'importance', 0.5) < self.importance_threshold]

        memories.memories = important + others + recent
