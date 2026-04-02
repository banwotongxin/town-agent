"""中间件节点集合

中间件相关的LangGraph节点
"""

from typing import Dict, Any
from AI.middleware.base import MiddlewarePhase, MiddlewareContext


async def middleware_pre_check_node(state: Dict[str, Any]) -> Dict[str, Any]:
    """
    中间件前置检查节点
    - 修复悬空工具调用
    - 安全策略检查
    """
    from AI.middleware.factory import create_default_middleware_manager
    
    # 创建中间件管理器
    middleware_manager = create_default_middleware_manager()
    
    # 创建中间件上下文
    context = MiddlewareContext(
        agent_id=state.get("active_agent_id", "unknown"),
        agent_name=state.get("agent_name", "Unknown"),
        phase=MiddlewarePhase.BEFORE_THINK,
        current_state="thinking",
        current_location="home"
    )
    
    # 执行中间件处理
    result = middleware_manager.process(context, None)
    
    # 处理结果
    if not result.should_continue:
        state["agent_response"] = result.message or "请求被中间件拦截"
    
    return state


async def middleware_tool_check_node(state: Dict[str, Any]) -> Dict[str, Any]:
    """
    中间件工具检查节点
    - 子代理限制
    - 异常处理
    """
    from AI.middleware.factory import create_default_middleware_manager
    
    # 创建中间件管理器
    middleware_manager = create_default_middleware_manager()
    
    # 创建中间件上下文
    context = MiddlewareContext(
        agent_id=state.get("active_agent_id", "unknown"),
        agent_name=state.get("agent_name", "Unknown"),
        phase=MiddlewarePhase.BEFORE_ACTION,
        current_state="acting",
        current_location="home"
    )
    
    # 执行中间件处理
    result = middleware_manager.process(context, None)
    
    # 处理结果
    if not result.should_continue:
        state["agent_response"] = result.message or "操作被中间件拦截"
    
    return state


async def middleware_post_check_node(state: Dict[str, Any]) -> Dict[str, Any]:
    """
    中间件后置检查节点
    - 检测循环
    - 澄清拦截
    """
    from AI.middleware.factory import create_default_middleware_manager
    
    # 创建中间件管理器
    middleware_manager = create_default_middleware_manager()
    
    # 创建中间件上下文
    context = MiddlewareContext(
        agent_id=state.get("active_agent_id", "unknown"),
        agent_name=state.get("agent_name", "Unknown"),
        phase=MiddlewarePhase.AFTER_ACTION,
        current_state="done",
        current_location="home"
    )
    
    # 执行中间件处理
    result = middleware_manager.process(context, None)
    
    # 处理结果
    if not result.should_continue:
        state["agent_response"] = result.message or "操作被中间件拦截"
    
    return state