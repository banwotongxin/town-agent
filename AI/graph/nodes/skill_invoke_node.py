"""技能调用节点

匹配和调用Skill
"""

from typing import Dict, Any


def skill_invoke_node(state: Dict[str, Any]) -> Dict[str, Any]:
    """
    技能调用节点 - 匹配和调用Skill
    
    Args:
        state: 当前状态
        
    Returns:
        更新后的状态
    """
    from ...skills.skill_system import SkillRegistry
    
    user_input = state.get("user_input", "")
    active_agent_id = state.get("active_agent_id")
    
    # 获取技能注册表
    skill_registry = SkillRegistry()
    
    # 匹配技能
    matched_skill = skill_registry.match_skill(
        agent_id=active_agent_id,
        user_input=user_input
    )
    
    if matched_skill:
        # 执行技能
        result = matched_skill.execute(user_input)
        
        return {
            "active_skill": matched_skill.name,
            "skill_result": result,
            "should_load_mcp": matched_skill.requires_mcp
        }
    
    return {
        "active_skill": None,
        "skill_result": None,
        "should_load_mcp": False
    }