"""记忆管理器

管理双层记忆系统，提供统一的记忆操作接口
"""

from typing import List, Optional, Dict, Any
from langchain_core.messages import BaseMessage, HumanMessage, AIMessage
from .dual_memory import DualMemorySystem
from .conversation_compressor import ConversationCompressor


class MemoryManager:
    """
    记忆管理器
    
    管理智能体的记忆系统，包括短期记忆、长期记忆和对话压缩
    """
    
    def __init__(self):
        """
        初始化记忆管理器
        """
        self.memory_systems: Dict[str, DualMemorySystem] = {}
        self.compressor = ConversationCompressor()
    
    def get_memory_system(self, agent_id: str) -> DualMemorySystem:
        """
        获取智能体的记忆系统
        
        Args:
            agent_id: 智能体 ID
            
        Returns:
            记忆系统实例
        """
        if agent_id not in self.memory_systems:
            self.memory_systems[agent_id] = DualMemorySystem(agent_id=agent_id)
        return self.memory_systems[agent_id]
    
    def add_message(
        self,
        agent_id: str,
        message: BaseMessage,
        evaluate_importance: bool = True
    ) -> None:
        """
        添加消息到记忆系统
        
        Args:
            agent_id: 智能体 ID
            message: 消息对象
            evaluate_importance: 是否评估重要性
        """
        memory_system = self.get_memory_system(agent_id)
        memory_system.add_message(message, evaluate_importance)
    
    def get_context(
        self,
        agent_id: str,
        query: Optional[str] = None,
        include_long_term: bool = True
    ) -> str:
        """
        获取记忆上下文
        
        Args:
            agent_id: 智能体 ID
            query: 查询文本
            include_long_term: 是否包含长期记忆
            
        Returns:
            上下文文本
        """
        memory_system = self.get_memory_system(agent_id)
        return memory_system.get_context(query, include_long_term)
    
    def compress_conversation(
        self,
        agent_id: str,
        messages: List[BaseMessage],
        existing_summary: Optional[str] = None
    ) -> str:
        """
        压缩对话
        
        Args:
            agent_id: 智能体 ID
            messages: 对话消息列表
            existing_summary: 现有的摘要
            
        Returns:
            压缩后的摘要
        """
        return self.compressor.compress(messages, existing_summary)
    
    def recall(
        self,
        agent_id: str,
        query: str,
        n_results: int = 5
    ) -> List[Dict[str, Any]]:
        """
        回忆长期记忆
        
        Args:
            agent_id: 智能体 ID
            query: 查询文本
            n_results: 返回结果数量
            
        Returns:
            记忆列表
        """
        memory_system = self.get_memory_system(agent_id)
        memories = memory_system.long_term.search(query, top_k=n_results)
        
        return [
            {
                "content": mem.content,
                "importance": mem.importance,
                "metadata": mem.metadata
            }
            for mem in memories
        ]
    
    def save_important_event(
        self,
        agent_id: str,
        event_description: str,
        importance: float = 0.8
    ) -> str:
        """
        保存重要事件
        
        Args:
            agent_id: 智能体 ID
            event_description: 事件描述
            importance: 重要性评分
            
        Returns:
            记忆 ID
        """
        memory_system = self.get_memory_system(agent_id)
        return memory_system.save_important_event(event_description, importance)
    
    def get_memory_state(self, agent_id: str) -> Dict[str, Any]:
        """
        获取记忆状态
        
        Args:
            agent_id: 智能体 ID
            
        Returns:
            记忆状态
        """
        memory_system = self.get_memory_system(agent_id)
        return memory_system.get_state()
    
    def clear_memory(self, agent_id: str) -> None:
        """
        清空记忆
        
        Args:
            agent_id: 智能体 ID
        """
        memory_system = self.get_memory_system(agent_id)
        memory_system.clear()
    
    def get_all_agents(self) -> List[str]:
        """
        获取所有智能体 ID
        
        Returns:
            智能体 ID 列表
        """
        return list(self.memory_systems.keys())
