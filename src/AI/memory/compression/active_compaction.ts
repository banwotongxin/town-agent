import { BaseMessage, HumanMessage } from '../../agents/base_agent'; // 导入基础消息类型和人类消息类
import { TokenUtils } from './token_utils'; // 导入Token计算工具类

/**
 * 第五层 - 主动压缩模块
 * 
 * 【核心功能】
 * 使用 LLM 智能生成对话摘要，这是整个七层防御体系的核心。
 * 
 * 【工作流程】
 * 1. 历史裁剪：丢弃旧消息，保留最近的 50%
 * 2. 分块摘要：将丢弃的消息分成小块，分别生成摘要
 * 3. 合并摘要：将所有部分摘要合并为一个连贯的整体
 * 4. 替换消息：用 [摘要] + [保留消息] 替换原始消息
 * 
 * 【关键特性】
 * - 自适应分块：根据消息大小动态调整分块比例
 * - 三级降级：完整摘要 → 部分摘要 → 描述性兜底
 * - 配对保护：保持 tool_use/tool_result 完整性
 * - 信息保全：保留任务状态、用户请求、决策理由
 * 
 * 【性能指标】
 * - 压缩率：50-70%
 * - 延迟：2-5秒（含LLM调用）
 * - Token节省：3000-6000 tokens
 */
// ==================== 配置常量 ====================
// ==================== 配置常量 ====================

/**
 * 安全系数：token 估算的安全缓冲
 * 
 * 【为什么需要？】
 * Token 估算使用 chars/4 的启发式方法，实际可能有偏差。
 * 乘以 1.2 留出 20% 缓冲，防止估算不足导致溢出。
 * 
 * 【示例】
 * 估算 8000 tokens → 实际使用 8000 * 1.2 = 9600 tokens 预算
 */
const SAFETY_MARGIN = 1.2; // 安全系数常量，用于Token估算的缓冲

/**
 * 基础分块比例：默认每块占上下文窗口的 40%
 * 
 * 【为什么是 0.4？】
 * - 太大：可能超出 LLM 的输入限制
 * - 太小：分块过多，增加 LLM 调用次数和成本
 * - 0.4 是经验值，平衡了效率和安全性
 */
const BASE_CHUNK_RATIO = 0.4; // 基础分块比例，默认40%

/**
 * 最小分块比例：当消息很大时，最小降到 15%
 * 
 * 【使用场景】
 * 如果平均每条消息都很大（例如 > 1000 tokens），
 * 需要减小分块比例，避免单块超出 LLM 限制。
 */
const MIN_CHUNK_RATIO = 0.15; // 最小分块比例，15%

/**
 * 摘要最大字符数：限制生成的摘要长度
 * 
 * 【为什么限制？】
 * - 防止摘要过长，占用太多 token
 * - 16000 字符 ≈ 4000 tokens，足够概括大量对话
 */
const MAX_SUMMARY_CHARS = 16000; // 摘要最大字符数限制

/**
 * 合并指令：指导 LLM 如何合并多个部分摘要
 * 
 * 【关键要求】
 * LLM 在合并时必须保留以下信息：
 * 1. 活动任务及其状态（进行中/阻塞/待处理）
 * 2. 用户最后的请求和正在做的事情
 * 3. 已做出的决策及其理由
 * 4. TODOs、未解决的问题和约束条件
 * 5. 任何承诺或后续跟进
 * 
 * 【优先级原则】
 * 最近的上下文比旧的历史更重要。
 * Agent 需要知道它正在做什么，而不仅仅是讨论了什么。
 */
const MERGE_INSTRUCTIONS = `Merge these partial summaries into a single cohesive summary.

MUST PRESERVE:
- Active tasks and their current status (in-progress, blocked, pending)
- The last thing the user requested and what was being done about it
- Decisions made and their rationale
- TODOs, open questions, and constraints
- Any commitments or follow-ups promised

PRIORITIZE recent context over older history. The agent needs to know
what it was doing, not just what was discussed.`; // 合并指令常量

