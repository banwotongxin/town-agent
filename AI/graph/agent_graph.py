"""
LangGraph Integration - Agent Graph
单智能体对话流程图
"""

from typing import TypedDict, List, Dict, Optional, Any
from langchain_core.messages import BaseMessage, HumanMessage, AIMessage
import asyncio

from AI.agents.base_agent import BaseAgent
from AI.memory.dual_memory import DualMemorySystem
from AI.skills.skill_system import SkillRegistry
from AI.emotion.emotion_engine import EmotionEngine, EmotionLevel


class AgentState(TypedDict):
    """
    智能体状态
    
    Attributes:
        messages: 消息列表
        user_input: 用户输入
        agent_response: 智能体回复
        memory_context: 记忆上下文
        emotion_context: 情感上下文
        matched_skills: 匹配的技能
        should_continue: 是否继续对话
    """
    messages: List[BaseMessage]
    user_input: str
    agent_response: str
    memory_context: str
    emotion_context: str
    matched_skills: List[str]
    should_continue: bool


class AgentGraph:
    """
    智能体对话图
    
    基于 LangGraph 构建单个智能体的对话流程
    """
    
    def __init__(
        self,
        agent: BaseAgent,
        memory_system: DualMemorySystem,
        skill_registry: SkillRegistry,
        emotion_engine: EmotionEngine,
        other_agent_id: str,
    ):
        """
        初始化智能体图
        
        Args:
            agent: 智能体实例
            memory_system: 记忆系统
            skill_registry: 技能注册中心
            emotion_engine: 情感引擎
            other_agent_id: 对话方 ID（用于情感关系）
        """
        self.agent = agent
        self.memory = memory_system
        self.skills = skill_registry
        self.emotion = emotion_engine
        self.other_agent_id = other_agent_id
        
        # 当前状态
        self.state: AgentState = {
            "messages": [],
            "user_input": "",
            "agent_response": "",
            "memory_context": "",
            "emotion_context": "",
            "matched_skills": [],
            "should_continue": True,
        }
    
    async def load_profile_node(self, state: AgentState) -> AgentState:
        """加载智能体档案节点"""
        # 这里可以加载额外的档案信息或配置
        return state
    
    async def check_compress_node(self, state: AgentState) -> AgentState:
        """检查是否需要压缩对话节点"""
        # 由记忆系统自动处理
        return state
    
    async def query_memory_node(self, state: AgentState) -> AgentState:
        """查询记忆节点"""
        # 从记忆中检索相关信息
        context = self.memory.get_context(query=state["user_input"])
        state["memory_context"] = context
        return state
    
    async def skill_match_node(self, state: AgentState) -> AgentState:
        """技能匹配节点"""
        matched = self.skills.find_matching_skills(state["user_input"])
        state["matched_skills"] = [skill.manifest.name for skill in matched]
        return state
    
    async def inject_emotion_context_node(self, state: AgentState) -> AgentState:
        """注入情感上下文节点"""
        # 获取与对话方的关系
        relationship = self.emotion.get_relationship_info(
            self.agent.agent_id,
            self.other_agent_id,
        )
        
        if relationship:
            level = EmotionLevel.from_score(relationship["emotion_score"])
            style_hint = self.emotion.get_conversation_style_hint(level)
            
            state["emotion_context"] = f"""
[与{self.other_agent_id}的关系]
等级：{relationship['level_name']}
分数：{relationship['emotion_score']:.1f}
互动次数：{relationship['interaction_count']}
{style_hint}
"""
        else:
            state["emotion_context"] = ""
        
        return state
    
    async def load_mcp_node(self, state: AgentState) -> AgentState:
        """懒加载 MCP 节点"""
        # 检查匹配的技能是否有 MCP 依赖
        # TODO: 实际实现时加载 MCP
        
        # 模拟：为每个匹配的技能加载 MCP
        for skill_name in state["matched_skills"]:
            skill = self.skills.get_skill(skill_name)
            if skill and skill.manifest.mcp_dependencies:
                # 加载 MCP 依赖
                pass
        
        return state
    
    async def invoke_llm_node(self, state: AgentState) -> AgentState:
        """调用 LLM 生成回复节点"""
        # 准备消息
        messages = state["messages"] + [HumanMessage(content=state["user_input"])]
        
        # 构建增强提示词
        system_prompt = self.agent.get_system_prompt()
        
        # 添加记忆上下文
        if state["memory_context"]:
            system_prompt += f"\n\n{state['memory_context']}"
        
        # 添加情感上下文
        if state["emotion_context"]:
            system_prompt += f"\n{state['emotion_context']}"
        
        # 添加技能增强
        for skill_name in state["matched_skills"]:
            skill = self.skills.get_skill(skill_name)
            if skill:
                system_prompt += skill.get_system_prompt()
        
        # 调用 LLM
        if self.agent.llm_model:
            from langchain_core.messages import SystemMessage
            
            full_messages = [SystemMessage(content=system_prompt)] + messages
            response = await self.agent.llm_model.ainvoke(full_messages)
            state["agent_response"] = response.content if hasattr(response, 'content') else str(response)
        else:
            state["agent_response"] = "[系统] 我还没有学会说话..."
        
        return state
    
    async def save_memory_node(self, state: AgentState) -> AgentState:
        """保存记忆节点"""
        # 保存用户消息
        self.memory.add_message(HumanMessage(content=state["user_input"]))
        
        # 保存 AI 回复
        if state["agent_response"]:
            self.memory.add_message(AIMessage(content=state["agent_response"]))
        
        return state
    
    async def evaluate_emotion_node(self, state: AgentState) -> AgentState:
        """评估情感变化节点"""
        # TODO: 使用 LLM 评估对话的情感倾向
        # 简单实现：假设都是正面互动
        
        result = self.emotion.interact(
            agent_a_id=self.agent.agent_id,
            agent_b_id=self.other_agent_id,
            interaction_type="conversation",
            sentiment="positive",  # TODO: 实际应该分析情感
        )
        
        # 如果等级提升，保存到长期记忆
        if result.get("level_changed"):
            event_desc = f"与{self.other_agent_id}的关系提升到{result['new_level']}"
            self.memory.save_important_event(event_desc, importance=0.9)
        
        return state
    
    def should_route(self, state: AgentState) -> str:
        """条件路由判断"""
        if state["should_continue"]:
            return "continue"
        return "end"
    
    async def process_message(
        self,
        user_input: str,
        conversation_history: Optional[List[BaseMessage]] = None,
    ) -> Dict:
        """
        处理用户消息的完整流程
        
        Args:
            user_input: 用户输入
            conversation_history: 对话历史
            
        Returns:
            包含回复和状态信息的字典
        """
        # 初始化状态
        self.state = {
            "messages": conversation_history or [],
            "user_input": user_input,
            "agent_response": "",
            "memory_context": "",
            "emotion_context": "",
            "matched_skills": [],
            "should_continue": True,
        }
        
        # 执行节点流程
        state = self.state
        
        # 1. 中间件前置检查
        from .nodes.middleware_nodes import middleware_pre_check_node
        state = await middleware_pre_check_node(state)
        
        # 2. 加载档案
        state = await self.load_profile_node(state)
        
        # 3. 查询记忆
        state = await self.query_memory_node(state)
        
        # 4. 匹配技能
        state = await self.skill_match_node(state)
        
        # 5. 中间件工具检查
        from .nodes.middleware_nodes import middleware_tool_check_node
        state = await middleware_tool_check_node(state)
        
        # 6. 注入情感上下文
        state = await self.inject_emotion_context_node(state)
        
        # 7. 加载 MCP（如果需要）
        state = await self.load_mcp_node(state)
        
        # 8. 调用 LLM
        state = await self.invoke_llm_node(state)
        
        # 9. 中间件后置检查
        from .nodes.middleware_nodes import middleware_post_check_node
        state = await middleware_post_check_node(state)
        
        # 10. 保存记忆
        state = await self.save_memory_node(state)
        
        # 11. 评估情感
        state = await self.evaluate_emotion_node(state)
        
        self.state = state
        
        # 返回结果
        return {
            "response": state["agent_response"],
            "matched_skills": state["matched_skills"],
            "memory_state": self.memory.get_state(),
        }
    
    def get_state(self) -> Dict:
        """获取当前状态"""
        return {
            "agent": self.agent.get_status(),
            "memory": self.memory.get_state(),
            "other_agent_id": self.other_agent_id,
        }


async def create_agent_graph(
    agent: BaseAgent,
    memory_system: DualMemorySystem,
    skill_registry: SkillRegistry,
    emotion_engine: EmotionEngine,
    other_agent_id: str,
) -> AgentGraph:
    """
    工厂函数：创建智能体图
    
    Args:
        agent: 智能体实例
        memory_system: 记忆系统
        skill_registry: 技能注册中心
        emotion_engine: 情感引擎
        other_agent_id: 对话方 ID
        
    Returns:
        AgentGraph 实例
    """
    return AgentGraph(
        agent=agent,
        memory_system=memory_system,
        skill_registry=skill_registry,
        emotion_engine=emotion_engine,
        other_agent_id=other_agent_id,
    )
