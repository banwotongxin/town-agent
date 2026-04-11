/**
 * 赛博小镇 Web 服务器
 * 
 * 这是整个项目的后端服务器，负责：
 * 1. 提供前端页面给用户访问
 * 2. 处理用户与角色的对话请求
 * 3. 管理团队的创建和任务执行
 * 4. 调用AI模型生成智能回复
 * 
 * 就像是一个餐厅的服务员，接收顾客的点单（用户请求），
 * 然后交给厨师（AI模型）处理，最后把做好的菜（回复）端给顾客。
 */

// 导入Express框架 - 用于创建Web服务器
import express from 'express';
// 导入CORS中间件 - 允许跨域访问，让前端可以正常调用API
import cors from 'cors';
// 导入path模块 - 用于处理文件路径
import path from 'path';
// 导入fs模块 - 用于读取文件
import fs from 'fs';
// 导入创建默认小镇的函数 - 初始化8个角色
import { createDefaultTown } from './AI/graph/town_graph';
// 导入创建团队智能体的函数 - 用于团队协作任务
import { createTeamAgent } from './AI/agents/team_agent';
// 导入消息类型定义 - 用于对话历史
import { BaseMessage } from './AI/agents/base_agent';

// 创建Express应用实例
// Express是一个Web框架，就像是一个工具箱，帮我们快速搭建网站服务器
const app = express();
// 默认端口号 - 服务器运行在这个端口上，用户可以通过 http://localhost:8888 访问
let PORT = 8888;

// 启用CORS（跨域资源共享）
// 这就像是给服务器开了一扇窗，允许其他网站（前端页面）访问我们的API
app.use(cors());
// 解析JSON请求体
// 当用户发送数据时，这个功能帮我们把JSON格式的数据转换成JavaScript对象，方便处理
app.use(express.json());

// 全局变量存储小镇实例
// 就像是一个大容器，里面装着整个小镇和所有角色
let townInstance: any = null;

// 存储团队实例的全局字典
// 字典的键是团队ID，值是团队对象
// 可以理解为多个团队的名单表
const teams: Record<string, any> = {};

/**
 * DeepSeek模型类
 * 
 * 这个类负责与DeepSeek AI模型进行通信。
 * DeepSeek是一个人工智能模型，就像是一个非常聪明的机器人，
 * 能够理解人类语言并生成智能回复。
 * 
 * 这个类的作用就是：
 * 1. 把用户的消息发送给DeepSeek
 * 2. 接收DeepSeek的回复
 * 3. 把回复返回给用户
 */
class DeepSeekModel {
  // API密钥 - 就像是访问DeepSeek服务的密码，证明我们有使用权
  private apiKey: string;
  // API基础URL - DeepSeek服务的网络地址
  private baseUrl: string;

  /**
   * 构造函数 - 创建DeepSeekModel实例时自动调用
   * 
   * @param apiKey DeepSeek API密钥，从.env文件中读取
   */
  constructor(apiKey: string) {
    // 保存API密钥，后续发送请求时需要用到
    this.apiKey = apiKey;
    // 设置DeepSeek API的地址
    this.baseUrl = 'https://api.deepseek.com/v1/chat/completions';
  }

