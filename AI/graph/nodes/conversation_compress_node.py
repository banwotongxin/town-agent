"""对话压缩节点

压缩对话历史
"""

from typing import Dict, Any


async def conversation_compress_node(state: Dict[str, Any]) -> Dict[str, Any]:
    """
    对话压缩节点 - 压缩对话历史
    
    Args:
        state: 当前状态
        
    Returns:
        压缩后的状态
    """
    from ...memory.dual_memory import MemoryManager
    
    messages = state.get("messages", [])
    conversation_summary = state.get("conversation_summary", "")
    
    # 获取记忆管理器
    memory_manager = MemoryManager()
    
    # 检查是否需要压缩
    if len(messages) >= 10:  # 5轮对话
        # 压缩对话
        new_summary = memory_manager.compress_conversation(
            existing_summary=conversation_summary,
            messages=messages
        )
        
        # 保留最近2轮对话
        recent_messages = messages[-4:]  # 2轮 = 4条消息
        
        return {
            "messages": recent_messages,
            "conversation_summary": new_summary
        }
    
    return state