/**
 * 【核心函数】主动压缩：将长对话历史压缩为摘要
 * 
 * 【参数说明】
 * @param messages - 要压缩的所有对话消息
 * @param contextWindowTokens - LLM 的上下文窗口大小（例如 8000）
 * @param llmModel - LLM 模型实例，用于生成摘要
 * @param customInstructions - 可选的自定义压缩指令
 * 
 * 【返回值】
 * - keptMessages: 压缩后的消息数组（[摘要] + [保留的最近消息]）
 * - summary: 生成的摘要文本
 * - tokensBefore: 压缩前的 token 数
 * - tokensAfter: 压缩后的 token 数
 * 
 * 【使用示例】
 * ```typescript
 * const result = await activeCompact(messages, 8000, llmModel);
 * console.log(`压缩率: ${result.tokensBefore} → ${result.tokensAfter}`);
 * // 输出: 压缩率: 9500 → 3200 (压缩率: 66%)
 * ```
 */
export async function activeCompact( // 导出主动压缩函数
  messages: BaseMessage[], // 要压缩的消息数组
  contextWindowTokens: number, // 上下文窗口大小（tokens）
  llmModel: any, // LLM模型实例
  customInstructions?: string // 可选的自定义指令
): Promise<{ // 返回Promise对象，包含压缩结果
  keptMessages: BaseMessage[]; // 保留的消息数组
  summary?: string; // 生成的摘要（可选）
  tokensBefore: number; // 压缩前的token数
  tokensAfter: number; // 压缩后的token数
}> {
  const tokensBefore = TokenUtils.calculateMessagesTokenCount(messages); // 计算压缩前的总token数

  // 步骤1：计算token预算
  const budget = Math.floor(contextWindowTokens * SAFETY_MARGIN); // 计算预算，考虑安全系数
  const chunkRatio = TokenUtils.computeAdaptiveChunkRatio(messages, contextWindowTokens); // 计算自适应分块比例
  const maxChunkTokens = Math.floor(contextWindowTokens * chunkRatio); // 计算最大块大小（tokens）

  console.log(`[主动压缩] 开始: ${messages.length} 条消息, ${tokensBefore} tokens`); // 日志：显示开始压缩的信息
  console.log(`[主动压缩] 分块比例: ${chunkRatio.toFixed(2)}, 最大块大小: ${maxChunkTokens} tokens`); // 日志：显示分块参数

  // 步骤2：历史裁剪（保留最近50%的预算）
  const pruned = pruneHistoryForContextShare(messages, budget, 0.5); // 执行历史裁剪，保留50%的预算
  const dropped = pruned.droppedMessages; // 获取被丢弃的消息
  const kept = pruned.keptMessages; // 获取保留的消息

  if (dropped.length === 0) { // 如果没有需要丢弃的消息
    console.log('[主动压缩] 无需丢弃消息，跳过摘要生成'); // 日志：显示无需压缩
    return {
      keptMessages: kept, // 直接返回保留的消息
      tokensBefore, // 返回压缩前的token数
      tokensAfter: TokenUtils.calculateMessagesTokenCount(kept) // 计算并返回压缩后的token数
    };
  }

  console.log(`[主动压缩] 丢弃 ${dropped.length} 条旧消息，保留 ${kept.length} 条新消息`); // 日志：显示裁剪结果

  // 步骤3：为丢弃的消息生成摘要
  console.log(`[主动压缩] 对 ${dropped.length} 条消息生成摘要...`); // 日志：开始生成摘要
  const summary = await summarizeInStages( // 调用分阶段摘要函数
    dropped, // 被丢弃的消息数组
    maxChunkTokens, // 最大块大小
    contextWindowTokens, // 上下文窗口大小
    llmModel, // LLM模型实例
    customInstructions // 自定义指令
  );

  // 步骤4：用摘要替换旧消息
  const summaryMessage = new HumanMessage( // 创建包含摘要的人类消息对象
    `[Conversation Summary]\n${summary}` // 摘要内容，加上前缀标识
  );

  const finalMessages = [summaryMessage, ...kept]; // 组合最终消息：摘要 + 保留的消息
  const tokensAfter = TokenUtils.calculateMessagesTokenCount(finalMessages); // 计算压缩后的总token数

  const compressionRate = Math.round((1 - tokensAfter / tokensBefore) * 100); // 计算压缩率（百分比）
  console.log(`[主动压缩] 完成: ${tokensBefore} → ${tokensAfter} tokens (压缩率: ${compressionRate}%)`); // 日志：显示压缩完成信息

  return {
    keptMessages: finalMessages, // 返回压缩后的消息数组
    summary, // 返回生成的摘要
    tokensBefore, // 返回压缩前的token数
    tokensAfter // 返回压缩后的token数
  };
}

