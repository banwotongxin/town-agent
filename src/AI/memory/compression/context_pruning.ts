import { BaseMessage } from '../../agents/base_agent'; // 导入基础消息类型

/**
 * 上下文裁剪配置 - 第二层
 */
export interface PruningSettings { // 裁剪配置接口
  keepLastAssistants: number;    // 保留最近的助手消息数量（默认：3）
  softTrimRatio: number;         // 触发软裁剪的比例阈值（默认：0.3）
  hardClearRatio: number;        // 触发硬清除的比例阈值（默认：0.5）
  softTrimMaxChars: number;      // 软裁剪前的最大字符数（默认：4000）
  softTrimHeadChars: number;     // 软裁剪时保留的头部字符数（默认：1500）
  softTrimTailChars: number;     // 软裁剪时保留的尾部字符数（默认：1500）
  hardClearPlaceholder: string;  // 硬清除后的占位文本
}

/**
 * 默认裁剪配置
 */
export const DEFAULT_PRUNING_SETTINGS: PruningSettings = { // 默认裁剪配置
  keepLastAssistants: 3, // 保留最近3条助手消息
  softTrimRatio: 0.3, // 软裁剪阈值30%
  hardClearRatio: 0.5, // 硬清除阈值50%
  softTrimMaxChars: 4000, // 软裁剪最大字符数4000
  softTrimHeadChars: 1500, // 保留头部1500字符
  softTrimTailChars: 1500, // 保留尾部1500字符
  hardClearPlaceholder: '[Old tool result content cleared]' // 硬清除占位符
};

const CHARS_PER_TOKEN = 4; // 每个Token约等于4个字符

/**
 * 通过对旧的工具结果应用软裁剪和硬清除来裁剪上下文。
 * 这是一个轻量级操作，无需调用LLM。
 * 
 * @param messages 要裁剪的消息数组
 * @param settings 裁剪配置
 * @param contextWindowTokens 上下文窗口大小（Token数）
 * @returns 裁剪后的消息数组
 */
export function pruneContext( // 上下文裁剪函数
  messages: BaseMessage[], // 要裁剪的消息数组
  settings: PruningSettings = DEFAULT_PRUNING_SETTINGS, // 裁剪配置，使用默认值
  contextWindowTokens: number // 上下文窗口大小（tokens）
): BaseMessage[] { // 返回裁剪后的消息数组
  const charWindow = contextWindowTokens * CHARS_PER_TOKEN; // 计算字符窗口大小
  const totalChars = messages.reduce((sum, msg) => sum + msg.content.length, 0); // 计算总字符数
  const ratio = totalChars / charWindow; // 计算当前比例

  // 如果低于软裁剪阈值，无需裁剪
  if (ratio < settings.softTrimRatio) { // 如果低于软裁剪阈值
    return messages; // 无需裁剪，直接返回
  }

  console.log(`[上下文裁剪] 触发裁剪: 当前比例 ${ratio.toFixed(2)} > 阈值 ${settings.softTrimRatio}`); // 日志：显示触发裁剪

  // 查找保护边界（最后N条助手消息的截止索引）
  const cutoffIndex = findCutoffIndex(messages, settings.keepLastAssistants); // 查找保护边界索引
  if (cutoffIndex === null) { // 如果找不到边界
    return messages; // 找不到边界，跳过裁剪
  }

  // 第一条用户消息的位置（保护初始系统提示）
  const firstUserIdx = messages.findIndex(m => m.type === 'human'); // 查找第一条用户消息的索引
  const pruneStart = firstUserIdx < 0 ? messages.length : firstUserIdx; // 确定裁剪起始位置

  let result = [...messages]; // 复制消息数组作为结果
  let currentTotalChars = totalChars; // 当前总字符数

  // 阶段一：软裁剪
  console.log(`[上下文裁剪] 阶段一：软裁剪 (范围: ${pruneStart} - ${cutoffIndex})`); // 日志：开始软裁剪
  for (let i = pruneStart; i < cutoffIndex; i++) { // 遍历需要裁剪的消息
    const msg = result[i]; // 获取当前消息
    if (msg.type !== 'tool_result') { // 如果不是工具结果消息
      continue; // 跳过
    }

    if (msg.content.length > settings.softTrimMaxChars) { // 如果超过最大字符数
      const trimmed = softTrimToolResult( // 执行软裁剪
        msg.content, // 原始内容
        settings.softTrimMaxChars, // 最大字符数
        settings.softTrimHeadChars, // 头部保留字符数
        settings.softTrimTailChars // 尾部保留字符数
      );
      result[i] = { ...msg, content: trimmed }; // 更新消息内容
      currentTotalChars = result.reduce((sum, m) => sum + m.content.length, 0); // 重新计算总字符数
    }
  }

  const newRatio = currentTotalChars / charWindow; // 计算软裁剪后的比例
  console.log(`[上下文裁剪] 软裁剪后比例: ${newRatio.toFixed(2)}`); // 日志：显示软裁剪后比例

  if (newRatio < settings.hardClearRatio) { // 如果低于硬清除阈值
    return result; // 软裁剪已足够
  }

  // 阶段二：硬清除
  console.log(`[上下文裁剪] 阶段二：硬清除`); // 日志：开始硬清除
  for (let i = pruneStart; i < cutoffIndex; i++) { // 遍历需要清除的消息
    const msg = result[i]; // 获取当前消息
    if (msg.type !== 'tool_result') { // 如果不是工具结果消息
      continue; // 跳过
    }

    result[i] = { ...msg, content: settings.hardClearPlaceholder }; // 替换为占位符
    currentTotalChars = result.reduce((sum, m) => sum + m.content.length, 0); // 重新计算总字符数

    if (currentTotalChars / charWindow < settings.hardClearRatio) { // 如果达到目标比例
      break; // 达到目标，退出循环
    }
  }

  const finalRatio = currentTotalChars / charWindow; // 计算最终比例
  console.log(`[上下文裁剪] 完成: ${messages.length} -> ${result.length} 条消息, 最终比例: ${finalRatio.toFixed(2)}`); // 日志：显示裁剪完成

  return result; // 返回裁剪后的消息数组
}

/**
 * 查找保护最后N条助手消息的截止索引
 * 
 * @param messages 消息数组
 * @param keepLastN 从末尾开始保护的助手消息数量
 * @returns 第一个受保护的助手消息的索引，如果未找到则返回null
 */
function findCutoffIndex(messages: BaseMessage[], keepLastN: number): number | null {
  let count = 0;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].type === 'ai') {
      count++;
      if (count === keepLastN) {
        return i;
      }
    }
  }
  return null;
}

/**
 * 通过保留头部和尾部部分来软裁剪工具结果
 * 
 * @param content 原始内容
 * @param maxChars 允许的最大字符数
 * @param headChars 在开头保留的字符数
 * @param tailChars 在末尾保留的字符数
 * @returns 带指示器的裁剪后内容
 */
function softTrimToolResult(
  content: string,
  maxChars: number,
  headChars: number,
  tailChars: number
): string {
  if (content.length <= maxChars) { // 如果内容长度未超过限制
    return content; // 直接返回原始内容
  }

  const head = content.slice(0, headChars); // 截取头部内容
  const tail = content.slice(-tailChars); // 截取尾部内容
  
  return `${head}\n...\n${tail}\n\n[Tool result trimmed: kept first ${headChars} chars and last ${tailChars} chars of ${content.length} chars.]`; // 返回裁剪后的内容，包含说明
}
