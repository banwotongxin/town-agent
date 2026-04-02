"""调试排错技能"""

from typing import Optional, Dict
from ..skill_system import BaseSkill, SkillManifest


class DebuggingSkill(BaseSkill):
    """调试排错技能 - 定位并修复代码缺陷"""

    def __init__(self, manifest: SkillManifest):
        super().__init__(manifest)

    async def execute(self, query: str, context: Optional[Dict] = None, **kwargs) -> str:
        if any(k in query for k in ["报错", "异常", "exception", "error"]):
            return "先把完整的报错信息发给我，包括堆栈跟踪（traceback）。我会帮你定位根因并给出修复方案。"
        elif any(k in query for k in ["运行", "启动", "执行"]):
            return "运行问题通常有几类原因：环境配置、依赖版本、逻辑错误。请描述具体现象，我来系统排查。"
        elif any(k in query for k in ["修复", "fix", "解决"]):
            return "告诉我问题的具体表现和你已经尝试过的方法，我帮你找到最合适的解决方案。"
        else:
            return "我擅长调试各类代码问题。请描述你遇到的 bug 或异常，最好附上报错信息和相关代码。"
