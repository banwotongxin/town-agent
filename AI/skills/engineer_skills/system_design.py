"""系统设计技能"""

from typing import Optional, Dict
from ..skill_system import BaseSkill, SkillManifest


class SystemDesignSkill(BaseSkill):
    """系统设计技能 - 复杂工程系统规划与架构设计"""

    def __init__(self, manifest: SkillManifest):
        super().__init__(manifest)

    async def execute(self, query: str, context: Optional[Dict] = None, **kwargs) -> str:
        if any(k in query for k in ["架构", "系统设计"]):
            return "架构设计要先确定核心约束。请告诉我业务规模、并发量和可靠性要求，我来设计合理的系统架构。"
        elif any(k in query for k in ["模块", "拆分", "划分"]):
            return "模块化设计能提升可维护性。请描述系统的核心功能边界，我帮你按照高内聚低耦合的原则划分模块。"
        elif any(k in query for k in ["接口", "API", "集成"]):
            return "清晰的接口规范是系统协作的基础。请描述需要集成的系统和数据流，我设计标准化的接口方案。"
        else:
            return "我擅长复杂系统的架构设计。请告诉我系统需求，我从整体架构到模块划分提供完整设计方案。"
