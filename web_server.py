"""
赛博小镇 V2 - Web 服务器
提供前端界面和API接口
"""

from flask import Flask, request, jsonify, render_template_string
from flask_cors import CORS
import asyncio
import os
from pathlib import Path

app = Flask(__name__)
CORS(app)

# 全局变量存储小镇实例
town_instance = None

# 获取当前文件所在目录
BASE_DIR = Path(__file__).parent
env_path = BASE_DIR / '.env'


def load_api_key():
    """从 .env 文件加载 API Key"""
    api_key = os.getenv("DEEPSEEK_API_KEY")
    if not api_key:
        # 从文件直接读取API Key作为备用方案
        try:
            with open(env_path, 'r', encoding='utf-8') as f:
                for line in f:
                    line = line.strip()
                    if line.startswith('DEEPSEEK_API_KEY='):
                        api_key = line.split('=', 1)[1]
                        break
        except Exception as e:
            print(f"[ERROR] 读取 .env 文件失败: {e}")
    return api_key


@app.route('/')
def index():
    """返回前端页面"""
    with open('frontend/index.html', 'r', encoding='utf-8') as f:
        return render_template_string(f.read())


@app.route('/api/agents', methods=['GET'])
def get_agents():
    """获取所有角色列表"""
    global town_instance
    
    if town_instance is None:
        return jsonify({'error': '小镇未初始化'}), 500
    
    agents = []
    for agent_id, agent in town_instance._agents.items():
        # 为不同职业分配不同的位置（对应不同的建筑物）
        profession = agent.profile.profession.value
        
        # 根据职业分配位置
        if profession == '作家':
            # 图书馆附近
            x, y = 20, 30
        elif profession == '医生':
            # 医院附近
            x, y = 70, 30
        elif profession == '程序员':
            # 科技园附近
            x, y = 80, 70
        elif profession == '教师':
            # 学校附近
            x, y = 30, 70
        elif profession == '艺术家':
            # 艺术馆附近
            x, y = 50, 20
        elif profession == '工程师':
            # 工厂附近
            x, y = 70, 80
        elif profession == '科学家':
            # 研究中心附近
            x, y = 20, 60
        elif profession == '商人':
            # 商业区附近
            x, y = 40, 40
        else:
            # 默认位置
            x, y = 50, 50
        
        agents.append({
            'id': agent_id,
            'name': agent.profile.name,
            'age': agent.profile.age,
            'profession': profession,
            'personality': agent.profile.personality,
            'background': agent.profile.background,
            'hobbies': agent.profile.hobbies,
            'speech_style': agent.profile.speech_style,
            'appearance': agent.profile.appearance,
            'x': x,
            'y': y
        })
    
    return jsonify(agents)


@app.route('/api/chat', methods=['POST'])
def chat():
    """与角色对话"""
    global town_instance
    
    if town_instance is None:
        return jsonify({'error': '小镇未初始化'}), 500
    
    data = request.get_json()
    user_input = data.get('user_input', '')
    target_agent_id = data.get('target_agent_id', '')
    conversation_history = data.get('conversation_history', [])
    
    try:
        # 调用小镇的chat方法
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            result = loop.run_until_complete(town_instance.chat(
                user_input=user_input,
                target_agent_id=target_agent_id,
                conversation_history=conversation_history
            ))
        finally:
            loop.close()
        
        return jsonify({
            'response': result['response'],
            'agent_id': result['agent_id'],
            'agent_name': result['agent_name'],
            'conversation_history': result['conversation_history']
        })
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


def initialize_town():
    """初始化小镇"""
    global town_instance
    from AI.graph.town_graph import create_default_town
    
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        # 创建8个角色，确保所有职业都有代表
        town_instance = loop.run_until_complete(create_default_town(num_agents=8))
    finally:
        loop.close()
    
    print(f"小镇初始化完成: {town_instance.town_name}, {len(town_instance._agents)} 个角色")


def check_env():
    """检查环境配置"""
    print("检查环境配置...")
    
    # 检查API Key
    api_key = load_api_key()
    if not api_key:
        print("警告: 未找到 DEEPSEEK_API_KEY")
        return False
    
    # 设置环境变量，确保后续代码能使用
    os.environ["DEEPSEEK_API_KEY"] = api_key
    print("环境配置检查完成")
    return True


if __name__ == '__main__':
    # 检查环境配置
    if not check_env():
        print("环境配置错误，退出程序")
        exit(1)
    
    # 初始化小镇
    print("初始化小镇...")
    try:
        initialize_town()
    except Exception as e:
        print(f"初始化小镇失败: {e}")
        import traceback
        traceback.print_exc()
        exit(1)
    
    print(f"赛博小镇 V2 服务器启动在 http://0.0.0.0:5000")
    print(f"前端页面: http://localhost:5000")
    
    app.run(host='0.0.0.0', port=5000, debug=False, use_reloader=False)