  /**
   * 调用LLM模型 - 向DeepSeek发送消息并获取回复
   * 
   * 这个过程就像是：
   * 1. 把用户的问题打包好
   * 2. 通过网络发送给DeepSeek
   * 3. 等待DeepSeek思考并生成回复
   * 4. 收到回复后返回给用户
   * 
   * @param messages 消息数组，包含对话历史
   * @returns 模型的回复内容
   */
  async invoke(messages: BaseMessage[]): Promise<{ content: string }> {
    try {
      // 转换消息格式以适应DeepSeek API的要求
      // DeepSeek需要的格式是：{role: 'user', content: '消息内容'}
      // 而我们的格式是：{type: 'human', content: '消息内容'}
      // 所以需要做一个转换
      const formattedMessages = messages.map(msg => {
        // 默认角色是'user'（用户）
        let role = 'user';
        // 如果消息类型是'system'，说明是系统提示，角色设为'system'
        if (msg.type === 'system') {
          role = 'system';
        // 如果消息类型是'ai'，说明是AI之前的回复，角色设为'assistant'
        } else if (msg.type === 'ai') {
          role = 'assistant';
        }
        // 返回DeepSeek需要的格式
        return { role, content: msg.content };
      });

      // 发送API请求到DeepSeek服务器
      // fetch是JavaScript内置的网络请求函数
      const response = await fetch(this.baseUrl, {
        method: 'POST',  // 使用POST方法发送数据
        headers: {
          'Content-Type': 'application/json',  // 告诉服务器我们发送的是JSON数据
          'Authorization': `Bearer ${this.apiKey}`  // 带上API密钥进行身份验证
        },
        body: JSON.stringify({
          model: 'deepseek-chat',  // 使用的模型名称
          messages: formattedMessages,  // 转换后的消息数组
          temperature: 0.7,  // 温度参数，控制回复的创造性（0-1之间，越高越有创造性）
          max_tokens: 500  // 最大回复长度，限制在500个token以内
        })
      });

      // 检查响应状态
      // 如果response.ok为false，说明请求失败（比如网络错误、API密钥错误等）
      if (!response.ok) {
        throw new Error(`API请求失败: ${response.status} ${response.statusText}`);
      }

      // 解析响应数据
      // 把服务器返回的JSON字符串转换成JavaScript对象
      const data: any = await response.json();
      // 返回DeepSeek生成的回复内容
      return {
        content: data.choices[0].message.content
      };
    } catch (error) {
      // 如果发生错误（比如网络断开、API密钥错误等），记录错误信息
      console.error('LLM调用失败:', error);
      // 出错时返回一个默认的友好提示，而不是让程序崩溃
      return {
        content: '[系统] 暂时无法回答你的问题，请稍后再试。'
      };
    }
  }
}

/**
 * 创建LLM模型实例的辅助函数
 * 
 * @param apiKey API密钥
 * @returns LLM模型实例，用于与DeepSeek通信
 */
function createLLMModel(apiKey: string): any {
  // 创建并返回一个新的DeepSeekModel实例
  return new DeepSeekModel(apiKey);
}

// 获取当前文件所在目录的路径
// __dirname是当前文件所在的目录路径
const BASE_DIR = path.dirname(__dirname);
// 构建.env文件的完整路径
const envPath = path.join(BASE_DIR, '.env');

/**
 * 加载API密钥 - 从环境变量或.env文件中读取DeepSeek API密钥
 * 
 * API密钥就像是访问DeepSeek服务的通行证，没有它就无法使用AI功能。
 * 这个函数会先尝试从环境变量中读取，如果找不到，再从.env文件中读取。
 * 
 * @returns API密钥字符串，如果找不到则返回null
 */
function loadApiKey(): string | null {
  // 首先尝试从环境变量中读取API Key
  // 环境变量是操作系统级别的配置，比较安全
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (apiKey) {
    // 如果找到了，直接返回
    return apiKey;
  }

  // 如果环境变量中没有，尝试从.env文件直接读取API Key作为备用方案
  // .env文件是一个配置文件，存储敏感信息（如API密钥）
  try {
    // 读取.env文件的内容
    const content = fs.readFileSync(envPath, 'utf-8');
    // 按行分割文件内容
    const lines = content.split('\n');
    let deepseekKey: string | null = null;
    // 逐行查找API密钥
    for (const line of lines) {
      const trimmedLine = line.trim();  // 去除首尾空格
      // 如果这一行以'DEEPSEEK_API_KEY='开头，说明是我们要找的API密钥
      if (trimmedLine.startsWith('DEEPSEEK_API_KEY=')) {
        // 提取等号后面的值，就是API密钥
        deepseekKey = trimmedLine.split('=', 2)[1];
      } else if (trimmedLine.startsWith('HUGGINGFACE_API_KEY=')) {
        // 同时加载Hugging Face API密钥到环境变量（用于其他AI功能）
        process.env.HUGGINGFACE_API_KEY = trimmedLine.split('=', 2)[1];
      } else if (trimmedLine.startsWith('QWEN_API_KEY=')) {
        // 加载Qwen API密钥到环境变量（阿里通义千问模型）
        process.env.QWEN_API_KEY = trimmedLine.split('=', 2)[1];
      } else if (trimmedLine.startsWith('QWEN_BASE_URL=')) {
        // 加载Qwen Base URL到环境变量
        process.env.QWEN_BASE_URL = trimmedLine.split('=', 2)[1];
      }
    }
    // 返回找到的DeepSeek API密钥
    return deepseekKey;
  } catch (e) {
    // 如果读取文件失败（比如文件不存在），记录错误
    console.error(`[ERROR] 读取 .env 文件失败:`, e);
  }
  // 如果都没找到，返回null
  return null;
}

