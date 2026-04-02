"""
Emotion Relationship System
五级情感关系系统
"""

from typing import Dict, Optional
from dataclasses import dataclass
from enum import Enum
import math


class EmotionLevel(Enum):
    """情感等级枚举"""
    STRANGER = 1      # 陌生人 (0-20)
    ACQUAINTANCE = 2  # 泛泛之交 (20-40)
    FRIEND = 3        # 朋友 (40-60)
    GOOD_FRIEND = 4   # 好友 (60-80)
    CLOSE_FRIEND = 5  # 挚友 (80-100)
    
    @classmethod
    def from_score(cls, score: float) -> "EmotionLevel":
        """从分数获取情感等级"""
        score = max(0, min(100, score))  # 限制在 0-100
        
        if score < 20:
            return cls.STRANGER
        elif score < 40:
            return cls.ACQUAINTANCE
        elif score < 60:
            return cls.FRIEND
        elif score < 80:
            return cls.GOOD_FRIEND
        else:
            return cls.CLOSE_FRIEND
    
    def get_range(self) -> tuple:
        """获取该等级的分数范围"""
        ranges = {
            EmotionLevel.STRANGER: (0, 20),
            EmotionLevel.ACQUAINTANCE: (20, 40),
            EmotionLevel.FRIEND: (40, 60),
            EmotionLevel.GOOD_FRIEND: (60, 80),
            EmotionLevel.CLOSE_FRIEND: (80, 100),
        }
        return ranges[self]
    
    def get_title(self) -> str:
        """获取等级中文名称"""
        titles = {
            EmotionLevel.STRANGER: "陌生人",
            EmotionLevel.ACQUAINTANCE: "泛泛之交",
            EmotionLevel.FRIEND: "朋友",
            EmotionLevel.GOOD_FRIEND: "好友",
            EmotionLevel.CLOSE_FRIEND: "挚友",
        }
        return titles[self]


@dataclass
class RelationshipState:
    """
    关系状态数据类
    
    Attributes:
        agent_a_id: 智能体 A ID
        agent_b_id: 智能体 B ID
        emotion_score: 情感分数 (0-100)
        level: 情感等级
        interaction_count: 互动次数
        last_interaction_time: 最后互动时间戳
        nickname: 专属昵称（高等级时）
    """
    agent_a_id: str
    agent_b_id: str
    emotion_score: float = 10.0  # 初始为陌生人
    level: EmotionLevel = EmotionLevel.STRANGER
    interaction_count: int = 0
    last_interaction_time: float = 0.0
    nickname: Optional[str] = None
    
    def update_level(self) -> bool:
        """
        更新情感等级
        
        Returns:
            等级是否发生变化
        """
        old_level = self.level
        self.level = EmotionLevel.from_score(self.emotion_score)
        return old_level != self.level
    
    def to_dict(self) -> Dict:
        """转换为字典"""
        return {
            "agent_a_id": self.agent_a_id,
            "agent_b_id": self.agent_b_id,
            "emotion_score": round(self.emotion_score, 2),
            "level": self.level.value,
            "level_name": self.level.get_title(),
            "interaction_count": self.interaction_count,
            "nickname": self.nickname,
        }


