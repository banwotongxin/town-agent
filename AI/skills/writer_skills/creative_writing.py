"""创意写作技能"""

from typing import Optional, Dict
from ..skill_system import BaseSkill, SkillManifest


class CreativeWritingSkill(BaseSkill):
    """创意写作技能 - 故事、诗歌、散文等文学创作"""

    def __init__(self, manifest: SkillManifest):
        super().__init__(manifest)

    async def execute(self, query: str, context: Optional[Dict] = None, **kwargs) -> str:
        if any(k in query for k in ["故事", "小说"]):
            return "我来帮你创作一个精彩的故事。请告诉我：想要什么类型（悬疑/奇幻/科幻/现实）？主角是谁？有什么核心冲突？"
        elif any(k in query for k in ["诗歌", "诗", "词"]):
            return "诗歌是文字最精粹的形式。请告诉我想表达的情感或主题，我来写一首适合你的诗。"
        elif any(k in query for k in ["散文", "随笔"]):
            return "散文贵在真情实感。请分享你想写的主题或某段经历，我帮你打磨成一篇有温度的文章。"
        elif any(k in query for k in ["文案", "广告", "宣传"]):
            return "好文案击中人心。请告诉我产品特点、目标用户和想传达的情感，我来创作有感染力的文案。"
        else:
            return "我擅长各类文学创作——小说、诗歌、散文、剧本都可以。请告诉我你想写什么，我们一起创作。"
