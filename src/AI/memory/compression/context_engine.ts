import { BaseMessage } from '../../agents/base_agent'; // 导入基础消息类型

/**
 * 上下文引擎接口 - 可插拔的上下文管理框架
 * 
 * 【设计目的】
 * 这个接口定义了上下文管理的标准契约，允许未来替换不同的压缩策略。
 * 就像USB接口一样，只要符合这个接口规范，就可以插入不同的实现。
 * 
 * 【使用场景】
 * - 当前：使用 LegacyContextEngine（委托给现有的 RoleHistoryManager）
 * - 未来：可以创建更智能的压缩引擎，比如基于重要性评分的引擎
 */
export interface ContextEngine { // 上下文引擎接口定义
  readonly id: string;        // 引擎唯一标识符，例如 "legacy", "smart"
  readonly name: string;      // 引擎名称，用于日志显示
  
  // 【初始化方法】可选，用于加载历史数据
  // 参数：roleId - 角色ID，historyFile - 历史文件路径
  bootstrap?(params: { roleId: string; historyFile: string }): Promise<void>; // 可选的初始化方法
  
  // 【接收消息】将单条消息存入引擎内部管理
  // 参数：roleId - 角色ID, message - 消息对象, isHeartbeat - 是否为心跳消息
  // 返回：是否成功接收
  ingest(params: { roleId: string; message: BaseMessage; isHeartbeat?: boolean }): Promise<boolean>; // 接收消息方法
  
  // 【对话后处理】每轮对话完成后触发，可用于后台压缩等操作
  // 参数包含对话状态、token预算等信息
  afterTurn?(params: { // 可选的对话后处理方法
    roleId: string; // 角色ID
    messages: BaseMessage[];              // 当前所有消息
    prePromptMessageCount: number;        // 提示词前的消息数量
    autoCompactionSummary?: string;       // 自动压缩生成的摘要
    tokenBudget?: number; // Token预算
  }): Promise<void>; // 无返回值
  
  // 【组装消息】在token预算内组装最终发送给LLM的消息
  // 这是发送前的最后一道关卡，确保不会超出模型的上下文窗口
  // 返回：组装后的消息数组和预估token数
  assemble(params: { // 组装消息方法
    roleId: string; // 角色ID
    messages: BaseMessage[]; // 消息数组
    tokenBudget?: number; // Token预算上限
    model?: string;           // 使用的模型名称
    prompt?: string;          // 用户提示词
  }): Promise<{ messages: BaseMessage[]; estimatedTokens: number; systemPromptAddition?: string }>; // 返回组装结果
  
  // ★【核心压缩方法】执行上下文压缩操作
  // 这是整个系统的核心，负责将过长的对话历史压缩到可控范围
  // 参数：
  //   - roleId: 角色ID
  //   - historyFile: 历史文件路径
  //   - tokenBudget: Token预算（可选）
  //   - force: 是否强制压缩，忽略阈值检查
  //   - currentTokenCount: 当前token数（可选，避免重复计算）
  //   - customInstructions: 自定义压缩指令（可选）
  compact(params: { // 核心压缩方法
    roleId: string; // 角色ID
    historyFile: string; // 历史文件路径
    tokenBudget?: number; // Token预算（可选）
    force?: boolean; // 是否强制压缩
    currentTokenCount?: number; // 当前token数（可选）
    customInstructions?: string; // 自定义压缩指令（可选）
  }): Promise<CompactResult>; // 返回压缩结果
  
  // 维护功能（如转录重写等）
  maintain?(params: { roleId: string; historyFile: string }): Promise<void>; // 可选的维护方法
  
  // 释放资源
  dispose?(): Promise<void>; // 可选的资源释放方法
}

/**
 * 压缩操作的结果
 */
export interface CompactResult { // 压缩结果接口
  ok: boolean; // 操作是否成功
  compacted: boolean; // 是否执行了压缩
  reason?: string; // 失败原因（可选）
  result?: { // 压缩结果详情（可选）
    summary?: string; // 生成的摘要
    firstKeptEntryId?: string; // 第一个保留条目的ID
    tokensBefore: number; // 压缩前的token数
    tokensAfter?: number; // 压缩后的token数
  };
}

/**
 * 上下文引擎注册表 - 管理可插拔的引擎
 */
export class ContextEngineRegistry { // 上下文引擎注册表类
  private engines = new Map<string, () => ContextEngine>(); // 存储引擎工厂函数的Map
  private defaultEngineId: string = 'legacy'; // 默认引擎ID

