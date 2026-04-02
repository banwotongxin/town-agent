"""健康建议技能"""

from typing import Optional, Dict
from ..skill_system import BaseSkill, SkillManifest


class HealthAdviceSkill(BaseSkill):
    """健康建议技能 - 日常健康管理与预防指导"""

    def __init__(self, manifest: SkillManifest):
        super().__init__(manifest)

    async def execute(self, query: str, context: Optional[Dict] = None, **kwargs) -> str:
        if any(k in query for k in ["睡眠", "失眠", "睡不着"]):
            return "睡眠质量很重要。先告诉我你的具体情况：入睡困难、易醒，还是早醒？我来给出针对性的改善建议。"
        elif any(k in query for k in ["饮食", "吃", "营养"]):
            return "合理饮食是健康的基础。请告诉我你的年龄、身体状况和饮食习惯，我帮你制定适合的营养方案。"
        elif any(k in query for k in ["运动", "锻炼", "健身"]):
            return "运动贵在坚持。请告诉我你的年龄、体能状况和可用时间，我给你推荐适合的运动方式和频率。"
        elif any(k in query for k in ["减肥", "体重", "瘦"]):
            return "健康减重需要综合干预。体重管理的核心是饮食、运动和生活习惯的结合，而不是单纯节食。告诉我你的基本情况，我来制定计划。"
        else:
            return "我可以为你提供健康生活方式的专业建议。请告诉我你关心的健康问题，我来帮你。"
