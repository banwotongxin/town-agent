"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseAgent = exports.ToolResultMessage = exports.ToolMessage = exports.SystemMessage = exports.AIMessage = exports.HumanMessage = void 0;
exports.createBaseAgent = createBaseAgent;
// 导入AgentProfile类型和创建函数
const models_1 = require("./models");
/**
 * 人类消息类，表示用户发送的消息
 */
class HumanMessage {
    constructor(content, metadata) {
        this.content = content;
        this.metadata = metadata;
        this.type = 'human'; // 消息类型为human
    }
}
exports.HumanMessage = HumanMessage;
/**
 * AI消息类，表示AI发送的消息
 */
class AIMessage {
    constructor(content, metadata) {
        this.content = content;
        this.metadata = metadata;
        this.type = 'ai'; // 消息类型为ai
    }
}
exports.AIMessage = AIMessage;
/**
 * 系统消息类，表示系统发送的消息
 */
class SystemMessage {
    constructor(content, metadata) {
        this.content = content;
        this.metadata = metadata;
        this.type = 'system'; // 消息类型为system
    }
}
exports.SystemMessage = SystemMessage;
/**
 * 工具消息类，表示工具调用的消息
 */
class ToolMessage {
    constructor(content, metadata) {
        this.content = content;
        this.metadata = metadata;
        this.type = 'tool'; // 消息类型为tool
    }
}
exports.ToolMessage = ToolMessage;
/**
 * 工具结果消息类，表示工具执行结果的消息
 */
class ToolResultMessage {
    constructor(content, metadata) {
        this.content = content;
        this.metadata = metadata;
        this.type = 'tool_result'; // 消息类型为tool_result
        this.metadata = metadata || {}; // 如果没有提供元数据，设置为空对象
    }
}
exports.ToolResultMessage = ToolResultMessage;
/**
 * 基础智能体类，所有智能体的基类
 */
