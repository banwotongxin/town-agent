"""答疑解惑技能"""

from typing import Optional, Dict
from ..skill_system import BaseSkill, SkillManifest


class QuestionAnsweringSkill(BaseSkill):
    """答疑解惑技能 - 解答学生问题，启发式辅导"""

    def __init__(self, manifest: SkillManifest):
        super().__init__(manifest)

    async def execute(self, query: str, context: Optional[Dict] = None, **kwargs) -> str:
        if any(k in query for k in ["作业", "题目", "习题"]):
            return "把题目发给我，我会一步步拆解解题思路，帮助你真正理解——而不只是给出答案。"
        elif any(k in query for k in ["考试", "复习", "备考"]):
            return "考前复习要有策略！请告诉我考试科目和你觉得薄弱的章节，我帮你梳理重点，制定高效复习计划。"
        elif any(k in query for k in ["不懂", "不理解", "听不懂"]):
            return "没关系，遇到困惑很正常。把你不理解的概念或题目告诉我，我换个角度用更直观的方式给你解释。"
        else:
            return "我很乐意解答你的学习疑问。请告诉我具体的问题，我用简单易懂的方式来帮你。"
