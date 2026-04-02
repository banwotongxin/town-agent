"""数据解读技能"""

from typing import Optional, Dict
from ..skill_system import BaseSkill, SkillManifest


class DataInterpretationSkill(BaseSkill):
    """数据解读技能 - 统计分析与科学数据解读"""

    def __init__(self, manifest: SkillManifest):
        super().__init__(manifest)

    async def execute(self, query: str, context: Optional[Dict] = None, **kwargs) -> str:
        if any(k in query for k in ["图表", "可视化", "画图"]):
            return "合适的图表让规律一目了然。请描述你的数据类型和想表达的关系，我帮你选择最佳可视化方式并解读关键信息。"
        elif any(k in query for k in ["趋势", "规律", "变化"]):
            return "识别数据趋势需要结合背景知识。请提供你的数据，我帮你分析时间序列趋势、周期性规律或异常点。"
        elif any(k in query for k in ["预测", "模型", "回归"]):
            return "预测建模需要选对方法。请告诉我数据特征和预测目标，我帮你分析适用的统计方法或机器学习模型。"
        elif any(k in query for k in ["统计", "显著", "p值"]):
            return "统计显著性检验是科学推断的关键。请描述你的数据和研究问题，我帮你选择合适的统计检验方法。"
        else:
            return "我擅长数据分析与统计解读。请分享你的数据或研究问题，我帮你挖掘背后的科学规律。"
