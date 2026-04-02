"""Agent 分发节点

根据用户输入决定路由到哪个 Agent
"""

from typing import Optional, Dict, Any
from langgraph.graph import END


def dispatch_node(state: Dict[str, Any]) -> Dict[str, Any]:
    """
    分发节点 - 根据用户输入决定路由
    
    Args:
        state: 当前状态
        
    Returns:
        包含目标Agent ID的状态
    """
    user_input = state.get("user_input", "")
    
    # 简单的分发逻辑
    # 实际项目中可以根据关键词、意图识别等更复杂的逻辑
    target_agent_id = state.get("target_agent_id")
    
    if not target_agent_id:
        # 默认分发逻辑
        if "代码" in user_input or "编程" in user_input:
            target_agent_id = "coder"
        elif "健康" in user_input or "医疗" in user_input:
            target_agent_id = "doctor"
        elif "写作" in user_input or "故事" in user_input:
            target_agent_id = "writer"
        elif "学习" in user_input or "教育" in user_input:
            target_agent_id = "teacher"
        else:
            target_agent_id = "writer"  # 默认Agent
    
    return {
        "target_agent_id": target_agent_id,
        "active_agent_id": target_agent_id
    }


def should_route_node(state: Dict[str, Any]) -> str:
    """
    路由判断节点 - 决定是否需要切换Agent
    
    Args:
        state: 当前状态
        
    Returns:
        下一个节点的名称
    """
    # 简单的判断逻辑
    # 实际项目中可以根据对话内容、用户意图等判断
    should_switch = state.get("should_switch_agent", False)
    
    if should_switch:
        return "dispatch"
    else:
        return END