/**
 * 根路径处理
 * 返回前端页面
 */
app.get('/', (req, res) => {
  try {
    // 使用绝对路径
    const htmlPath = path.join(BASE_DIR, 'frontend', 'index.html');
    const content = fs.readFileSync(htmlPath, 'utf-8');
    res.send(content);
  } catch (e) {
    console.error(`[ERROR] 读取前端文件失败:`, e);
    res.status(500).send(`错误: ${e}`);
  }
});

/**
 * 获取所有角色列表
 */
app.get('/api/agents', (req, res) => {
  if (!townInstance) {
    return res.status(500).json({ error: '小镇未初始化' });
  }

  const agents = [];
  for (const [agentId, agent] of Object.entries(townInstance.Agents)) {
    // 为不同职业分配不同的位置（对应不同的建筑物）
    const typedAgent = agent as any;
    const profile = typedAgent.Profile;
    const profession = profile.profession;

    // 根据职业分配位置
    let x, y;
    switch (profession) {
      case '作家':
        // 图书馆附近
        x = 20;
        y = 30;
        break;
      case '医生':
        // 医院附近
        x = 70;
        y = 30;
        break;
      case '程序员':
        // 科技园附近
        x = 80;
        y = 70;
        break;
      case '教师':
        // 学校附近
        x = 30;
        y = 70;
        break;
      case '艺术家':
        // 艺术馆附近
        x = 50;
        y = 20;
        break;
      case '工程师':
        // 工厂附近
        x = 70;
        y = 80;
        break;
      case '科学家':
        // 研究中心附近
        x = 20;
        y = 60;
        break;
      case '商人':
        // 商业区附近
        x = 40;
        y = 40;
        break;
      default:
        // 默认位置
        x = 50;
        y = 50;
    }

    agents.push({
      id: agentId,
      name: profile.name,
      age: profile.age,
      profession: profession,
      personality: profile.personality,
      background: profile.background,
      hobbies: profile.hobbies,
      speech_style: profile.speech_style,
      appearance: profile.appearance,
      x: x,
      y: y
    });
  }

  res.json(agents);
});

/**
 * 与角色对话
 */
app.post('/api/chat', async (req, res) => {
  console.log('[API] 接收到对话请求');

  if (!townInstance) {
    console.log('[ERROR] 小镇未初始化');
    return res.status(500).json({ error: '小镇未初始化' });
  }

  try {
    const data = req.body;
    console.log(`[API] 请求数据:`, data);

    const userInput = data.user_input || '';
    const targetAgentId = data.target_agent_id || '';
    const conversationHistory = data.conversation_history || [];

    console.log(`[API] 用户输入: ${userInput}`);
    console.log(`[API] 目标角色: ${targetAgentId}`);
    console.log(`[API] 对话历史长度: ${conversationHistory.length}`);

    // 调用小镇的chat方法
    console.log('[API] 调用小镇chat方法');
    const result = await townInstance.chat(
      userInput,
      targetAgentId,
      conversationHistory
    );
    console.log(`[API] 聊天结果:`, result);

    // 将对话历史中的 Message 对象转换为可序列化的字典
    const serializableHistory = [];
    for (const msg of result.conversation_history) {
      if (msg.role === 'user' || msg.role === 'assistant') {
        serializableHistory.push(msg);
      } else if (typeof msg === 'object') {
        serializableHistory.push(msg);
      }
    }

    res.json({
      response: result.response,
      agent_id: result.agent_id,
      agent_name: result.agent_name,
      conversation_history: serializableHistory
    });
  } catch (e) {
    console.error(`[ERROR] 对话失败:`, e);
    res.status(500).json({ error: (e as Error).message });
  }
});

/**
 * 创建团队
 */
app.post('/api/teams', (req, res) => {
  try {
    const data = req.body;
    const profession = data.profession || '';

    if (!profession) {
      return res.status(400).json({ error: '职业不能为空' });
    }

    // 创建团队
    const team = createTeamAgent(profession);

    res.json({
      team_id: team.TeamId,
      profession: team.Profession,
      leader_agent: team.LeaderAgent?.AgentId || null,
      sub_agents_count: team.SubAgents.length,
      verification_agent: team.VerificationAgent?.AgentId || null
    });
  } catch (e) {
    console.error(`[ERROR] 创建团队失败:`, e);
    res.status(500).json({ error: (e as Error).message });
  }
});