  /**
   * 注册一个上下文引擎工厂函数
   */
  register(id: string, factory: () => ContextEngine): { ok: boolean; existingOwner?: string } { // 注册引擎工厂函数
    if (this.engines.has(id)) { // 如果引擎已存在
      return { ok: false, existingOwner: 'existing' }; // 返回失败
    }
    this.engines.set(id, factory); // 注册新引擎
    return { ok: true }; // 返回成功
  }

  /**
   * 根据ID解析引擎，或使用默认引擎
   */
  resolve(engineId?: string): ContextEngine { // 解析引擎，根据ID或使用默认
    const id = engineId ?? this.defaultEngineId; // 使用提供的ID或默认ID
    const factory = this.engines.get(id); // 获取引擎工厂函数
    if (!factory) { // 如果工厂不存在
      throw new Error(`ContextEngine "${id}" not registered`); // 抛出错误
    }
    return factory(); // 调用工厂函数创建引擎实例
  }

  /**
   * 设置默认引擎ID
   */
  setDefaultEngine(id: string): void { // 设置默认引擎ID
    if (!this.engines.has(id)) { // 如果引擎未注册
      throw new Error(`Cannot set default engine "${id}": not registered`); // 抛出错误
    }
    this.defaultEngineId = id; // 设置默认引擎ID
  }

  /**
   * 列出所有已注册的引擎ID
   */
  listEngines(): string[] { // 列出所有已注册的引擎ID
    return Array.from(this.engines.keys()); // 返回所有引擎ID数组
  }
}

/**
 * 传统上下文引擎 - 最小化实现，委托给现有压缩机制
 */
export class LegacyContextEngine implements ContextEngine { // 传统上下文引擎实现类
  readonly id = 'legacy'; // 引擎ID为'legacy'
  readonly name = 'Legacy Context Engine'; // 引擎名称

  async bootstrap?(_params: { roleId: string; historyFile: string }): Promise<void> { // 初始化方法（空实现）
    // 传统引擎不需要初始化
  }

  async ingest(_params: { roleId: string; message: BaseMessage; isHeartbeat?: boolean }): Promise<boolean> { // 接收消息方法
    // 由RoleHistoryManager管理
    return false; // 返回false表示未处理
  }

  async assemble(params: { // 组装消息方法
    roleId: string; // 角色ID
    messages: BaseMessage[]; // 消息数组
    tokenBudget?: number; // Token预算
  }): Promise<{ messages: BaseMessage[]; estimatedTokens: number }> { // 返回组装结果
    // 目前只是透传
    const { TokenUtils } = await import('./token_utils'); // 动态导入Token工具
    const estimatedTokens = TokenUtils.calculateMessagesTokenCount(params.messages); // 计算token数
    return { messages: params.messages, estimatedTokens }; // 返回原始消息和估算的token数
  }

  async compact(params: { // 压缩方法
    roleId: string; // 角色ID
    historyFile: string; // 历史文件路径
    tokenBudget?: number; // Token预算
    force?: boolean; // 是否强制压缩
  }): Promise<CompactResult> { // 返回压缩结果
    // 委托给RoleHistoryManager的compress方法
    try {
      const { RoleHistoryManager } = await import('../storage/role_history_manager'); // 动态导入RoleHistoryManager
      const roleHistoryManager = new RoleHistoryManager(); // 创建管理器实例
      await roleHistoryManager.compress(params.roleId); // 执行压缩
      
      return {
        ok: true, // 操作成功
        compacted: true, // 已执行压缩
        result: {
          tokensBefore: 0, // 需要计算
          tokensAfter: 0 // 压缩后的token数
        }
      };
    } catch (error) {
      console.error('[LegacyContextEngine] Compaction failed:', error); // 日志：压缩失败
      return {
        ok: false, // 操作失败
        compacted: false, // 未执行压缩
        reason: String(error) // 失败原因
      };
    }
  }
}

// 全局注册表实例
const globalRegistry = new ContextEngineRegistry(); // 全局注册表实例

// 默认注册传统引擎
globalRegistry.register('legacy', () => new LegacyContextEngine()); // 注册传统引擎为默认

/**
 * 获取全局上下文引擎注册表
 */
export function getContextEngineRegistry(): ContextEngineRegistry { // 获取全局上下文引擎注册表
  return globalRegistry; // 返回全局注册表实例
}
