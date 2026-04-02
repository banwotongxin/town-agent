"""医疗咨询技能"""

from typing import Optional, Dict
from ..skill_system import BaseSkill, SkillManifest


class MedicalConsultSkill(BaseSkill):
    """医疗咨询技能 - 症状科普与就医方向指导"""

    def __init__(self, manifest: SkillManifest):
        super().__init__(manifest)

    async def execute(self, query: str, context: Optional[Dict] = None, **kwargs) -> str:
        if any(k in query for k in ["头疼", "头痛"]):
            return "头痛原因很多，可能是紧张性头痛、偏头痛、血压问题等。请描述头痛的部位、持续时间和伴随症状，我帮你判断是否需要就医。"
        elif any(k in query for k in ["发烧", "发热", "体温"]):
            return "发烧是身体对感染的防御反应。请告诉我体温数值和持续时间，以及是否有其他症状，我来评估严重程度。"
        elif any(k in query for k in ["腹痛", "肚子", "胃"]):
            return "腹部不适需要区分部位和性质。请描述疼痛的具体位置、是持续痛还是阵发痛、以及饮食情况，我帮你分析。"
        elif any(k in query for k in ["就医", "看病", "哪个科"]):
            return "就医科室的选择很重要。请告诉我你的主要症状，我帮你判断应该挂哪个科室，避免跑错地方。"
        else:
            return "我可以帮你了解症状的可能原因，并给出就医建议。请记住，我的建议仅供参考，如有不适请及时就医。请描述你的症状。"
