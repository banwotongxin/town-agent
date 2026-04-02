"""
赛博小镇 V2 - Web 服务器 (Mock版本，用于测试前端)
提供前端界面和API接口
"""

from flask import Flask, request, jsonify, render_template_string
from flask_cors import CORS
import asyncio
import random

app = Flask(__name__)
CORS(app)

# 模拟的角色数据
MOCK_AGENTS = [
    {
        'id': 'agent_0',
        'name': '林墨',
        'age': 32,
        'profession': '作家',
        'personality': '内向、敏感、富有想象力',
        'background': '自由撰稿人，出版过三本小说，喜欢在咖啡馆里观察生活',
        'hobbies': ['阅读', '写作', '咖啡', '散步'],
        'speech_style': '文艺、喜欢用比喻',
        'appearance': '戴着眼镜，总是带着笔记本',
        'x': 20,
        'y': 30
    },
    {
        'id': 'agent_1',
        'name': '赵仁',
        'age': 45,
        'profession': '医生',
        'personality': '温和、耐心、责任感强',
        'background': '三甲医院主任医师，擅长内科，从医 20 年',
        'hobbies': ['医学研究', '健身', '品茶'],
        'speech_style': '专业但易懂、关心他人',
        'appearance': '穿着白大褂，带着听诊器',
        'x': 70,
        'y': 30
    },
    {
        'id': 'agent_2',
        'name': '王码',
        'age': 28,
        'profession': '程序员',
        'personality': '理性、逻辑性强、有点宅',
        'background': '互联网公司后端工程师，技术大牛，开源爱好者',
        'hobbies': ['编程', '游戏', '科技产品', '动漫'],
        'speech_style': '直接、喜欢用技术术语',
        'appearance': '穿着格子衫，背着双肩包',
        'x': 80,
        'y': 70
    },
    {
        'id': 'agent_3',
        'name': '李育',
        'age': 38,
        'profession': '教师',
        'personality': '热情、善于表达、有耐心',
        'background': '重点中学高级教师，教龄 15 年，深受学生喜爱',
        'hobbies': ['教学', '读书', '旅行', '音乐'],
        'speech_style': '循循善诱、鼓励式',
        'appearance': '戴着眼镜，总是带着教案',
        'x': 30,
        'y': 70
    },
    {
        'id': 'agent_4',
        'name': '陈艺',
        'age': 29,
        'profession': '艺术家',
        'personality': '自由、感性、富有创意',
        'background': '独立艺术家，擅长油画和雕塑，作品在多个展览中展出',
        'hobbies': ['绘画', '雕塑', '音乐', '旅行'],
        'speech_style': '富有诗意、感性',
        'appearance': '穿着时尚，手上常有颜料',
        'x': 50,
        'y': 20
    },
    {
        'id': 'agent_5',
        'name': '张工',
        'age': 35,
        'profession': '工程师',
        'personality': '严谨、务实、动手能力强',
        'background': '机械工程师，专注于新能源技术研发，拥有多项专利',
        'hobbies': ['发明创造', '户外探险', '模型制作'],
        'speech_style': '专业、条理清晰',
        'appearance': '穿着工装，带着工具',
        'x': 70,
        'y': 80
    },
    {
        'id': 'agent_6',
        'name': '刘研',
        'age': 42,
        'profession': '科学家',
        'personality': '好奇、理性、执着',
        'background': '生物学家，研究基因工程，发表过多篇重要学术论文',
        'hobbies': ['实验研究', '阅读科学文献', '科普写作'],
        'speech_style': '严谨、逻辑性强',
        'appearance': '穿着实验服，带着护目镜',
        'x': 20,
        'y': 60
    },
    {
        'id': 'agent_7',
        'name': '钱商',
        'age': 40,
        'profession': '商人',
        'personality': '自信、果断、善于沟通',
        'background': '成功企业家，创办了一家科技公司，善于发现商业机会',
        'hobbies': ['商业分析', '投资', '社交', '高尔夫'],
        'speech_style': '自信、务实、有说服力',
        'appearance': '穿着西装，带着公文包',
        'x': 40,
        'y': 40
    }
]

