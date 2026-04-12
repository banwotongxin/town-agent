/**
 * 上下文压缩模块导出
 * 
 * AI智能体上下文管理的七层防御体系
 * 每一层都负责不同的压缩和优化策略，共同确保上下文在可控范围内
 */

// 第一层：上下文引擎接口（可插拔的上下文管理框架）
export {
  ContextEngine, // 上下文引擎接口 - 定义了上下文管理的标准契约
  CompactResult, // 压缩结果类型 - 描述压缩操作的结果
  ContextEngineRegistry, // 上下文引擎注册表 - 管理可插拔的引擎
  LegacyContextEngine, // 传统上下文引擎实现 - 委托给现有的RoleHistoryManager
  getContextEngineRegistry // 获取全局上下文引擎注册表的函数
} from './context_engine';

// 第二层：上下文裁剪（轻量级操作，无需LLM调用）
export {
  pruneContext, // 上下文裁剪函数 - 通过软裁剪和硬清除减少上下文大小
  PruningSettings, // 裁剪配置接口 - 定义裁剪参数
  DEFAULT_PRUNING_SETTINGS // 默认裁剪配置 - 预定义的裁剪参数
} from './context_pruning';

// 第三层：工具结果截断（智能截断过长的工具输出）
export {
  truncateToolResult, // 截断单个工具结果 - 智能截断过长的工具输出
  calculateMaxToolResultChars, // 计算工具结果最大字符数 - 根据上下文窗口计算限制
  truncateAggregateToolResults // 聚合截断多个工具结果 - 批量截断多个工具结果
} from './tool_result_truncation';

// 第四层：预防性压缩（在发送给LLM之前决定压缩策略）
export {
  decideCompactionRoute, // 决定压缩路由 - 选择最优的压缩策略路径
  CompactionRoute // 压缩路由枚举 - 定义不同的压缩路径
} from './preemptive_compaction';

// 第五层：主动压缩（核心 - 使用LLM生成摘要）
export {
  activeCompact // 主动压缩函数 - 使用LLM智能生成对话摘要
} from './active_compaction';

// 第六层：摘要质量审计（确保重要信息被保留）
export {
  auditSummaryQuality // 审计摘要质量 - 检查摘要是否包含关键信息
} from './summary_audit';

// 第七层：会话截断（物理删除已摘要的消息条目）
export {
  truncateSessionAfterCompaction // 压缩后截断会话 - 物理删除已被摘要的消息
} from './session_truncation';

// 增强的Token工具类
export {
  TokenUtils // Token计算工具 - 提供准确的Token计算功能
} from './token_utils';

// ==================== 已弃用的模块 ====================
// @deprecated 请使用 activeCompact 替代
// export { ConversationCompressor } from './conversation_compressor';
