"""课程规划技能"""

from typing import Optional, Dict
from ..skill_system import BaseSkill, SkillManifest


class CoursePlanningSkill(BaseSkill):
    """课程规划技能 - 制定教学计划和课程大纲"""

    def __init__(self, manifest: SkillManifest):
        super().__init__(manifest)

    async def execute(self, query: str, context: Optional[Dict] = None, **kwargs) -> str:
        if any(k in query for k in ["大纲", "教案", "课程设计"]):
            return "我来帮你设计课程大纲。请告诉我：课程主题、目标受众的年龄和基础、总课时数，我给你输出完整的教学框架。"
        elif any(k in query for k in ["备课", "上课"]):
            return "备课是教学质量的保障。请告诉我本次授课的主题，我帮你规划教学目标、知识点层次和课堂活动设计。"
        elif any(k in query for k in ["进度", "计划", "安排"]):
            return "合理的教学进度能确保学生充分消化。请提供学期总课时和核心知识点清单，我来做进度规划。"
        else:
            return "我可以帮你规划课程体系。请告诉我课程主题和学生情况，我提供专业的教学设计方案。"
