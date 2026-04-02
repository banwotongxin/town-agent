"""
调试版本的Web服务器
"""

import sys
from flask import Flask, request, jsonify, render_template_string
from flask_cors import CORS
import asyncio

app = Flask(__name__)
CORS(app)

# 全局变量存储小镇实例
town_instance = None


@app.route('/')
def index():
    """返回前端页面"""
    print("[DEBUG] 访问首页")
    try:
        with open('index.html', 'r', encoding='utf-8') as f:
            content = f.read()
        print("[DEBUG] 成功读取index.html")
        return render_template_string(content)
    except Exception as e:
        print(f"[ERROR] 读取index.html失败: {e}")
        return f"Error: {e}", 500


@app.route('/api/agents', methods=['GET'])
def get_agents():
    """获取所有角色列表"""
    global town_instance
    print("[DEBUG] 获取角色列表")
    
    if town_instance is None:
        print("[ERROR] 小镇未初始化")
        return jsonify({'error': '小镇未初始化'}), 500
    
    agents = []
    for agent_id, agent in town_instance._agents.items():
        # 生成更分散的位置
        base_x = 20 + (hash(agent_id) % 7) * 15
        base_y = 20 + (hash(agent_id) * 3 % 7) * 15
        agents.append({
            'id': agent_id,
            'name': agent.profile.name,
            'age': agent.profile.age,
            'profession': agent.profile.profession.value,
            'personality': agent.profile.personality,
            'background': agent.profile.background,
            'hobbies': agent.profile.hobbies,
            'speech_style': agent.profile.speech_style,
            'appearance': agent.profile.appearance,
            'x': base_x,
            'y': base_y
        })
    
    print(f"[DEBUG] 成功返回{len(agents)}个角色")
    return jsonify(agents)


@app.route('/api/chat', methods=['POST'])
def chat():
    """与角色对话"""
    global town_instance
    print("[DEBUG] 收到对话请求")
    
    if town_instance is None:
        print("[ERROR] 小镇未初始化")
        return jsonify({'error': '小镇未初始化'}), 500
    
    data = request.get_json()
    user_input = data.get('user_input', '')
    target_agent_id = data.get('target_agent_id', '')
    conversation_history = data.get('conversation_history', [])
    
    print(f"[DEBUG] 对话请求: user_input={user_input}, target_agent_id={target_agent_id}")
    
    try:
        # 调用小镇的chat方法
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            print("[DEBUG] 开始调用town_instance.chat")
            result = loop.run_until_complete(town_instance.chat(
                user_input=user_input,
                target_agent_id=target_agent_id,
                conversation_history=conversation_history
            ))
            print("[DEBUG] chat调用成功")
        finally:
            loop.close()
        
        print(f"[DEBUG] 对话结果: response={result['response'][:50]}...")
        return jsonify({
            'response': result['response'],
            'agent_id': result['agent_id'],
            'agent_name': result['agent_name'],
            'conversation_history': result['conversation_history']
        })
    except Exception as e:
        import traceback
        print(f"[ERROR] 对话失败: {e}")
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


def initialize_town():
    """初始化小镇"""
    global town_instance
    print("[DEBUG] 开始初始化小镇")
    try:
        from graph.town_graph import create_default_town
        print("[DEBUG] 导入create_default_town成功")
        
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            print("[DEBUG] 开始调用create_default_town")
            town_instance = loop.run_until_complete(create_default_town(num_agents=4))
            print("[DEBUG] create_default_town调用成功")
        finally:
            loop.close()
        
        print(f"[DEBUG] 小镇初始化完成: {town_instance.town_name}, {len(town_instance._agents)} 个角色")
        return True
    except Exception as e:
        import traceback
        print(f"[ERROR] 初始化小镇失败: {e}")
        traceback.print_exc()
        return False


if __name__ == '__main__':
    print("[DEBUG] 启动赛博小镇 V2 Web 服务器...")
    
    # 初始化小镇
    if not initialize_town():
        print("[ERROR] 初始化失败，退出程序")
        sys.exit(1)
    
    print(f"[DEBUG] 赛博小镇 V2 服务器启动在 http://0.0.0.0:5000")
    print(f"[DEBUG] 前端页面: http://localhost:5000")
    
    try:
        app.run(host='0.0.0.0', port=5000, debug=False, use_reloader=False)
    except Exception as e:
        print(f"[ERROR] 服务器启动失败: {e}")
        import traceback
        traceback.print_exc()