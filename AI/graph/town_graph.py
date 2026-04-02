"""
LangGraph Integration - Town Orchestrator
小镇总编排图 - 管理多个智能体的协作
"""

from typing import TypedDict, List, Dict, Optional, Any
from langchain_core.messages import BaseMessage, HumanMessage, AIMessage
import asyncio

from AI.graph.agent_graph import AgentGraph, AgentState
from AI.agents.base_agent import BaseAgent
from AI.memory.dual_memory import DualMemorySystem, create_memory_system
from AI.skills.skill_system import SkillRegistry, get_skill_registry
from AI.emotion.emotion_engine import EmotionEngine, get_emotion_engine


class TownState(TypedDict):
    """
    小镇状态
    
    Attributes:
        user_input: 用户输入
        target_agent_id: 目标智能体 ID
        selected_agent_id: 实际选中的智能体 ID
        agent_response: 智能体回复
        should_continue: 是否继续
    """
    user_input: str
    target_agent_id: str
    selected_agent_id: str
    agent_response: str
    conversation_history: List[BaseMessage]
    should_continue: bool


class TownOrchestrator:
    """
    小镇编排器
    
    基于 LangGraph 构建的多智能体协作系统
    """
    
    def __init__(
        self,
        town_name: str = "赛博小镇",
    ):
        """
        初始化小镇编排器
        
        Args:
            town_name: 小镇名称
        """
        self.town_name = town_name
        
        # 智能体注册表
        self._agents: Dict[str, BaseAgent] = {}
        
        # 每个智能体的图和记忆系统
        self._agent_graphs: Dict[str, AgentGraph] = {}
        self._agent_memories: Dict[str, DualMemorySystem] = {}
        
        # 共享组件
        self._skill_registry: SkillRegistry = get_skill_registry()
        self._emotion_engine: EmotionEngine = get_emotion_engine()
        
        # 当前状态
        self.state: TownState = {
            "user_input": "",
            "target_agent_id": "",
            "selected_agent_id": "",
            "agent_response": "",
            "conversation_history": [],
            "should_continue": True,
        }
    
    def add_agent(
        self,
        agent: BaseAgent,
        memory_window: int = 5,
    ) -> None:
        """
        添加智能体到小镇
        
        Args:
            agent: 智能体实例
            memory_window: 记忆窗口大小
        """
        self._agents[agent.agent_id] = agent
        
        # 创建记忆系统
        memory = create_memory_system(
            agent_id=agent.agent_id,
            window_size=memory_window,
        )
        self._agent_memories[agent.agent_id] = memory
        
        # 注意：AgentGraph 需要 other_agent_id，这里先不创建
        # 在第一次对话时动态创建
    
    def remove_agent(self, agent_id: str) -> bool:
        """移除智能体"""
        if agent_id in self._agents:
            del self._agents[agent_id]
            
            if agent_id in self._agent_graphs:
                del self._agent_graphs[agent_id]
            
            if agent_id in self._agent_memories:
                del self._agent_memories[agent_id]
            
            return True
        return False
    
    def get_agent(self, agent_id: str) -> Optional[BaseAgent]:
        """获取智能体"""
        return self._agents.get(agent_id)
    
    def list_agents(self) -> List[Dict]:
        """列出所有智能体"""
        return [agent.get_status() for agent in self._agents.values()]
    
    def _get_or_create_agent_graph(
        self,
        agent_id: str,
        other_agent_id: str,
    ) -> Optional[AgentGraph]:
        """获取或创建智能体图"""
        # 如果已存在，直接返回
        if agent_id in self._agent_graphs:
            return self._agent_graphs[agent_id]
        
        # 检查智能体是否存在
        if agent_id not in self._agents:
            return None
        
        agent = self._agents[agent_id]
        memory = self._agent_memories[agent_id]
        
        # 创建图
        graph = AgentGraph(
            agent=agent,
            memory_system=memory,
            skill_registry=self._skill_registry,
            emotion_engine=self._emotion_engine,
            other_agent_id=other_agent_id,
        )
        
        self._agent_graphs[agent_id] = graph
        return graph
    
    async def dispatch_node(self, state: TownState) -> TownState:
        """
        分发节点 - 根据用户输入选择目标智能体
        
        简单实现：直接使用用户指定的 target_agent_id
        进阶实现：可以用 LLM 分析意图，自动选择合适的智能体
        """
        if not state["target_agent_id"]:
            # 如果没有指定，选择第一个智能体
            if self._agents:
                state["selected_agent_id"] = list(self._agents.keys())[0]
            else:
                state["selected_agent_id"] = ""
        else:
            state["selected_agent_id"] = state["target_agent_id"]
        
        return state
    
    async def route_to_agent_node(self, state: TownState) -> TownState:
        """路由到智能体节点 - 调用对应智能体的图"""
        agent_id = state["selected_agent_id"]
        
        if not agent_id:
            state["agent_response"] = "[系统] 小镇还没有居民..."
            return state
        
        # 获取或创建智能体图
        # 使用用户作为对话方
        graph = self._get_or_create_agent_graph(agent_id, "user")
        
        if not graph:
            state["agent_response"] = f"[系统] 找不到居民 {agent_id}"
            return state
        
        # 处理消息
        result = await graph.process_message(
            user_input=state["user_input"],
            conversation_history=state["conversation_history"],
        )
        
        state["agent_response"] = result["response"]
        
        # 更新对话历史
        state["conversation_history"].append(HumanMessage(content=state["user_input"]))
        state["conversation_history"].append(AIMessage(content=result["response"]))
        
        return state
    
    def should_continue(self, state: TownState) -> str:
        """判断是否继续对话"""
        if state["should_continue"]:
            return "continue"
        return "end"
    
    async def chat(
        self,
        user_input: str,
        target_agent_id: Optional[str] = None,
        conversation_history: Optional[List[BaseMessage]] = None,
    ) -> Dict:
        """
        与小镇居民聊天
        
        Args:
            user_input: 用户输入
            target_agent_id: 目标智能体 ID（可选）
            conversation_history: 对话历史
            
        Returns:
            包含回复和状态信息的字典
        """
        # 初始化状态
        self.state = {
            "user_input": user_input,
            "target_agent_id": target_agent_id or "",
            "selected_agent_id": "",
            "agent_response": "",
            "conversation_history": conversation_history or [],
            "should_continue": True,
        }
        
        state = self.state
        
        # 1. 分发到合适的智能体
        state = await self.dispatch_node(state)
        
        # 2. 路由到智能体进行处理
        state = await self.route_to_agent_node(state)
        
        self.state = state
        
        return {
            "response": state["agent_response"],
            "agent_id": state["selected_agent_id"],
            "agent_name": self._agents[state["selected_agent_id"]].profile.name if state["selected_agent_id"] else "",
            "conversation_history": state["conversation_history"],
        }
    
    async def multi_agent_chat(
        self,
        topic: str,
        participant_ids: List[str],
        max_rounds: int = 3,
    ) -> List[Dict]:
        """
        多智能体讨论模式
        
        Args:
            topic: 讨论话题
            participant_ids: 参与讨论的智能体 ID 列表
            max_rounds: 最大轮数
            
        Returns:
            对话记录列表
        """
        if len(participant_ids) < 2:
            return [{"error": "至少需要两个智能体"}]
        
        records = []
        current_topic = topic
        
        for round_num in range(max_rounds):
            for i, agent_id in enumerate(participant_ids):
                # 确定上一个发言者
                prev_agent_id = participant_ids[i - 1] if i > 0 else "user"
                
                # 获取智能体图
                graph = self._get_or_create_agent_graph(agent_id, prev_agent_id)
                
                if not graph:
                    continue
                
                # 处理
                result = await graph.process_message(
                    user_input=current_topic,
                    conversation_history=[],
                )
                
                records.append({
                    "round": round_num + 1,
                    "agent_id": agent_id,
                    "agent_name": self._agents[agent_id].profile.name,
                    "response": result["response"],
                })
                
                # 更新话题为上一个回复
                current_topic = result["response"]
        
        return records
    
    def get_town_status(self) -> Dict:
        """获取小镇状态"""
        return {
            "town_name": self.town_name,
            "agent_count": len(self._agents),
            "agents": self.list_agents(),
            "skill_count": len(self._skill_registry.get_all_skills()),
        }
    
    async def cleanup(self) -> None:
        """清理资源"""
        # 清理所有技能
        await self._skill_registry.cleanup_all()
        
        # 清理所有 MCP
        from mcp.lazy_loader import get_mcp_loader
        loader = get_mcp_loader()
        await loader.unload_all()