class EmotionCalculator:
    """
    情感计算器
    
    负责计算情感变化值，考虑多种因素
    """
    
    def __init__(
        self,
        base_increase: float = 3.0,     # 基础增加量
        base_decrease: float = 5.0,     # 基础减少量
        decay_rate: float = 0.5,        # 时间衰减率（每天）
        no_interaction_days: float = 7.0,  # 开始衰减的天数
    ):
        """
        初始化情感计算器
        
        Args:
            base_increase: 正面互动的基础情感增加量
            base_decrease: 负面互动的基础情感减少量
            decay_rate: 时间衰减率
            no_interaction_days: 多少天不互动后开始衰减
        """
        self.base_increase = base_increase
        self.base_decrease = base_decrease
        self.decay_rate = decay_rate
        self.no_interaction_days = no_interaction_days
    
    def calculate_delta(
        self,
        interaction_type: str,
        current_score: float,
        current_level: EmotionLevel,
        sentiment: str = "positive",
    ) -> float:
        """
        计算情感变化值
        
        Args:
            interaction_type: 互动类型（conversation, help, gift, conflict 等）
            current_score: 当前情感分数
            current_level: 当前情感等级
            sentiment: 情感倾向（positive, neutral, negative）
            
        Returns:
            情感变化值（可正可负）
        """
        # 基础变化量
        if sentiment == "positive":
            delta = self.base_increase
        elif sentiment == "negative":
            delta = -self.base_decrease
        else:
            delta = 0.5  # 中性互动少量增加
        
        # 互动类型系数
        type_multipliers = {
            "conversation": 1.0,
            "help": 1.5,       # 帮助行为增加更多
            "gift": 1.3,
            "conflict": -2.0,  # 冲突减少更多
            "praise": 1.2,
            "criticism": -1.5,
        }
        multiplier = type_multipliers.get(interaction_type, 1.0)
        delta *= multiplier
        
        # 边际递减效应：等级越高，提升越难
        if delta > 0:
            level_factor = 1.0 - (current_level.value - 1) * 0.15
            delta *= max(level_factor, 0.4)
        
        # 等级门槛：不能跨级提升
        level_min, level_max = current_level.get_range()
        if delta > 0:
            # 最多提升到当前等级上限
            max_delta = level_max - current_score
            delta = min(delta, max_delta * 0.8)  # 保留 20% 余量
        
        return round(delta, 2)
    
    def apply_time_decay(
        self,
        current_score: float,
        days_since_last_interaction: float,
    ) -> float:
        """
        应用时间衰减
        
        Args:
            current_score: 当前情感分数
            days_since_last_interaction: 距离上次互动的天数
            
        Returns:
            衰减后的分数
        """
        if days_since_last_interaction <= self.no_interaction_days:
            return current_score
        
        # 超过阈值天数后开始衰减
        decay_days = days_since_last_interaction - self.no_interaction_days
        decay_amount = decay_days * self.decay_rate
        
        new_score = current_score - decay_amount
        return max(new_score, 0)  # 不低于 0


class RelationshipStore:
    """
    关系存储器
    
    持久化存储关系状态（暂时使用内存存储，后续可替换为数据库）
    """
    
    def __init__(self):
        """初始化关系存储器"""
        # key: (agent_a_id, agent_b_id) 排序后的元组
        # value: RelationshipState
        self._relationships: Dict[tuple, RelationshipState] = {}
    
    def get_relationship(
        self,
        agent_a_id: str,
        agent_b_id: str,
    ) -> Optional[RelationshipState]:
        """获取两个智能体之间的关系"""
        key = self._make_key(agent_a_id, agent_b_id)
        return self._relationships.get(key)
    
    def set_relationship(
        self,
        agent_a_id: str,
        agent_b_id: str,
        state: RelationshipState,
    ) -> None:
        """设置关系状态"""
        key = self._make_key(agent_a_id, agent_b_id)
        self._relationships[key] = state
    
    def get_or_create(
        self,
        agent_a_id: str,
        agent_b_id: str,
        initial_score: float = 10.0,
    ) -> RelationshipState:
        """获取或创建关系"""
        key = self._make_key(agent_a_id, agent_b_id)
        
        if key not in self._relationships:
            # 创建新关系
            state = RelationshipState(
                agent_a_id=agent_a_id,
                agent_b_id=agent_b_id,
                emotion_score=initial_score,
            )
            self._relationships[key] = state
        
        return self._relationships[key]
    
    def _make_key(self, agent_a_id: str, agent_b_id: str) -> tuple:
        """创建唯一的键（排序确保双向一致）"""
        return tuple(sorted([agent_a_id, agent_b_id]))
    
    def get_all_relationships(self, agent_id: str) -> list:
        """获取某个智能体的所有关系"""
        results = []
        for key, state in self._relationships.items():
            if agent_id in key:
                results.append(state)
        return results


