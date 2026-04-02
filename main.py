"""
Cyber Town V2 - Main Entry Point
赛博小镇 V2 主程序入口
"""

import asyncio
import sys
from typing import Optional


async def demo():
    """演示模式"""
    print("=" * 60)
    print("赛博小镇 V2 - 演示")
    print("=" * 60)
    
    # 创建默认小镇
    from AI.graph.town_graph import create_default_town
    
    print("\n正在创建小镇...")
    town = await create_default_town(num_agents=4)
    
    print(f"小镇名称：{town.town_name}")
    print(f"居民数量：{len(town._agents)}")
    print("\n居民列表:")
    for agent_info in town.list_agents():
        print(f"  - {agent_info['name']} ({agent_info['profession']})")
    
    print("\n" + "=" * 60)
    print("开始对话演示")
    print("=" * 60)
    
    # 对话示例
    test_conversations = [
        ("agent_0", "你好，最近怎么样？"),
        ("agent_1", "我最近有点不舒服，能给我一些建议吗？"),
        ("agent_2", "帮我看看这段代码有什么问题"),
        ("agent_3", "我想学习 Python，有什么建议吗？"),
    ]
    
    for agent_id, user_input in test_conversations:
        print(f"\n--- 与 {town.get_agent(agent_id).profile.name} 对话 ---")
        print(f"用户：{user_input}")
        
        result = await town.chat(
            user_input=user_input,
            target_agent_id=agent_id,
        )
        
        print(f"{result['agent_name']}: {result['response']}")
        
        # 使用相同的对话历史继续对话
        conversation_history = result["conversation_history"]
        
        # 第二轮对话
        follow_up = "谢谢你的建议！"
        print(f"\n用户：{follow_up}")
        
        result = await town.chat(
            user_input=follow_up,
            target_agent_id=agent_id,
            conversation_history=conversation_history,
        )
        
        print(f"{result['agent_name']}: {result['response']}")
    
    print("\n" + "=" * 60)
    print("演示完成！")
    print("=" * 60)
    
    # 显示最终状态
    print("\n小镇状态:")
    status = town.get_town_status()
    print(f"  小镇名称：{status['town_name']}")
    print(f"  居民数量：{status['agent_count']}")
    
    # 清理资源
    await town.cleanup()


def run_demo():
    """运行演示"""
    asyncio.run(demo())


if __name__ == "__main__":
    # 处理命令行参数
    if len(sys.argv) > 1:
        mode = sys.argv[1]
        if mode == "--mode":
            if len(sys.argv) > 2:
                mode = sys.argv[2]
                print(f"运行模式: {mode}")
    run_demo()