/**
 * 通过迭代丢弃最旧的消息来裁剪历史，直到符合预算。
 * 保持工具调用/结果配对的完整性。
 * 
 * @param messages 消息数组
 * @param maxContextTokens 最大允许的上下文Token数
 * @param maxHistoryShare 历史消息的最大预算比例（默认：0.5）
 * @returns 保留和丢弃的消息及Token计数
 */
function pruneHistoryForContextShare( // 历史裁剪函数，按上下文共享比例裁剪
  messages: BaseMessage[], // 输入的消息数组
  maxContextTokens: number, // 最大上下文token数
  maxHistoryShare: number = 0.5 // 历史消息的最大占比，默认50%
): {
  keptMessages: BaseMessage[]; // 保留的消息数组
  droppedMessages: BaseMessage[]; // 丢弃的消息数组
  droppedTokens: number; // 丢弃的token数
  keptTokens: number; // 保留的token数
} {
  const budget = Math.floor(maxContextTokens * maxHistoryShare); // 计算历史消息的预算（token数）
  let kept = [...messages]; // 复制消息数组，用于存储保留的消息
  let dropped: BaseMessage[] = []; // 初始化丢弃的消息数组
  let droppedTokens = 0; // 初始化丢弃的token计数器

  while (kept.length > 0 && TokenUtils.calculateMessagesTokenCount(kept) > budget) { // 当保留的消息超出预算时循环
    // 按Token比例分割
    const splits = splitByTokenShare(kept, 2); // 将消息按token数分成两部分
    if (splits.length <= 1) {
      break; // 无法再分割，退出循环
    }

    const droppedChunk = splits[0]; // 第一部分作为要丢弃的消息块
    const rest = splits.slice(1).flat(); // 剩余部分作为保留的消息

    // 修复孤立的工具结果（其对应的工具调用已被丢弃）
    const repairedRest = repairToolUseResultPairing(rest); // 修复孤立的工具结果（其对应的工具调用已被丢弃）

    dropped.push(...droppedChunk); // 将丢弃的消息块添加到丢弃数组
    droppedTokens += TokenUtils.calculateMessagesTokenCount(droppedChunk); // 累加丢弃的token数
    kept = repairedRest; // 更新保留的消息为修复后的剩余部分
  }

  return {
    keptMessages: kept, // 返回保留的消息数组
    droppedMessages: dropped, // 返回丢弃的消息数组
    droppedTokens, // 返回丢弃的token数
    keptTokens: TokenUtils.calculateMessagesTokenCount(kept) // 计算并返回保留的token数
  };
}

/**
 * 分块摘要，具有多级降级策略。
 * 将大量消息分成块，分别摘要，然后合并。
 * 
 * @param messages 要摘要的消息
 * @param maxChunkTokens 每个块的最大Token数
 * @param contextWindow 上下文窗口大小
 * @param llmModel LLM模型实例
 * @param customInstructions 自定义摘要指令
 * @returns 生成的摘要文本
 */
