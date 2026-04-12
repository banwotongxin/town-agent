import { BaseMessage } from '../../agents/base_agent'; // 导入基础消息类型
import { TokenUtils } from './token_utils'; // 导入Token计算工具
import { calculateMaxToolResultChars } from './tool_result_truncation'; // 导入工具结果截断函数

/**
 * 压缩路由决策（第四层）
 * 
 * 【功能说明】
 * 在发送给LLM之前决定最优的压缩策略路径。
 * 通过估算Token数量，选择最高效的处理方式。
 */
export enum CompactionRoute { // 压缩路由枚举
  FITS = 'fits',                                    // 无需操作，适合预算
  COMPACT_ONLY = 'compact_only',                    // 仅需LLM压缩
  TRUNCATE_TOOL_RESULTS_ONLY = 'truncate_only',     // 仅需工具结果截断
  COMPACT_THEN_TRUNCATE = 'compact_then_truncate'   // 需要压缩和截断两者
}

/**
 * 预防性压缩的配置常量
 */
const SAFETY_MARGIN = 1.2; // 安全系数 - Token估算的缓冲
const CHARS_PER_TOKEN = 4; // 每个Token的字符数估算
const TRUNCATION_BUFFER_TOKENS = 512; // 截断缓冲Token数

/**
 * 在发送给LLM之前决定压缩路由
 * 
 * 【工作原理】
 * 1. 估算总Token数（消息 + 系统提示 + 用户输入）
 * 2. 计算溢出量（超出预算的部分）
 * 3. 评估通过截断工具结果能释放多少空间
 * 4. 根据溢出量和可释放空间选择最优路径
 * 
 * 【路由决策逻辑】
 * - 无溢出 → FITS（无需操作）
 * - 有溢出但无法通过截断减少 → COMPACT_ONLY（仅压缩）
 * - 截断足以解决溢出 → TRUNCATE_TOOL_RESULTS_ONLY（仅截断）
 * - 需要两者结合 → COMPACT_THEN_TRUNCATE（压缩+截断）
 * 
 * @param messages 要发送的消息数组
 * @param systemPrompt 系统提示文本
 * @param userPrompt 用户当前输入
 * @param contextTokenBudget 总上下文窗口大小（Token数）
 * @param reserveTokens 为摘要开销保留的Token数（默认4096）
 * @returns 路由决策及估算信息
 */
export function decideCompactionRoute( // 决定压缩路由函数
  messages: BaseMessage[], // 要发送的消息数组
  systemPrompt: string, // 系统提示文本
  userPrompt: string, // 用户当前输入
  contextTokenBudget: number, // 总上下文窗口大小（Token数）
  reserveTokens: number = 4096  // 摘要开销预留，默认4096 tokens
): {
  route: CompactionRoute;       // 选定的路由
  shouldCompact: boolean;       // 是否需要压缩
  estimatedTokens: number;      // 估算的Token数
  overflowTokens: number;       // 溢出的Token数
} {
  // 估算总Token数（含安全系数）
  const estimatedTokens = ( // 计算估算的总Token数
    TokenUtils.calculateMessagesTokenCount(messages) + // 消息的Token数
    TokenUtils.calculateTokenCount(systemPrompt) + // 系统提示的Token数
    TokenUtils.calculateTokenCount(userPrompt) // 用户输入的Token数
  ) * SAFETY_MARGIN; // 乘以安全系数

  // 计算可用预算（总预算减去预留）
  const budget = contextTokenBudget - reserveTokens; // 计算可用预算
  // 计算溢出量
  const overflowTokens = Math.max(0, estimatedTokens - budget); // 计算溢出Token数，最小为0

  // 如果没有溢出，说明在预算范围内
  if (overflowTokens <= 0) { // 如果没有溢出
    return {
      route: CompactionRoute.FITS, // 路由：适合预算
      shouldCompact: false, // 不需要压缩
      estimatedTokens, // 返回估算的Token数
      overflowTokens: 0 // 溢出为0
    };
  }

  console.log(`[预防性压缩] 检测到溢出: ${overflowTokens} tokens`); // 日志：显示溢出情况

  // 评估通过截断工具结果能释放多少空间
  const reducible = estimateToolResultReduction(messages, contextTokenBudget); // 估算可释放的空间
  const overflowChars = overflowTokens * CHARS_PER_TOKEN; // 溢出字符数
  const bufferChars = TRUNCATION_BUFFER_TOKENS * CHARS_PER_TOKEN; // 缓冲字符数
  // 计算截断阈值（取较大值）
  const truncateThreshold = Math.max(
    overflowChars + bufferChars,  // 溢出 + 缓冲
    overflowChars * 1.5           // 或溢出的1.5倍
  );

  let route: CompactionRoute; // 声明路由变量
  if (reducible.maxReducibleChars <= 0) { // 如果无法通过截断减少
    // 无法通过截断减少，必须压缩
    route = CompactionRoute.COMPACT_ONLY; // 路由：仅压缩
    console.log('[预防性压缩] 路由决策: 仅压缩 (无工具结果可截断)'); // 日志：显示路由决策
  } else if (reducible.maxReducibleChars >= truncateThreshold) { // 如果截断足以解决溢出
    // 仅截断就足够了
    route = CompactionRoute.TRUNCATE_TOOL_RESULTS_ONLY; // 路由：仅截断
    console.log(`[预防性压缩] 路由决策: 仅截断 (可释放 ${reducible.maxReducibleChars} chars)`); // 日志：显示路由决策
  } else { // 否则需要两者结合
    // 需要压缩和截断两者结合
    route = CompactionRoute.COMPACT_THEN_TRUNCATE; // 路由：压缩+截断
    console.log(`[预防性压缩] 路由决策: 压缩+截断`); // 日志：显示路由决策
  }

  return {
    route, // 返回选定的路由
    shouldCompact: route === CompactionRoute.COMPACT_ONLY || // 判断是否需要压缩
                   route === CompactionRoute.COMPACT_THEN_TRUNCATE,
    estimatedTokens, // 返回估算的Token数
    overflowTokens // 返回溢出的Token数
  };
}

/**
 * 估算通过截断过大的工具结果能减少多少字符
 * 
 * 【工作原理】
 * 1. 计算单个工具结果的最大允许字符数
 * 2. 找出所有超过限制的工具结果
 * 3. 累加超出部分的字符数
 * 
 * @param messages 消息数组
 * @param contextWindowTokens 上下文窗口大小（Token数）
 * @returns 最大可减少的字符数
 */
function estimateToolResultReduction( // 估算工具结果可释放空间函数
  messages: BaseMessage[], // 消息数组
  contextWindowTokens: number // 上下文窗口大小（Token数）
): { maxReducibleChars: number } { // 返回最大可减少的字符数
  // 计算单个工具结果的最大字符数
  const maxSingle = calculateMaxToolResultChars(contextWindowTokens); // 根据上下文窗口计算最大字符数
  // 过滤出所有工具结果消息
  const toolResults = messages.filter(m => m.type === 'tool_result'); // 筛选工具结果消息

  // 累加所有超出限制的工具结果的超出部分
  const reducible = toolResults.reduce((sum, msg) => { // 累加超出部分的字符数
    if (msg.content.length > maxSingle) { // 如果超过最大限制
      return sum + (msg.content.length - maxSingle); // 累加超出部分
    }
    return sum; // 否则不增加
  }, 0);

  return { maxReducibleChars: reducible }; // 返回最大可减少的字符数
}