/**
 * 执行团队任务
 */
app.post('/api/teams/task', async (req, res) => {
  try {
    const data = req.body;
    const teamId = data.team_id || '';
    const task = data.task || '';

    if (!teamId || !task) {
      return res.status(400).json({ error: '团队ID和任务不能为空' });
    }

    // 检查团队是否存在，如果不存在则创建
    if (!teams[teamId]) {
      // 从teamId中提取职业信息（假设teamId格式为team_xxx）
      // 这里简化处理，使用默认职业
      const profession = "作家";
      teams[teamId] = createTeamAgent(profession, teamId);
    }

    const team = teams[teamId];

    // 执行任务
    const result = await team.executeTask(task);

    res.json({
      team_id: teamId,
      task: task,
      result: result
    });
  } catch (e) {
    console.error(`[ERROR] 执行团队任务失败:`, e);
    res.status(500).json({ error: (e as Error).message });
  }
});

/**
 * 初始化小镇
 */
async function initializeTown() {
  try {
    // 创建8个角色，确保所有职业都有代表
    townInstance = await createDefaultTown(8);
    console.log(`小镇初始化完成: ${townInstance.TownName}, ${Object.keys(townInstance.Agents).length} 个角色`);
    
    // 为每个角色设置LLM模型
    const apiKey = loadApiKey();
    if (apiKey) {
      const llmModel = createLLMModel(apiKey);
      for (const [agentId, agent] of Object.entries(townInstance.Agents)) {
        (agent as any).llmModel = llmModel;
        console.log(`为角色 ${(agent as any).Profile.name} 设置了LLM模型`);
      }
    } else {
      console.log("警告: 未找到API Key，角色将无法回答问题");
    }
  } catch (e) {
    console.error(`初始化小镇失败:`, e);
    throw e;
  }
}

/**
 * 检查环境配置
 * @returns 是否配置正确
 */
function checkEnv(): boolean {
  console.log("检查环境配置...");

  // 检查API Key
  const apiKey = loadApiKey();
  if (!apiKey) {
    console.log("警告: 未找到 DEEPSEEK_API_KEY");
    return false;
  }

  // 设置环境变量，确保后续代码能使用
  process.env.DEEPSEEK_API_KEY = apiKey;
  console.log("环境配置检查完成");
  return true;
}

/**
 * 检查端口是否可用
 * @param port 端口号
 * @returns 端口是否可用
 */
function checkPort(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const net = require('net');
    const server = net.createServer();
    
    server.on('error', () => {
      resolve(false);
    });
    
    server.on('listening', () => {
      server.close();
      resolve(true);
    });
    
    server.listen(port, '0.0.0.0');
  });
}

/**
 * 查找可用端口
 * @param startPort 起始端口
 * @returns 可用端口号
 */
async function findAvailablePort(startPort: number): Promise<number> {
  let port = startPort;
  while (port < startPort + 10) {
    const isAvailable = await checkPort(port);
    if (isAvailable) {
      return port;
    }
    console.log(`端口 ${port} 已被占用，尝试下一个端口...`);
    port++;
  }
  throw new Error('没有可用的端口');
}

/**
 * 启动服务器
 */
async function startServer() {
  try {
    // 检查环境配置
    console.log("=== 开始启动赛博小镇 V2 ===");
    if (!checkEnv()) {
      console.log("环境配置错误，退出程序");
      process.exit(1);
    }

    // 初始化小镇
    console.log("初始化小镇...");
    try {
      await initializeTown();
      console.log("小镇初始化成功！");
    } catch (e) {
      console.error(`初始化小镇失败:`, e);
      process.exit(1);
    }

    // 检查并找到可用端口
    try {
      PORT = await findAvailablePort(PORT);
    } catch (e) {
      console.error(`找不到可用端口:`, e);
      process.exit(1);
    }

    console.log(`赛博小镇 V2 服务器启动在 http://0.0.0.0:${PORT}`);
    console.log(`前端页面: http://localhost:${PORT}`);
    console.log("按 Ctrl+C 停止服务器");

    // 启动服务器
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`服务器已启动，监听端口 ${PORT}`);
    });
  } catch (e) {
    console.error(`服务器启动失败:`, e);
    process.exit(1);
  }
}

// 启动服务器
startServer();
