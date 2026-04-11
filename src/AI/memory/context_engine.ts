import { BaseMessage } from '../agents/base_agent';

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
export interface ContextEngine {
  readonly id: string;        // 引擎唯一标识符，例如 "legacy", "smart"
  readonly name: string;      // 引擎名称，用于日志显示
  
  // 【初始化方法】可选，用于加载历史数据
  // 参数：roleId - 角色ID，historyFile - 历史文件路径
  bootstrap?(params: { roleId: string; historyFile: string }): Promise<void>;
  
  // 【接收消息】将单条消息存入引擎内部管理
  // 参数：roleId - 角色ID, message - 消息对象, isHeartbeat - 是否为心跳消息
  // 返回：是否成功接收
  ingest(params: { roleId: string; message: BaseMessage; isHeartbeat?: boolean }): Promise<boolean>;
  
  // 【对话后处理】每轮对话完成后触发，可用于后台压缩等操作
  // 参数包含对话状态、token预算等信息
  afterTurn?(params: {
    roleId: string;
    messages: BaseMessage[];              // 当前所有消息
    prePromptMessageCount: number;        // 提示词前的消息数量
    autoCompactionSummary?: string;       // 自动压缩生成的摘要
    tokenBudget?: number;                 // Token预算
  }): Promise<void>;
  
  // 【组装消息】在token预算内组装最终发送给LLM的消息
  // 这是发送前的最后一道关卡，确保不会超出模型的上下文窗口
  // 返回：组装后的消息数组和预估token数
  assemble(params: {
    roleId: string;
    messages: BaseMessage[];
    tokenBudget?: number;     // Token预算上限
    model?: string;           // 使用的模型名称
    prompt?: string;          // 用户提示词
  }): Promise<{ messages: BaseMessage[]; estimatedTokens: number; systemPromptAddition?: string }>;
  
  // ★【核心压缩方法】执行上下文压缩操作
  // 这是整个系统的核心，负责将过长的对话历史压缩到可控范围
  // 参数：
  //   - roleId: 角色ID
  //   - historyFile: 历史文件路径
  //   - tokenBudget: Token预算（可选）
  //   - force: 是否强制压缩，忽略阈值检查
  //   - currentTokenCount: 当前token数（可选，避免重复计算）
  //   - customInstructions: 自定义压缩指令（可选）
  compact(params: {
    roleId: string;
    historyFile: string;
    tokenBudget?: number;
    force?: boolean;
    currentTokenCount?: number;
    customInstructions?: string;
  }): Promise<CompactResult>;
  
  // Maintenance (transcript rewriting, etc.)
  maintain?(params: { roleId: string; historyFile: string }): Promise<void>;
  
  // Release resources
  dispose?(): Promise<void>;
}

/**
 * Result of compaction operation
 */
export interface CompactResult {
  ok: boolean;
  compacted: boolean;
  reason?: string;
  result?: {
    summary?: string;
    firstKeptEntryId?: string;
    tokensBefore: number;
    tokensAfter?: number;
  };
}

/**
 * Context Engine Registry - manages pluggable engines
 */
export class ContextEngineRegistry {
  private engines = new Map<string, () => ContextEngine>();
  private defaultEngineId: string = 'legacy';

  /**
   * Register a context engine factory
   */
  register(id: string, factory: () => ContextEngine): { ok: boolean; existingOwner?: string } {
    if (this.engines.has(id)) {
      return { ok: false, existingOwner: 'existing' };
    }
    this.engines.set(id, factory);
    return { ok: true };
  }

  /**
   * Resolve an engine by ID or use default
   */
  resolve(engineId?: string): ContextEngine {
    const id = engineId ?? this.defaultEngineId;
    const factory = this.engines.get(id);
    if (!factory) {
      throw new Error(`ContextEngine "${id}" not registered`);
    }
    return factory();
  }

  /**
   * Set default engine ID
   */
  setDefaultEngine(id: string): void {
    if (!this.engines.has(id)) {
      throw new Error(`Cannot set default engine "${id}": not registered`);
    }
    this.defaultEngineId = id;
  }

  /**
   * List all registered engine IDs
   */
  listEngines(): string[] {
    return Array.from(this.engines.keys());
  }
}

/**
 * Legacy Context Engine - minimal implementation that delegates to existing compression
 */
export class LegacyContextEngine implements ContextEngine {
  readonly id = 'legacy';
  readonly name = 'Legacy Context Engine';

  async bootstrap?(_params: { roleId: string; historyFile: string }): Promise<void> {
    // No initialization needed for legacy
  }

  async ingest(_params: { roleId: string; message: BaseMessage; isHeartbeat?: boolean }): Promise<boolean> {
    // Managed by RoleHistoryManager
    return false;
  }

  async assemble(params: {
    roleId: string;
    messages: BaseMessage[];
    tokenBudget?: number;
  }): Promise<{ messages: BaseMessage[]; estimatedTokens: number }> {
    // Pass-through for now
    const { TokenUtils } = await import('../memory/token_utils');
    const estimatedTokens = TokenUtils.calculateMessagesTokenCount(params.messages);
    return { messages: params.messages, estimatedTokens };
  }

  async compact(params: {
    roleId: string;
    historyFile: string;
    tokenBudget?: number;
    force?: boolean;
  }): Promise<CompactResult> {
    // Delegate to RoleHistoryManager's compress method
    try {
      const { RoleHistoryManager } = await import('../memory/role_history_manager');
      const roleHistoryManager = new RoleHistoryManager();
      await roleHistoryManager.compress(params.roleId);
      
      return {
        ok: true,
        compacted: true,
        result: {
          tokensBefore: 0, // Would need to calculate
          tokensAfter: 0
        }
      };
    } catch (error) {
      console.error('[LegacyContextEngine] Compaction failed:', error);
      return {
        ok: false,
        compacted: false,
        reason: String(error)
      };
    }
  }
}

// Global registry instance
const globalRegistry = new ContextEngineRegistry();

// Register legacy engine by default
globalRegistry.register('legacy', () => new LegacyContextEngine());

/**
 * Get the global context engine registry
 */
export function getContextEngineRegistry(): ContextEngineRegistry {
  return globalRegistry;
}
