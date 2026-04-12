import { BaseMessage } from '../../agents/base_agent';

/**
 * 工具结果截断的配置常量 - 第三层
 */
const MAX_TOOL_RESULT_SHARE = 0.3; // 单个工具结果占上下文窗口的最大比例
const CHARS_PER_TOKEN = 4; // 每个Token的字符数
const MAX_LIVE_TOOL_RESULT_CHARS = 40000; // 绝对上限
const MIN_KEEP_CHARS = 2000; // 截断时保留的最小字符数

/**
 * 智能截断单个工具输出。
 * 如果尾部包含重要内容（错误、JSON结尾），则保留头部+尾部。
 * 否则，只保留头部。
 * 
 * @param text 工具结果内容
 * @param maxChars 要保留的最大字符数
 * @param minKeep 要保留的最小字符数
 * @returns 带后缀的截断文本，指示已删除的内容
 */
export function truncateToolResult(
  text: string,
  maxChars: number,
  minKeep: number = MIN_KEEP_CHARS
): string {
  if (text.length <= maxChars) {
    return text;
  }

  const suffix = `\n\n[Truncated: ${text.length - maxChars} chars removed]`; // 添加截断后缀
  const budget = Math.max(minKeep, maxChars - suffix.length); // 计算可用预算

  // 检测尾部是否包含重要内容
  const tail2000 = text.slice(-2000).toLowerCase(); // 获取最后2000个字符并转为小写
  const hasImportantTail = (
    /\b(error|exception|failed|fatal|traceback|panic)\b/.test(tail2000) || // 检查是否包含错误关键词
    /\}\s*$/.test(tail2000.trim()) || // JSON ending - JSON结尾
    /\b(total|summary|result|complete|done)\b/.test(tail2000) // 检查是否包含总结关键词
  );

  if (hasImportantTail && budget > minKeep * 2) {
    // 头部+尾部保留策略（70%头部，30%尾部）
    const marker = '\n\n[... middle content omitted ...]\n\n'; // 中间内容省略标记
    const tailBudget = Math.min(Math.floor(budget / 3), 4000); // 尾部预算
    const headBudget = budget - tailBudget - marker.length; // 头部预算

    const headCut = findNewlineBoundary(text, headBudget); // 查找头部换行边界
    const tailStart = findNewlineBoundaryReverse(text, text.length - tailBudget); // 查找尾部换行边界

    return text.slice(0, headCut) + marker + text.slice(tailStart) + suffix; // 返回头部+标记+尾部+后缀
  }

  // 默认：只保留头部
  const cut = findNewlineBoundary(text, budget); // 查找换行边界
  return text.slice(0, cut) + suffix; // 返回截断后的文本
}

/**
 * 根据上下文窗口计算单个工具结果的最大字符数
 * 
 * @param contextWindowTokens 上下文窗口大小（Token数）
 * @returns 单个工具结果允许的最大字符数
 */
export function calculateMaxToolResultChars(contextWindowTokens: number): number {
  const maxTokens = Math.floor(contextWindowTokens * MAX_TOOL_RESULT_SHARE);
  const maxChars = maxTokens * CHARS_PER_TOKEN;
  return Math.min(maxChars, MAX_LIVE_TOOL_RESULT_CHARS);
}

/**
 * 聚合预算截断：当多个工具结果累计超出预算时，
 * 从最旧到最新进行截断。
 * 
 * @param messages 消息数组
 * @param contextWindowTokens 上下文窗口大小（Token数）
 * @returns 截断工具结果后的消息数组
 */
export function truncateAggregateToolResults(
  messages: BaseMessage[],
  contextWindowTokens: number
): BaseMessage[] {
  const maxSingle = calculateMaxToolResultChars(contextWindowTokens); // 计算单个工具结果的最大字符数
  const aggregateBudget = Math.max(maxSingle, 2000); // 恢复模式聚合预算

  // 查找所有工具结果消息及其索引
  const toolResults = messages
    .map((msg, idx) => ({ idx, msg })) // 映射为带索引的对象
    .filter(({ msg }) => msg.type === 'tool_result'); // 过滤出工具结果消息

  // 计算总字符数
  const totalChars = toolResults.reduce(
    (sum, { msg }) => sum + msg.content.length, // 累加所有工具结果的字符数
    0
  );

  // 如果在预算内或工具结果太少，无需截断
  if (totalChars <= aggregateBudget || toolResults.length < 2) {
    return messages; // 返回原始消息
  }

  // 从最旧（最小索引）开始截断
  const result = [...messages]; // 复制消息数组
  let reductionNeeded = totalChars - aggregateBudget; // 计算需要减少的字符数

  for (const { idx, msg } of toolResults) { // 遍历所有工具结果
    if (reductionNeeded <= 0) {
      break; // 已达到目标，退出循环
    }

    const originalLength = msg.content.length; // 原始长度
    const newContent = truncateToolResult(msg.content, maxSingle); // 截断工具结果
    const saved = originalLength - newContent.length; // 节省的字符数

    if (saved > 0) {
      result[idx] = { ...msg, content: newContent }; // 更新消息内容
      reductionNeeded -= saved; // 减少所需减少的字符数
    }
  }

  return result; // 返回截断后的消息数组
}

/**
 * 辅助函数：从目标索引向前查找换行边界
 * 确保我们不会在行的中间切断
 * 
 * @param text 要搜索的文本
 * @param targetIndex 目标位置
 * @returns 在目标位置或之前出现换行的索引
 */
function findNewlineBoundary(text: string, targetIndex: number): number {
  if (targetIndex >= text.length) {
    return text.length;
  }

  // 向后搜索最近的换行符
  for (let i = targetIndex; i >= 0; i--) {
    if (text[i] === '\n') {
      return i + 1; // 返回换行符后的位置
    }
  }
  return targetIndex; // 如果没找到，返回目标位置
}

/**
 * 辅助函数：从目标索引向后查找换行边界
 * 
 * @param text 要搜索的文本
 * @param targetIndex 目标位置
 * @returns 在目标位置或之后出现换行的索引
 */
function findNewlineBoundaryReverse(text: string, targetIndex: number): number {
  if (targetIndex <= 0) {
    return 0;
  }

  // 向前搜索最近的换行符
  for (let i = targetIndex; i < text.length; i++) {
    if (text[i] === '\n') {
      return i + 1; // 返回换行符后的位置
    }
  }
  return targetIndex; // 如果没找到，返回目标位置
}
