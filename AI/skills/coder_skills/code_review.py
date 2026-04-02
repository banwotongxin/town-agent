"""代码审查技能"""

from typing import Optional, Dict
from ..skill_system import BaseSkill, SkillManifest


class CodeReviewSkill(BaseSkill):
    """代码审查技能 - 审查代码质量、性能与安全"""

    def __init__(self, manifest: SkillManifest):
        super().__init__(manifest)

    async def execute(self, query: str, context: Optional[Dict] = None, **kwargs) -> str:
        if any(k in query for k in ["优化", "性能"]):
            return "我来帮你优化代码。请分享你的代码，我会从算法复杂度、内存占用、IO 效率等角度给出具体改进建议。"
        elif any(k in query for k in ["安全", "漏洞", "注入"]):
            return "安全审查是我的强项。请分享代码，我会检查 SQL 注入、XSS、权限漏洞等常见安全问题。"
        elif any(k in query for k in ["bug", "错误", "报错"]):
            return "帮你找 bug。请把代码和报错信息都发给我，我会逐行分析找出问题所在并给出修复方案。"
        elif any(k in query for k in ["审查", "review", "检查"]):
            return "我来做全面的代码审查。请分享代码，我会从可读性、可维护性、性能、安全性四个维度评估。"
        else:
            return "我是代码审查专家，可以帮你找 bug、优化性能、排查安全漏洞。请分享你的代码。"