def create_town_orchestrator(
    town_name: str = "赛博小镇",
    agents: Optional[List[BaseAgent]] = None,
) -> TownOrchestrator:
    """
    工厂函数：创建小镇编排器
    
    Args:
        town_name: 小镇名称
        agents: 智能体列表
        
    Returns:
        TownOrchestrator 实例
    """
    orchestrator = TownOrchestrator(town_name=town_name)
    
    if agents:
        for agent in agents:
            orchestrator.add_agent(agent)
    
    return orchestrator


# 示例：创建默认小镇
async def create_default_town(num_agents: int = 4) -> TownOrchestrator:
    """
    创建默认小镇
    
    Args:
        num_agents: 智能体数量
        
    Returns:
        TownOrchestrator 实例
    """
    from AI.agents.models import DEFAULT_PROFILES, Profession
    from AI.agents.base_agent import BaseAgent
    
    orchestrator = TownOrchestrator(town_name="赛博小镇")
    
    # 获取LLM模型
    from config import get_llm
    llm = get_llm()
    
    # 添加默认智能体
    profiles = list(DEFAULT_PROFILES.values())[:num_agents]
    
    for i, profile in enumerate(profiles):
        agent = BaseAgent(
            agent_id=f"agent_{i}",
            profile=profile,
            llm_model=llm,
        )
        orchestrator.add_agent(agent)
    
    return orchestrator