class EmotionEngine:
    """
    情感引擎
    
    整合计算器和存储器，提供完整的情感关系管理
    """
    
    def __init__(self):
        """初始化情感引擎"""
        self.calculator = EmotionCalculator()
        self.store = RelationshipStore()
    
    def interact(
        self,
        agent_a_id: str,
        agent_b_id: str,
        interaction_type: str = "conversation",
        sentiment: str = "positive",
    ) -> Dict:
        """
        处理一次互动
        
        Args:
            agent_a_id: 智能体 A ID
            agent_b_id: 智能体 B ID
            interaction_type: 互动类型
            sentiment: 情感倾向
            
        Returns:
            包含更新信息的字典
        """
        import time
        
        # 获取或创建关系
        relationship = self.store.get_or_create(agent_a_id, agent_b_id)
        
        # 计算情感变化
        delta = self.calculator.calculate_delta(
            interaction_type=interaction_type,
            current_score=relationship.emotion_score,
            current_level=relationship.level,
            sentiment=sentiment,
        )
        
        # 更新分数
        old_level = relationship.level
        relationship.emotion_score += delta
        relationship.emotion_score = max(0, min(100, relationship.emotion_score))  # 限制在 0-100
        relationship.interaction_count += 1
        relationship.last_interaction_time = time.time()
        
        # 检查等级变化
        level_changed = relationship.update_level()
        
        # 等级提升时可能触发特殊事件
        event_triggered = False
        if level_changed and delta > 0:
            event_triggered = True
            # TODO: 可以添加升级事件通知
        
        return {
            "old_score": round(relationship.emotion_score - delta, 2),
            "new_score": round(relationship.emotion_score, 2),
            "delta": delta,
            "old_level": old_level.get_title(),
            "new_level": relationship.level.get_title(),
            "level_changed": level_changed,
            "event_triggered": event_triggered,
        }
    
    def get_relationship_info(
        self,
        agent_a_id: str,
        agent_b_id: str,
    ) -> Optional[Dict]:
        """获取关系信息"""
        relationship = self.store.get_relationship(agent_a_id, agent_b_id)
        if relationship:
            return relationship.to_dict()
        return None
    
    def get_conversation_style_hint(self, level: EmotionLevel) -> str:
        """
        获取对应等级的对话风格提示词
        
        Args:
            level: 情感等级
            
        Returns:
            提示词文本
        """
        hints = {
            EmotionLevel.STRANGER: """
[对话风格：陌生人]
- 使用尊称（您、先生、女士）
- 语气礼貌但保持距离
- 话题相对浅表，避免涉及隐私
- 回复较为正式和简短""",
            
            EmotionLevel.ACQUAINTANCE: """
[对话风格：泛泛之交]
- 可以使用一般称呼（姓 + 职业/称呼）
- 语气友好但仍有一定距离
- 可以分享一些日常话题
- 开始展现一些个人特点""",
            
            EmotionLevel.FRIEND: """
[对话风格：朋友]
- 可以直接称呼名字
- 语气轻松自然
- 分享日常生活和感受
- 互相关心，提供帮助
- 可以开一些善意的玩笑""",
            
            EmotionLevel.GOOD_FRIEND: """
[对话风格：好友]
- 可以使用昵称或外号
- 语气亲密，不拘束
- 分享更深层次的想法和情感
- 主动关心对方的状况
- 开玩笑更加随意""",
            
            EmotionLevel.CLOSE_FRIEND: """
[对话风格：挚友]
- 使用专属昵称
- 完全信任和坦诚
- 无话不谈，分享最深的秘密
- 强烈的关心和保护欲
- 对话充满默契和理解""",
        }
        return hints.get(level, "")


# 全局情感引擎实例
_global_emotion_engine: Optional[EmotionEngine] = None


def get_emotion_engine() -> EmotionEngine:
    """获取全局情感引擎实例"""
    global _global_emotion_engine
    if _global_emotion_engine is None:
        _global_emotion_engine = EmotionEngine()
    return _global_emotion_engine


def create_emotion_engine() -> EmotionEngine:
    """创建新的情感引擎实例"""
    return EmotionEngine()
