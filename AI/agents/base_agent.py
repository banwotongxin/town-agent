"""
Base Agent Module
智能体基类，提供通用功能和接口
"""

from typing import Dict, List, Optional, Any
from langchain_core.messages import BaseMessage, HumanMessage, AIMessage, SystemMessage
import uuid

from AI.agents.models import AgentProfile


class BaseAgent:
    """
    智能体基类
    
    所有职业 Agent 都继承自此类，提供基础的状态管理、记忆、技能等功能
    """
    
    def __init__(
        self,
        agent_id: str,
        profile: AgentProfile,
        llm_model: Optional[Any] = None,
    ):
        """
        初始化智能体
        
        Args:
            agent_id: 智能体唯一标识
            profile: 智能体档案
            llm_model: LLM 模型实例
        """
        self.agent_id = agent_id
        self.profile = profile
        self.llm_model = llm_model
        
        # 状态信息
        self.is_active = True
        self.current_location = "home"
        self.current_mood = "neutral"
        
        # 对话计数
        self.conversation_count = 0
        
    def get_system_prompt(self) -> str:
        """
        获取系统提示词
        
        Returns:
            根据智能体档案生成的系统提示词
        """
        prompt = f"""你叫{self.profile.name}，{self.profile.age}岁，职业是{self.profile.profession.value}。

性格特点：{self.profile.personality}
背景故事：{self.profile.background}
兴趣爱好：{', '.join(self.profile.hobbies)}
说话风格：{self.profile.speech_style}

请始终保持与你的角色设定一致，用符合你性格和职业的方式与人交流。"""
        
        if self.profile.appearance:
            prompt += f"\n外貌特征：{self.profile.appearance}"
            
        return prompt
    
    def format_messages(
        self,
        messages: List[BaseMessage],
        memory_context: Optional[str] = None,
        emotion_context: Optional[str] = None,
    ) -> List[BaseMessage]:
        """
        格式化消息列表，添加系统和上下文信息
        
        Args:
            messages: 原始消息列表
            memory_context: 记忆上下文（历史摘要）
            emotion_context: 情感上下文
            
        Returns:
            格式化后的消息列表
        """
        formatted = []
        
        # 1. 系统提示词
        system_prompt = self.get_system_prompt()
        
        # 2. 添加记忆上下文
        if memory_context:
            system_prompt += f"\n\n[历史对话摘要]\n{memory_context}"
        
        # 3. 添加情感上下文
        if emotion_context:
            system_prompt += f"\n\n[当前关系状态]\n{emotion_context}"
        
        formatted.append(SystemMessage(content=system_prompt))
        
        # 4. 添加原始消息
        formatted.extend(messages)
        
        return formatted
    
    async def respond(
        self,
        user_message: str,
        conversation_history: List[BaseMessage],
        **kwargs
    ) -> str:
        """
        生成回复（基础实现，子类应重写）
        
        Args:
            user_message: 用户消息
            conversation_history: 对话历史
            **kwargs: 其他参数（记忆、情感等）
            
        Returns:
            回复文本
        """
        # 基础实现：直接调用 LLM
        if not self.llm_model:
            return "[系统] 我还没有学会说话..."
        
        messages = self.format_messages(
            conversation_history + [HumanMessage(content=user_message)],
            memory_context=kwargs.get("memory_context"),
            emotion_context=kwargs.get("emotion_context"),
        )
        
        response = await self.llm_model.ainvoke(messages)
        self.conversation_count += 1
        
        return response.content if hasattr(response, 'content') else str(response)
    
    def get_status(self) -> Dict:
        """获取智能体当前状态"""
        return {
            "agent_id": self.agent_id,
            "name": self.profile.name,
            "profession": self.profile.profession.value,
            "is_active": self.is_active,
            "location": self.current_location,
            "mood": self.current_mood,
            "conversation_count": self.conversation_count,
        }
    
    def __repr__(self) -> str:
        return f"BaseAgent({self.profile.name}, {self.profile.profession.value})"


def create_base_agent(
    name: str,
    profession: str,
    agent_id: Optional[str] = None,
    **profile_kwargs
) -> BaseAgent:
    """
    工厂函数：创建基础智能体
    
    Args:
        name: 姓名
        profession: 职业
        agent_id: 智能体 ID（可选，自动生成）
        **profile_kwargs: 其他档案参数
        
    Returns:
        BaseAgent 实例
    """
    from .models import create_agent_profile
    
    profile = create_agent_profile(name=name, profession=profession, **profile_kwargs)
    agent_id = agent_id or f"agent_{uuid.uuid4().hex[:8]}"
    
    return BaseAgent(agent_id=agent_id, profile=profile)
