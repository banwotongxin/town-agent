"""记忆检索节点

检索长期记忆
"""

from typing import Dict, Any


def memory_query_node(state: Dict[str, Any]) -> Dict[str, Any]:
    """
    记忆检索节点 - 检索长期记忆
    
    Args:
        state: 当前状态
        
    Returns:
        包含记忆检索结果的状态
    """
    from ...memory.dual_memory import MemoryManager
    
    user_input = state.get("user_input", "")
    active_agent_id = state.get("active_agent_id")
    
    # 获取记忆管理器
    memory_manager = MemoryManager()
    
    # 检索长期记忆
    retrieved_memories = memory_manager.recall(
        agent_id=active_agent_id,
        query=user_input,
        n_results=5
    )
    
    return {
        "retrieved_memories": retrieved_memories
    }