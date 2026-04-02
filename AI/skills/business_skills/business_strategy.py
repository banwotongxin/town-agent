"""商业策略技能"""

from typing import Optional, Dict
from ..skill_system import BaseSkill, SkillManifest


class BusinessStrategySkill(BaseSkill):
    """商业策略技能 - 战略规划与商业模式设计"""

    def __init__(self, manifest: SkillManifest):
        super().__init__(manifest)

    async def execute(self, query: str, context: Optional[Dict] = None, **kwargs) -> str:
        if any(k in query for k in ["战略", "方向", "发展"]):
            return "清晰的战略是企业成功的指南针。请告诉我业务现状和目标，我用 SWOT 分析帮你梳理战略方向和优先级。"
        elif any(k in query for k in ["竞争", "对手", "差异化"]):
            return "知己知彼才能百战不殆。请描述你的行业格局，我帮你分析竞争态势，找到有护城河的差异化定位。"
        elif any(k in query for k in ["商业模式", "盈利", "变现"]):
            return "好的商业模式要创造、传递并捕获价值。请描述你的产品和目标用户，我帮你用商业模式画布梳理关键要素。"
        elif any(k in query for k in ["融资", "投资", "估值"]):
            return "融资节点很关键。请告诉我你的业务阶段和融资需求，我从投资人视角帮你梳理商业逻辑和亮点。"
        else:
            return "我对商业运营和战略规划有丰富经验。请告诉我你面临的商业问题，我来提供实用策略建议。"