# 模拟回复
MOCK_RESPONSES = {
    '作家': ['文学是生活的镜子，每一个故事都映射着人性的光辉。', '我喜欢在咖啡馆里观察人们，每个人都有自己的故事。', '写作让我能够表达内心深处的情感。', '文字有着无穷的力量，可以治愈人心。'],
    '医生': ['健康是最重要的财富，要注意身体。', '从医二十年，我见过太多生离死别。', '预防胜于治疗，定期体检很重要。', '医学是一门艺术，需要耐心和爱心。'],
    '程序员': ['代码就像诗歌，优雅而精确。', 'Bug是程序员的日常，解决它们很有成就感。', '技术改变世界，我们正在创造未来。', '开源精神让知识自由流动。'],
    '教师': ['教育是一棵树摇动另一棵树。', '每个学生都是独特的，需要因材施教。', '知识改变命运，教育成就未来。', '看到学生成长是最幸福的事。'],
    '艺术家': ['艺术是心灵的表达，没有对错之分。', '色彩有着神奇的力量，可以传达情感。', '创作是一种冥想，让我找到内心的平静。', '美无处不在，关键是要有发现的眼睛。'],
    '工程师': ['工程是科学与实践的完美结合。', '每一个细节都很重要，差之毫厘谬以千里。', '创新需要勇气和坚持。', '解决问题是工程师的使命。'],
    '科学家': ['科学是探索未知的旅程。', '每一个实验都是对真理的追寻。', '数据不会说谎，但解读需要智慧。', '好奇心是科学进步的源泉。'],
    '商人': ['商机无处不在，关键是要有敏锐的洞察力。', '诚信是商业的基石。', '风险与机遇并存，需要谨慎决策。', '成功的企业家要有远见和执行力。']
}


@app.route('/')
def index():
    """返回前端页面"""
    with open('frontend/index.html', 'r', encoding='utf-8') as f:
        return render_template_string(f.read())


@app.route('/api/agents', methods=['GET'])
def get_agents():
    """获取所有角色列表"""
    return jsonify(MOCK_AGENTS)


@app.route('/api/chat', methods=['POST'])
def chat():
    """与角色对话"""
    data = request.get_json()
    user_input = data.get('user_input', '')
    target_agent_id = data.get('target_agent_id', '')
    conversation_history = data.get('conversation_history', [])
    
    # 找到对应的角色
    agent = None
    for a in MOCK_AGENTS:
        if a['id'] == target_agent_id:
            agent = a
            break
    
    if not agent:
        return jsonify({'error': '角色不存在'}), 404
    
    # 模拟思考延迟
    import time
    time.sleep(0.5)
    
    # 生成回复
    profession = agent['profession']
    responses = MOCK_RESPONSES.get(profession, ['这是一个有趣的对话。'])
    
    # 根据用户输入选择回复（简单逻辑）
    if '你好' in user_input or 'hello' in user_input.lower():
        response = f"你好！我是{agent['name']}，{agent['background'][:20]}..."
    elif '?' in user_input or '？' in user_input or '吗' in user_input:
        response = f"这是个好问题。{random.choice(responses)}"
    else:
        response = random.choice(responses)
    
    # 更新对话历史
    conversation_history.append({'role': 'user', 'content': user_input})
    conversation_history.append({'role': 'assistant', 'content': response})
    
    return jsonify({
        'response': response,
        'agent_id': agent['id'],
        'agent_name': agent['name'],
        'conversation_history': conversation_history
    })


if __name__ == '__main__':
    PORT = 5001
    print(f"赛博小镇 V2 Mock服务器启动在 http://0.0.0.0:{PORT}")
    print(f"前端页面: http://localhost:{PORT}")
    print(f"注意：这是Mock版本，用于测试前端界面")
    
    app.run(host='0.0.0.0', port=PORT, debug=False, use_reloader=False)
