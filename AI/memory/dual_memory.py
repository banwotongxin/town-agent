"""
Dual Memory System
双层记忆系统：短期记忆（滑动窗口）+ 长期记忆（向量数据库）
"""

from typing import List, Dict, Optional, Any
from dataclasses import dataclass, field
from langchain_core.messages import BaseMessage, HumanMessage, AIMessage, SystemMessage
import uuid
import json


@dataclass
class MemoryItem:
    """记忆项"""
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    content: str = ""
    importance: float = 0.5  # 重要性评分 0-1
    timestamp: float = 0.0
    metadata: Dict = field(default_factory=dict)
    
    def to_dict(self) -> Dict:
        return {
            "id": self.id,
            "content": self.content,
            "importance": self.importance,
            "timestamp": self.timestamp,
            "metadata": self.metadata,
        }


class ShortTermMemory:
    """
    短期记忆 - 基于滑动窗口
    
    保留最近 N 轮对话，超出时自动压缩
    """
    
    def __init__(self, window_size: int = 5):
        """
        初始化短期记忆
        
        Args:
            window_size: 滑动窗口大小（保留的对话轮数）
        """
        self.window_size = window_size
        self.messages: List[BaseMessage] = []
        self.summary: str = ""  # 历史对话摘要
        self.conversation_rounds: int = 0
        
    def add_message(self, message: BaseMessage) -> None:
        """添加消息"""
        self.messages.append(message)
        
        if isinstance(message, HumanMessage):
            self.conversation_rounds += 1
            
    def get_messages(self) -> List[BaseMessage]:
        """获取当前窗口内的消息"""
        # 如果消息数量超过窗口大小，需要压缩
        if len(self.messages) > self.window_size * 2:  # 每轮 2 条消息
            # 保留最近的窗口大小
            overflow = self.messages[:len(self.messages) - self.window_size * 2]
            self._compress(overflow)
            
        return self.messages
    
    def _compress(self, messages_to_compress: List[BaseMessage]) -> None:
        """
        压缩消息为摘要
        
        Args:
            messages_to_compress: 需要压缩的消息列表
        """
        # TODO: 实际实现中应该调用 LLM 进行压缩
        # 这里先简单拼接
        compressed_text = "\n".join([
            f"{type(m).__name__}: {m.content}" 
            for m in messages_to_compress
        ])
        
        if self.summary:
            self.summary += f"\n[旧对话]\n{compressed_text}"
        else:
            self.summary = f"[历史对话摘要]\n{compressed_text}"
        
        # 移除已压缩的消息
        self.messages = self.messages[len(messages_to_compress):]
    
    def get_context(self) -> str:
        """获取完整的上下文（摘要 + 原始消息）"""
        context_parts = []
        
        if self.summary:
            context_parts.append(self.summary)
        
        for msg in self.messages:
            if isinstance(msg, HumanMessage):
                context_parts.append(f"用户：{msg.content}")
            elif isinstance(msg, AIMessage):
                context_parts.append(f"助手：{msg.content}")
            elif isinstance(msg, SystemMessage):
                context_parts.append(f"系统：{msg.content}")
        
        return "\n".join(context_parts)
    
    def clear(self) -> None:
        """清空短期记忆"""
        self.messages.clear()
        self.summary = ""
        self.conversation_rounds = 0
    
    def get_state(self) -> Dict:
        """获取状态"""
        return {
            "window_size": self.window_size,
            "message_count": len(self.messages),
            "conversation_rounds": self.conversation_rounds,
            "has_summary": bool(self.summary),
        }


class LongTermMemory:
    """
    长期记忆 - 基于向量数据库
    
    使用 ChromaDB/FAISS 存储重要对话和信息，支持语义检索
    """
    
    def __init__(
        self,
        storage_path: str = "./memory_storage",
        collection_name: str = "long_term_memory",
        use_mock: bool = True,  # 暂时使用模拟实现
    ):
        """
        初始化长期记忆
        
        Args:
            storage_path: 存储路径
            collection_name: 集合名称
            use_mock: 是否使用模拟实现（后续替换为真实的 ChromaDB）
        """
        self.storage_path = storage_path
        self.collection_name = collection_name
        self.use_mock = use_mock
        
        # 模拟存储
        self._mock_store: List[MemoryItem] = []
        
        # TODO: 真实实现时初始化 ChromaDB
        # self.client = chromadb.PersistentClient(path=storage_path)
        # self.collection = self.client.get_or_create_collection(name=collection_name)
    
    def add_memory(
        self,
        content: str,
        importance: float = 0.5,
        metadata: Optional[Dict] = None,
    ) -> str:
        """
        添加长期记忆
        
        Args:
            content: 记忆内容
            importance: 重要性评分 (0-1)
            metadata: 元数据
            
        Returns:
            记忆 ID
        """
        memory = MemoryItem(
            content=content,
            importance=importance,
            metadata=metadata or {},
        )
        
        if self.use_mock:
            self._mock_store.append(memory)
        else:
            # TODO: 真实实现：存入 ChromaDB
            pass
        
        return memory.id
    
    def search(
        self,
        query: str,
        top_k: int = 3,
        min_importance: float = 0.0,
    ) -> List[MemoryItem]:
        """
        检索记忆
        
        Args:
            query: 查询文本
            top_k: 返回数量
            min_importance: 最小重要性阈值
            
        Returns:
            相关记忆列表
        """
        if self.use_mock:
            # 模拟实现：简单关键词匹配
            results = []
            for memory in self._mock_store:
                if memory.importance >= min_importance:
                    if query.lower() in memory.content.lower():
                        results.append(memory)
            
            # 按重要性排序
            results.sort(key=lambda x: x.importance, reverse=True)
            return results[:top_k]
        else:
            # TODO: 真实实现：使用 ChromaDB 语义检索
            return []
    
    def get_all_memories(self) -> List[MemoryItem]:
        """获取所有记忆"""
        if self.use_mock:
            return self._mock_store.copy()
        return []
    
    def count(self) -> int:
        """获取记忆数量"""
        if self.use_mock:
            return len(self._mock_store)
        return 0
    
    def clear(self) -> None:
        """清空长期记忆"""
        if self.use_mock:
            self._mock_store.clear()