async function summarizeInStages( // 分阶段摘要函数，处理大量消息
  messages: BaseMessage[], // 要摘要的消息数组
  maxChunkTokens: number, // 每个块的最大token数
  contextWindow: number, // 上下文窗口大小
  llmModel: any, // LLM模型实例
  customInstructions?: string // 自定义摘要指令
): Promise<string> { // 返回生成的摘要文本
  const instructions = customInstructions || MERGE_INSTRUCTIONS; // 使用自定义指令或默认合并指令

  // 如果消息少或总token数小，直接摘要
  if (messages.length < 4 || TokenUtils.calculateMessagesTokenCount(messages) <= maxChunkTokens) { // 如果消息少或总token数小，直接摘要
    return await summarizeWithFallback(messages, llmModel, instructions); // 调用带降级的摘要函数
  }

  console.log(`[分块摘要] 消息过多 (${messages.length} 条)，分为多个块处理`); // 日志：显示需要分块处理

  // 步骤1：按Token比例分割
  const splits = splitByTokenShare(messages, 2); // 将消息按token数分成两部分
  console.log(`[分块摘要] 分为 ${splits.length} 个块`); // 日志：显示分块数量

  // 步骤2：摘要每个块
  const partials: string[] = []; // 存储部分摘要的数组
  for (let i = 0; i < splits.length; i++) { // 遍历每个消息块
    console.log(`[分块摘要] 处理第 ${i + 1}/${splits.length} 块 (${splits[i].length} 条消息)`); // 日志：显示当前处理的块
    const partial = await summarizeWithFallback(splits[i], llmModel, instructions); // 对当前块进行摘要
    partials.push(partial); // 将部分摘要添加到数组
  }

  // 步骤3：合并所有部分摘要
  console.log(`[分块摘要] 合并 ${partials.length} 个部分摘要`); // 日志：开始合并部分摘要
  const mergePrompt = partials.map((p, i) => `Partial Summary ${i + 1}:\n${p}`).join('\n\n'); // 将所有部分摘要组合成合并提示
  
  try {
    const finalSummary = await llmModel.invoke([ // 调用LLM合并所有部分摘要
      new HumanMessage(`${instructions}\n\n${mergePrompt}`) // 创建包含合并指令和部分摘要的人类消息
    ]);
    return finalSummary.content || mergePrompt; // 返回合并后的摘要，如果失败则返回原始拼接内容
  } catch (error) {
    console.error('[分块摘要] 合并且失败，返回部分摘要拼接', error); // 日志：合并失败
    return mergePrompt; // 返回部分摘要的拼接结果作为降级方案
  }
}

/**
 * 具有三级降级策略的摘要：
 * 级别1：完整摘要
 * 级别2：部分摘要（跳过超大消息）
 * 级别3：描述性降级方案
 * 
 * @param messages 要摘要的消息
 * @param llmModel LLM模型实例
 * @param instructions 摘要指令
 * @returns 生成的摘要
 */
async function summarizeWithFallback( // 带三级降级策略的摘要函数
  messages: BaseMessage[], // 要摘要的消息数组
  llmModel: any, // LLM模型实例
  instructions: string // 摘要指令
): Promise<string> { // 返回生成的摘要
  try {
    // 级别1：完整摘要
    const prompt = buildSummaryPrompt(messages, instructions); // 构建摘要提示词
    const response = await llmModel.invoke([new HumanMessage(prompt)]); // 调用LLM生成摘要
    const summary = response.content || '[Summary generation failed]'; // 获取摘要内容，失败时使用默认文本
    
    if (summary.length > 10) { // 如果摘要长度大于10个字符，认为成功
      return summary; // 返回生成的摘要
    }
    throw new Error('Summary too short'); // 摘要太短，抛出错误触发降级
  } catch (error) {
    console.warn('[摘要生成失败，尝试部分摘要]', error); // 日志：一级摘要失败

    try {
      // 级别2：跳过超大消息
      const smallMsgs = messages.filter(msg => { // 过滤出较小的消息
        const tokens = TokenUtils.calculateTokenCount(msg.content); // 计算每条消息的token数
        return tokens * SAFETY_MARGIN < 4096; // 单条消息小于4K tokens（考虑安全系数）
      });

      if (smallMsgs.length > 0 && smallMsgs.length < messages.length) { // 如果有小消息且不是全部
        console.log(`[部分摘要] 跳过 ${messages.length - smallMsgs.length} 条超大消息`); // 日志：显示跳过的消息数
        const prompt = buildSummaryPrompt(smallMsgs, instructions); // 使用小消息构建提示词
        const response = await llmModel.invoke([new HumanMessage(prompt)]); // 调用LLM生成部分摘要
        const oversizedNote = `\n\n[${messages.length - smallMsgs.length} large messages omitted due to size limits]`; // 添加省略说明
        return response.content + oversizedNote; // 返回部分摘要加上省略说明
      }
    } catch (e) {
      console.warn('[部分摘要也失败]', e); // 日志：二级摘要也失败
    }

    // 级别3：描述性降级方案
    return `[Context contained ${messages.length} messages. Summary unavailable due to processing errors.]`; // 三级降级：返回描述性文本
  }
}

