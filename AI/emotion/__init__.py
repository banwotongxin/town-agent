"""
Emotion Package
情感系统模块 - 五级情感关系引擎
"""

from .emotion_engine import (
    EmotionEngine,
    EmotionLevel,
    RelationshipState,
    EmotionCalculator,
    RelationshipStore,
    get_emotion_engine,
    create_emotion_engine,
)

__all__ = [
    "EmotionEngine",
    "EmotionLevel",
    "RelationshipState",
    "EmotionCalculator",
    "RelationshipStore",
    "get_emotion_engine",
    "create_emotion_engine",
]