class DualMemorySystem:
    """
    双层记忆系统
    
    整合短期和长期记忆，提供统一的接口
    """
    
    def __init__(
        self,
        agent_id: str,
        short_term_window: int = 5,
        long_term_storage_path: str = "./memory_storage",
    ):
        """
        初始化双层记忆系统
        
        Args:
            agent_id: 智能体 ID
            short_term_window: 短期记忆窗口大小
            long_term_storage_path: 长期记忆存储路径
        """
        self.agent_id = agent_id
        self.short_term = ShortTermMemory(window_size=short_term_window)
        self.long_term = LongTermMemory(storage_path=long_term_storage_path)
        
        # 重要性阈值（高于此值才写入长期记忆）
        self.importance_threshold = 0.6
    
    def add_message(
        self,
        message: BaseMessage,
        evaluate_importance: bool = True,
    ) -> None:
        """
        添加消息到记忆系统
        
        Args:
            message: 消息对象
            evaluate_importance: 是否评估重要性
        """
        # 添加到短期记忆
        self.short_term.add_message(message)
        
        # 评估是否重要到需要存入长期记忆
        if evaluate_importance and isinstance(message, (HumanMessage, AIMessage)):
            importance = self._evaluate_importance(message.content)
            
            if importance >= self.importance_threshold:
                self.long_term.add_memory(
                    content=message.content,
                    importance=importance,
                    metadata={
                        "type": type(message).__name__,
                        "agent_id": self.agent_id,
                    }
                )
    
    def _evaluate_importance(self, content: str) -> float:
        """
        评估内容的重要性
        
        Args:
            content: 内容文本
            
        Returns:
            重要性评分 (0-1)
        """
        # TODO: 实际应该用 LLM 评估
        # 简单规则：包含特定关键词的更重要
        important_keywords = ["重要", "记住", "关键", "决定", "承诺", "秘密"]
        
        score = 0.3  # 基础分
        for keyword in important_keywords:
            if keyword in content:
                score += 0.15
        
        return min(score, 1.0)
    
    def get_context(
        self,
        query: Optional[str] = None,
        include_long_term: bool = True,
    ) -> str:
        """
        获取完整的记忆上下文
        
        Args:
            query: 查询文本（用于检索长期记忆）
            include_long_term: 是否包含长期记忆
            
        Returns:
            格式化的上下文文本
        """
        context_parts = []
        
        # 1. 短期记忆（总是包含）
        short_term_context = self.short_term.get_context()
        if short_term_context:
            context_parts.append(short_term_context)
        
        # 2. 长期记忆（根据查询检索）
        if include_long_term and query:
            relevant_memories = self.long_term.search(query, top_k=3)
            
            if relevant_memories:
                memories_text = "\n".join([
                    f"- {mem.content} (重要性：{mem.importance:.2f})"
                    for mem in relevant_memories
                ])
                context_parts.append(f"\n[相关长期记忆]\n{memories_text}")
        
        return "\n\n".join(context_parts)
    
    def save_important_event(
        self,
        event_description: str,
        importance: float = 0.8,
    ) -> str:
        """
        保存重要事件到长期记忆
        
        Args:
            event_description: 事件描述
            importance: 重要性评分
            
        Returns:
            记忆 ID
        """
        return self.long_term.add_memory(
            content=event_description,
            importance=importance,
            metadata={"type": "event"}
        )
    
    def get_state(self) -> Dict:
        """获取记忆系统状态"""
        return {
            "agent_id": self.agent_id,
            "short_term": self.short_term.get_state(),
            "long_term_count": self.long_term.count(),
            "importance_threshold": self.importance_threshold,
        }
    
    def clear(self) -> None:
        """清空所有记忆"""
        self.short_term.clear()
        self.long_term.clear()


def create_memory_system(
    agent_id: str,
    window_size: int = 5,
    **kwargs
) -> DualMemorySystem:
    """
    工厂函数：创建使用内存 Mock 的记忆系统（开发/测试用）

    Args:
        agent_id: 智能体 ID
        window_size: 短期记忆窗口大小
        **kwargs: 其他参数

    Returns:
        DualMemorySystem 实例
    """
    return DualMemorySystem(
        agent_id=agent_id,
        short_term_window=window_size,
        **kwargs
    )


def create_pg_memory_system(
    agent_id: str,
    window_size: int = 5,
    collection_name: str = "default",
) -> DualMemorySystem:
    """
    工厂函数：创建使用 PostgreSQL 长期记忆的记忆系统（生产用）

    长期记忆使用 PGLongTermMemory 替代内存 Mock。
    需要在使用前调用 await system.long_term.initialize() 初始化连接池。

    Args:
        agent_id: 智能体 ID
        window_size: 短期记忆窗口大小
        collection_name: PG 记忆集合名称

    Returns:
        DualMemorySystem 实例（长期记忆为 PGLongTermMemory）
    """
    from .pg_long_term_memory import PGLongTermMemory

    system = DualMemorySystem(
        agent_id=agent_id,
        short_term_window=window_size,
    )
    # 替换长期记忆后端为 PostgreSQL
    system.long_term = PGLongTermMemory(
        agent_id=agent_id,
        collection_name=collection_name,
    )
    return system
