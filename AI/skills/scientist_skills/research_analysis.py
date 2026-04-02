"""科研分析技能"""

from typing import Optional, Dict
from ..skill_system import BaseSkill, SkillManifest


class ResearchAnalysisSkill(BaseSkill):
    """科研分析技能 - 实验设计与研究方法论指导"""

    def __init__(self, manifest: SkillManifest):
        super().__init__(manifest)

    async def execute(self, query: str, context: Optional[Dict] = None, **kwargs) -> str:
        if any(k in query for k in ["实验", "验证", "测试"]):
            return "严谨的实验设计是科学发现的保障。请告诉我研究假设和关键变量，我帮你设计控制变量严密的实验方案。"
        elif any(k in query for k in ["假设", "猜想", "理论"]):
            return "好的假设要有理论依据且可被验证。请分享你的研究方向，我帮你评估假设的合理性并梳理现有理论支撑。"
        elif any(k in query for k in ["结论", "发现", "说明什么"]):
            return "从证据到结论需要严格的逻辑推导。请分享你的实验结果，我帮你分析其中的规律并评估结论的外推边界。"
        else:
            return "我熟悉科学研究方法论。请告诉我你的研究问题，从实验设计到结果分析我全程给出专业建议。"
