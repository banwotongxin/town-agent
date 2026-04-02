"""MCP加载节点

加载MCP依赖
"""

from typing import Dict, Any


def mcp_load_node(state: Dict[str, Any]) -> Dict[str, Any]:
    """
    MCP加载节点 - 加载MCP依赖
    
    Args:
        state: 当前状态
        
    Returns:
        包含加载结果的状态
    """
    from ...mcp.lazy_loader import MCPLazyLoader
    
    active_skill = state.get("active_skill")
    should_load_mcp = state.get("should_load_mcp", False)
    
    if should_load_mcp and active_skill:
        # 加载MCP
        mcp_loader = MCPLazyLoader()
        loaded_mcps = mcp_loader.load_mcp_for_skill(active_skill)
        
        return {
            "loaded_mcps": loaded_mcps,
            "mcp_loaded": True
        }
    
    return {
        "loaded_mcps": [],
        "mcp_loaded": False
    }