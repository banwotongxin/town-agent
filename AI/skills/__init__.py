"""
Skills Package
技能系统模块 - 插件化专业技能管理
"""

from pathlib import Path
from .skill_system import (
    SkillManifest,
    BaseSkill,
    SkillRegistry,
    DEFAULT_SKILLS,
    create_default_registry,
    get_skill_registry,
)
from .writer_skills.creative_writing import CreativeWritingSkill
from .writer_skills.story_analysis import StoryAnalysisSkill
from .doctor_skills.medical_consult import MedicalConsultSkill
from .doctor_skills.health_advice import HealthAdviceSkill
from .coder_skills.code_review import CodeReviewSkill
from .coder_skills.debugging import DebuggingSkill
from .teacher_skills.course_planning import CoursePlanningSkill
from .teacher_skills.question_answering import QuestionAnsweringSkill
from .artist_skills.art_critique import ArtCritiqueSkill
from .artist_skills.creative_design import CreativeDesignSkill
from .engineer_skills.technical_analysis import TechnicalAnalysisSkill
from .engineer_skills.system_design import SystemDesignSkill
from .scientist_skills.research_analysis import ResearchAnalysisSkill
from .scientist_skills.data_interpretation import DataInterpretationSkill
from .business_skills.business_strategy import BusinessStrategySkill
from .business_skills.market_analysis import MarketAnalysisSkill

# 技能名称 → 实现类的映射（供注册表使用）
SKILL_CLASS_MAP = {
    "creative_writing": CreativeWritingSkill,
    "story_analysis": StoryAnalysisSkill,
    "medical_consult": MedicalConsultSkill,
    "health_advice": HealthAdviceSkill,
    "code_review": CodeReviewSkill,
    "debugging": DebuggingSkill,
    "course_planning": CoursePlanningSkill,
    "question_answering": QuestionAnsweringSkill,
    "art_critique": ArtCritiqueSkill,
    "creative_design": CreativeDesignSkill,
    "technical_analysis": TechnicalAnalysisSkill,
    "system_design": SystemDesignSkill,
    "research_analysis": ResearchAnalysisSkill,
    "data_interpretation": DataInterpretationSkill,
    "business_strategy": BusinessStrategySkill,
    "market_analysis": MarketAnalysisSkill,
}

# 职业 → 技能目录的映射
PROFESSION_SKILL_DIRS = {
    "作家": "writer_skills",
    "医生": "doctor_skills",
    "程序员": "coder_skills",
    "教师": "teacher_skills",
    "艺术家": "artist_skills",
    "工程师": "engineer_skills",
    "科学家": "scientist_skills",
    "商人": "business_skills",
}


def create_full_registry() -> SkillRegistry:
    """
    创建包含所有职业技能的完整注册中心

    从各职业技能目录加载 YAML 清单，并绑定对应的实现类。
    """
    registry = SkillRegistry()

    # 注册所有技能实现类
    for skill_name, skill_class in SKILL_CLASS_MAP.items():
        registry.register_skill_class(skill_name, skill_class)

    # 从各职业目录加载 YAML 清单
    skills_root = Path(__file__).parent
    for skill_dir in PROFESSION_SKILL_DIRS.values():
        dir_path = skills_root / skill_dir
        if dir_path.exists():
            registry.load_skills_from_directory(str(dir_path))

    return registry


__all__ = [
    "SkillManifest",
    "BaseSkill",
    "SkillRegistry",
    "DEFAULT_SKILLS",
    "SKILL_CLASS_MAP",
    "PROFESSION_SKILL_DIRS",
    "create_default_registry",
    "create_full_registry",
    "get_skill_registry",
    # Writer
    "CreativeWritingSkill",
    "StoryAnalysisSkill",
    # Doctor
    "MedicalConsultSkill",
    "HealthAdviceSkill",
    # Programmer
    "CodeReviewSkill",
    "DebuggingSkill",
    # Teacher
    "CoursePlanningSkill",
    "QuestionAnsweringSkill",
    # Artist
    "ArtCritiqueSkill",
    "CreativeDesignSkill",
    # Engineer
    "TechnicalAnalysisSkill",
    "SystemDesignSkill",
    # Scientist
    "ResearchAnalysisSkill",
    "DataInterpretationSkill",
    # Business
    "BusinessStrategySkill",
    "MarketAnalysisSkill",
]