class BaseAgent {
    /**
     * 获取智能体ID
     */
    get AgentId() {
        return this.agentId;
    }
    /**
     * 获取智能体配置文件
     */
    get Profile() {
        return this.profile;
    }
    /**
     * 构造函数
     * @param agentId 智能体ID
     * @param profile 智能体配置文件
     * @param llmModel 语言模型实例（可选）
     */
    constructor(agentId, profile, llmModel) {
        this.agentId = agentId;
        this.profile = profile;
        this.llmModel = llmModel;
        this.isActive = true;
        this.currentLocation = "home"; // 默认位置为home
        this.currentMood = "neutral"; // 默认情绪为neutral
        this.conversationCount = 0; // 初始对话次数为0
    }
    /**
     * 获取系统提示信息
     * @returns 系统提示字符串
     */
    getSystemPrompt() {
        // 构建系统提示，包含智能体的基本信息
        let prompt = `你叫${this.profile.name}，${this.profile.age}岁，职业是${this.profile.profession}。

性格特点：${this.profile.personality}
背景故事：${this.profile.background}
兴趣爱好：${this.profile.hobbies.join(', ')}
说话风格：${this.profile.speech_style}

请始终保持与你的角色设定一致，用符合你性格和职业的方式与人交流。`;
        // 如果有外貌特征，添加到提示中
        if (this.profile.appearance) {
            prompt += `\n外貌特征：${this.profile.appearance}`;
        }
        return prompt;
    }
    /**
     * 格式化消息
     * @param messages 原始消息数组
     * @param memoryContext 记忆上下文（可选）
     * @param emotionContext 情绪上下文（可选）
     * @returns 格式化后的消息数组
     */
    formatMessages(messages, memoryContext, emotionContext) {
        const formatted = [];
        // 获取系统提示
        let systemPrompt = this.getSystemPrompt();
        // 添加记忆上下文
        if (memoryContext) {
            systemPrompt += `\n\n[历史对话摘要]\n${memoryContext}`;
        }
        // 添加情绪上下文
        if (emotionContext) {
            systemPrompt += `\n\n[当前关系状态]\n${emotionContext}`;
        }
        // 添加系统消息和原始消息
        formatted.push(new SystemMessage(systemPrompt));
        formatted.push(...messages);
        return formatted;
    }
    /**
     * 响应用户消息
     * @param userMessage 用户消息内容
     * @param conversationHistory 对话历史
     * @param kwargs 额外参数
     * @returns 智能体的响应
     */
    async respond(userMessage, conversationHistory, kwargs = {}) {
        // 如果没有语言模型，返回系统提示
        if (!this.llmModel) {
            return "[系统] 我还没有学会说话...";
        }
        // 从文件加载历史上下文
        let fileHistory = [];
        try {
            const { RoleHistoryManager } = await Promise.resolve().then(() => __importStar(require('../memory/role_history_manager')));
            const roleHistoryManager = new RoleHistoryManager();
            // 获取文件历史，限制token数
            fileHistory = await roleHistoryManager.getContext(this.agentId, {
                maxTokens: 8000 // 控制在8000 token以内
            });
            console.log(`[BaseAgent] 角色 ${this.agentId} 从文件加载了 ${fileHistory.length} 条历史消息`);
        }
        catch (error) {
            console.error(`[BaseAgent] 加载文件历史失败:`, error);
            // 如果加载失败，使用传入的 conversationHistory
            fileHistory = conversationHistory;
        }
        // 合并文件历史和当前对话
        const allHistory = [...fileHistory, ...conversationHistory];
        // 格式化消息
        const messages = this.formatMessages([...allHistory, new HumanMessage(userMessage)], kwargs.memory_context, kwargs.emotion_context);
        // 调用语言模型获取响应
        let response;
        if (this.llmModel.ainvoke) {
            response = await this.llmModel.ainvoke(messages);
        }
        else {
            response = await this.llmModel.invoke(messages);
        }
        // 增加对话次数
        this.conversationCount++;
        // 保存对话到文件历史
        try {
            const { RoleHistoryManager } = await Promise.resolve().then(() => __importStar(require('../memory/role_history_manager')));
            const roleHistoryManager = new RoleHistoryManager();
            // 保存用户消息和助手响应
            await roleHistoryManager.addMessage(this.agentId, new HumanMessage(userMessage));
            await roleHistoryManager.addMessage(this.agentId, new AIMessage(response.content || String(response)));
            console.log(`[BaseAgent] 角色 ${this.agentId} 已保存对话到文件`);
        }
        catch (error) {
            console.error(`[BaseAgent] 保存文件历史失败:`, error);
            // 不中断流程，继续执行
        }
        // 返回响应内容
        return response.content || String(response);
    }
    /**
     * 获取智能体状态
     * @returns 智能体状态对象
     */
    getStatus() {
        return {
            agent_id: this.agentId,
            name: this.profile.name,
            profession: this.profile.profession,
            is_active: this.isActive,
            location: this.currentLocation,
            mood: this.currentMood,
            conversation_count: this.conversationCount
        };
    }
    /**
     * 转换为字符串
     * @returns 智能体的字符串表示
     */
    toString() {
        return `BaseAgent(${this.profile.name}, ${this.profile.profession})`;
    }
}
exports.BaseAgent = BaseAgent;
/**
 * 创建基础智能体
 * @param name 智能体名称
 * @param profession 智能体职业
 * @param agentId 智能体ID（可选）
 * @param profileKwargs 配置参数（可选）
 * @returns 基础智能体实例
 */
function createBaseAgent(name, profession, agentId, profileKwargs = {}) {
    // 创建智能体配置文件
    const profile = (0, models_1.createAgentProfile)(name, profession, profileKwargs.age, profileKwargs.personality, profileKwargs.background, profileKwargs.custom_skills);
    // 生成智能体ID
    const id = agentId || `agent_${Math.random().toString(16).substr(2, 8)}`;
    // 创建并返回智能体实例
    return new BaseAgent(id, profile);
}