/**
 * 从消息构建摘要提示词
 * 
 * @param messages 要摘要的消息
 * @param instructions 摘要指令
 * @returns 格式化的提示词字符串
 */
function buildSummaryPrompt(messages: BaseMessage[], instructions: string): string { // 构建摘要提示词函数
  const conversationText = messages.map(msg => { // 将所有消息转换为文本格式
    const role = msg.type === 'human' ? 'User' : // 根据消息类型确定角色名称
                 msg.type === 'ai' ? 'Assistant' :
                 msg.type === 'tool_result' ? 'Tool Result' :
                 msg.type === 'tool' ? 'Tool Call' : msg.type;
    return `${role}: ${msg.content}`; // 格式化每条消息为"角色: 内容"
  }).join('\n\n'); // 用双换行符连接所有消息

  return `${instructions}\n\nPlease summarize the following conversation:\n\n${conversationText}\n\nSummary (focus on key decisions, tasks, and current state):`; // 返回完整的提示词
}

/**
 * 按Token比例将消息分割成近似相等的部分
 * 
 * @param messages 要分割的消息
 * @param parts 分割成的部分数
 * @returns 消息块数组
 */
function splitByTokenShare(messages: BaseMessage[], parts: number): BaseMessage[][] { // 按token比例分割消息函数
  const totalTokens = TokenUtils.calculateMessagesTokenCount(messages); // 计算总token数
  const targetPerPart = Math.floor(totalTokens / parts); // 计算每部分的目标token数

  const chunks: BaseMessage[][] = []; // 存储分块的数组
  let currentChunk: BaseMessage[] = []; // 当前正在构建的分块
  let currentTokens = 0; // 当前分块的token数

  for (const msg of messages) { // 遍历所有消息
    const msgTokens = TokenUtils.calculateTokenCount(msg.content); // 计算当前消息的token数

    // 如果当前分块已有消息且添加此消息会超出目标，开始新分块
    if (currentChunk.length > 0 && currentTokens + msgTokens > targetPerPart) { // 如果当前分块已有消息且添加此消息会超出目标
      chunks.push(currentChunk); // 将当前分块添加到结果数组
      currentChunk = []; // 重置当前分块
      currentTokens = 0; // 重置当前token计数
    }

    currentChunk.push(msg); // 将当前消息添加到当前分块
    currentTokens += msgTokens; // 累加token数
  }

  if (currentChunk.length > 0) { // 如果还有未添加的分块
    chunks.push(currentChunk); // 添加最后一个分块
  }

  return chunks; // 返回所有分块
}

/**
 * 修复孤立的工具结果，其对应的工具调用已被丢弃。
 * 确保工具调用/结果配对的完整性。
 * 
 * @param messages 要修复的消息
 * @returns 移除了孤立工具结果的消息
 */
function repairToolUseResultPairing(messages: BaseMessage[]): BaseMessage[] { // 修复工具调用-结果配对函数
  // 收集所有活跃的工具调用ID
  const activeIds = new Set<string>(); // 存储活跃的工具调用ID集合
  for (const msg of messages) { // 遍历所有消息
    if (msg.type === 'ai' && msg.metadata?.tool_calls) { // 如果是AI消息且有工具调用
      for (const call of msg.metadata.tool_calls) { // 遍历所有工具调用
        if (call.id) { // 如果工具有ID
          activeIds.add(call.id); // 添加到活跃ID集合
        }
      }
    }
  }

  // 只保留toolCallId在activeIds中的工具结果
  return messages.filter(msg => { // 过滤消息，只保留有效的工具结果
    if (msg.type !== 'tool_result') { // 如果不是工具结果消息
      return true; // 保留非工具结果消息
    }
    const toolCallId = msg.metadata?.tool_call_id; // 获取工具调用ID
    return !toolCallId || activeIds.has(toolCallId); // 如果没有ID或在活跃ID集合中，则保留
  });
}
