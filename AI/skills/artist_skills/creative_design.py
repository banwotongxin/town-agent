"""创意设计技能"""

from typing import Optional, Dict
from ..skill_system import BaseSkill, SkillManifest


class CreativeDesignSkill(BaseSkill):
    """创意设计技能 - 视觉设计与创作灵感指导"""

    def __init__(self, manifest: SkillManifest):
        super().__init__(manifest)

    async def execute(self, query: str, context: Optional[Dict] = None, **kwargs) -> str:
        if any(k in query for k in ["色彩", "颜色", "配色"]):
            return "色彩是设计的情感语言。告诉我你的设计主题和想传达的情绪，我帮你推荐合适的配色方案。"
        elif any(k in query for k in ["构图", "版式", "排版"]):
            return "好构图引导视线，讲述故事。请分享你的创作意图，我给出适合的构图方式和视觉层次建议。"
        elif any(k in query for k in ["灵感", "创意", "没有思路"]):
            return "创意枯竭时最需要的是换个视角。告诉我你的创作方向，我分享一些打破瓶颈的思维方法和参考风格。"
        else:
            return "我可以在构图、色彩、风格等方面给你专业的创意建议。请告诉我你的设计需求。"
