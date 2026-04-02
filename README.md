# 赛博小镇 V2 (Cyber Town V2)

一个基于LangGraph和DeepSeek API的智能体交互系统，模拟赛博小镇中的角色对话。

## 项目结构

```
cyber_town/
├── AI/                    # AI相关代码
│   ├── agents/            # 角色定义
│   ├── emotion/           # 情感引擎
│   ├── graph/             # 图谱系统
│   ├── memory/            # 记忆系统
│   ├── middleware/        # 中间件
│   ├── skills/            # 技能系统
│   └── mcp/              # 模型控制协议
├── frontend/             # 前端代码
│   └── index.html        # 主页面
├── web_server.py         # 正式服务器
├── simple_server.py      # 简单服务器
├── config.py            # 配置文件
├── requirements.txt     # 依赖文件
└── .env               # 环境变量
```

## 安装依赖

```bash
pip install -r requirements.txt
```

## 配置环境变量

在 `.env` 文件中配置DeepSeek API密钥：

```
DEEPSEEK_API_KEY=your_api_key_here
LLM_BASE_URL=https://api.deepseek.com
LLM_MODEL=deepseek-chat
LLM_TEMPERATURE=0.7
LLM_MAX_TOKENS=4096
```

## 运行服务器

### 方法1：使用正式服务器（包含AI功能）

```bash
python web_server.py
```

- 访问：http://localhost:8888
- 特点：包含完整的AI功能，使用DeepSeek API生成回复

### 方法2：使用简单服务器（模拟回复）

```bash
python simple_server.py
```

- 访问：http://localhost:3000/frontend/index.html
- 特点：使用预设的回复，不需要API密钥

### 方法3：直接打开前端文件

直接在浏览器中打开 `frontend/index.html` 文件。

- 特点：需要手动配置API地址

## 功能说明

1. **角色移动**：使用方向键或WASD移动角色
2. **角色交互**：靠近角色时会自动显示角色信息
3. **对话功能**：在聊天框中输入消息与角色对话
4. **角色信息**：显示8个不同职业的角色（作家、医生、程序员、教师、艺术家、工程师、科学家、商人）

## 角色位置分配

- 作家：图书馆附近
- 医生：医院附近
- 程序员：科技园附近
- 教师：学校附近
- 艺术家：艺术馆附近
- 工程师：工厂附近
- 科学家：研究中心附近
- 商人：商业区附近

## 故障排除

### 端口占用问题

如果遇到端口占用错误：

1. 修改服务器文件中的端口号
2. 使用不同的端口号（如8888、3000等）
3. 使用简单服务器作为替代方案

### API Key问题

确保 `.env` 文件中正确配置了 `DEEPSEEK_API_KEY`。

### 网络请求失败

如果前端显示"网络请求失败"：

1. 确保服务器正在运行
2. 检查浏览器控制台是否有错误信息
3. 尝试刷新页面
4. 确保网络连接正常

### 沙箱环境限制

在沙箱环境中，可能无法正常启动服务器。请在正常的开发环境中运行项目。

## 技术栈

- **后端**：Flask, LangGraph, LangChain
- **前端**：HTML, CSS, JavaScript, Canvas
- **AI模型**：DeepSeek API
- **数据库**：PostgreSQL (可选)

## 开发说明

项目采用模块化设计，主要包含：

1. **角色系统**：定义不同职业的角色档案和行为模式
2. **情感系统**：管理角色之间的情感关系
3. **记忆系统**：短期记忆和长期记忆管理
4. **技能系统**：插件化的专业技能管理
5. **中间件系统**：处理对话流程和安全策略

## 许可证

MIT License
##
项目更新计划:
1.对特殊职业设计团队协作的多agent模式
2.导入职业相关知识到长期记忆中，将记忆系统打磨好
3.使各个职业间的agent可以互相交流对话，而不是我和他们对话
4.完善工具系统，可以考虑cli命令而不是mcp
