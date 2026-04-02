"""故事分析技能"""

from typing import Optional, Dict
from ..skill_system import BaseSkill, SkillManifest


class StoryAnalysisSkill(BaseSkill):
    """故事分析技能 - 文学作品结构分析与叙事评析"""

    def __init__(self, manifest: SkillManifest):
        super().__init__(manifest)

    async def execute(self, query: str, context: Optional[Dict] = None, **kwargs) -> str:
        if any(k in query for k in ["结构", "三幕", "叙事"]):
            return "故事结构是叙事的骨架。请分享你的故事梗概，我用三幕式结构或英雄旅程框架来分析它的完整性。"
        elif any(k in query for k in ["人物", "角色", "性格"]):
            return "人物是故事的灵魂。请告诉我你的角色设定，我帮你分析动机是否充分、性格弧度是否合理。"
        elif any(k in query for k in ["主题", "寓意", "象征"]):
            return "主题赋予故事深度。请分享你的作品，我帮你挖掘潜在的主题、象征意象和深层含义。"
        elif any(k in query for k in ["逻辑", "漏洞", "矛盾"]):
            return "情节逻辑很关键。请把你觉得有问题的段落发给我，我来检查因果关系和情节自洽性。"
        else:
            return "我擅长分析故事的结构、人物、主题和叙事逻辑。请分享你想分析的作品或草稿。"
