/**
 * 赛博小镇 Web 服务器
 * 提供前端页面和API接口，支持智能体交互和团队任务执行
 */
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { createDefaultTown } from './AI/graph/town_graph';
import { createTeamAgent } from './AI/agents/team_agent';
import { BaseMessage } from './AI/agents/base_agent';

// 创建Express应用实例
const app = express();
// 默认端口
let PORT = 8888;

// 启用CORS（跨域资源共享）
app.use(cors());
// 解析JSON请求体
app.use(express.json());

// 全局变量存储小镇实例
let townInstance: any = null;

// 存储团队实例的全局字典
const teams: Record<string, any> = {};

/**
 * DeepSeek模型类
 * 用于调用DeepSeek API进行AI对话
 */
class DeepSeekModel {
  // API密钥
  private apiKey: string;
  // API基础URL
  private baseUrl: string;

  /**
   * 构造函数
   * @param apiKey DeepSeek API密钥
   */
  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.baseUrl = 'https://api.deepseek.com/v1/chat/completions';
  }

  /**
   * 调用LLM模型
   * @param messages 消息数组
   * @returns 模型响应
   */
  async invoke(messages: BaseMessage[]): Promise<{ content: string }> {
    try {
      // 转换消息格式以适应DeepSeek API
      const formattedMessages = messages.map(msg => {
        let role = 'user';
        if (msg.type === 'system') {
          role = 'system';
        } else if (msg.type === 'ai') {
          role = 'assistant';
        }
        return { role, content: msg.content };
      });

      // 发送API请求
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: formattedMessages,
          temperature: 0.7,
          max_tokens: 500
        })
      });

      // 检查响应状态
      if (!response.ok) {
        throw new Error(`API请求失败: ${response.status} ${response.statusText}`);
      }

      // 解析响应数据
      const data: any = await response.json();
      return {
        content: data.choices[0].message.content
      };
    } catch (error) {
      console.error('LLM调用失败:', error);
      // 出错时返回默认响应
      return {
        content: '[系统] 暂时无法回答你的问题，请稍后再试。'
      };
    }
  }
}

/**
 * 创建LLM模型实例
 * @param apiKey API密钥
 * @returns LLM模型实例
 */
function createLLMModel(apiKey: string): any {
  return new DeepSeekModel(apiKey);
}

// 获取当前文件所在目录
const BASE_DIR = path.dirname(__dirname);
const envPath = path.join(BASE_DIR, '.env');

/**
 * 加载API密钥
 * @returns API密钥或null
 */
function loadApiKey(): string | null {
  // 从环境变量加载API Key
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (apiKey) {
    return apiKey;
  }

  // 从.env文件直接读取API Key作为备用方案
  try {
    const content = fs.readFileSync(envPath, 'utf-8');
    const lines = content.split('\n');
    let deepseekKey: string | null = null;
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (trimmedLine.startsWith('DEEPSEEK_API_KEY=')) {
        deepseekKey = trimmedLine.split('=', 2)[1];
      } else if (trimmedLine.startsWith('HUGGINGFACE_API_KEY=')) {
        // 同时加载Hugging Face API密钥到环境变量
        process.env.HUGGINGFACE_API_KEY = trimmedLine.split('=', 2)[1];
      } else if (trimmedLine.startsWith('QWEN_API_KEY=')) {
        // 加载Qwen API密钥到环境变量
        process.env.QWEN_API_KEY = trimmedLine.split('=', 2)[1];
      } else if (trimmedLine.startsWith('QWEN_BASE_URL=')) {
        // 加载Qwen Base URL到环境变量
        process.env.QWEN_BASE_URL = trimmedLine.split('=', 2)[1];
      }
    }
    return deepseekKey;
  } catch (e) {
    console.error(`[ERROR] 读取 .env 文件失败:`, e);
  }
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
