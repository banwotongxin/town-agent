import { BaseMessage } from '../agents/base_agent';

/**
 * Configuration for context pruning (Layer 2)
 */
export interface PruningSettings {
  keepLastAssistants: number;    // Number of recent assistant messages to protect (default: 3)
  softTrimRatio: number;         // Trigger soft trim when ratio exceeds this (default: 0.3)
  hardClearRatio: number;        // Trigger hard clear when ratio exceeds this (default: 0.5)
  softTrimMaxChars: number;      // Maximum chars before soft trimming (default: 4000)
  softTrimHeadChars: number;     // Characters to keep at head during soft trim (default: 1500)
  softTrimTailChars: number;     // Characters to keep at tail during soft trim (default: 1500)
  hardClearPlaceholder: string;  // Placeholder text for hard-cleared content
}

/**
 * Default pruning settings
 */
export const DEFAULT_PRUNING_SETTINGS: PruningSettings = {
  keepLastAssistants: 3,
  softTrimRatio: 0.3,
  hardClearRatio: 0.5,
  softTrimMaxChars: 4000,
  softTrimHeadChars: 1500,
  softTrimTailChars: 1500,
  hardClearPlaceholder: '[Old tool result content cleared]'
};

const CHARS_PER_TOKEN = 4;

/**
 * Prune context by applying soft trimming and hard clearing to old tool results.
 * This is a lightweight operation with zero LLM calls.
 * 
 * @param messages Array of messages to prune
 * @param settings Pruning configuration
 * @param contextWindowTokens Context window size in tokens
 * @returns Pruned messages array
 */
export function pruneContext(
  messages: BaseMessage[],
  settings: PruningSettings = DEFAULT_PRUNING_SETTINGS,
  contextWindowTokens: number
): BaseMessage[] {
  const charWindow = contextWindowTokens * CHARS_PER_TOKEN;
  const totalChars = messages.reduce((sum, msg) => sum + msg.content.length, 0);
  const ratio = totalChars / charWindow;

  // If below soft trim threshold, no pruning needed
  if (ratio < settings.softTrimRatio) {
    return messages;
  }

  console.log(`[上下文裁剪] 触发裁剪: 当前比例 ${ratio.toFixed(2)} > 阈值 ${settings.softTrimRatio}`);

  // Find protection boundary (cutoff index for last N assistant messages)
  const cutoffIndex = findCutoffIndex(messages, settings.keepLastAssistants);
  if (cutoffIndex === null) {
    return messages; // Can't find boundary, skip pruning
  }

  // First user message position (protect initial system prompt)
  const firstUserIdx = messages.findIndex(m => m.type === 'human');
  const pruneStart = firstUserIdx < 0 ? messages.length : firstUserIdx;

  let result = [...messages];
  let currentTotalChars = totalChars;

  // Phase 1: Soft trimming
  console.log(`[上下文裁剪] 阶段一：软裁剪 (范围: ${pruneStart} - ${cutoffIndex})`);
  for (let i = pruneStart; i < cutoffIndex; i++) {
    const msg = result[i];
    if (msg.type !== 'tool_result') {
      continue;
    }

    if (msg.content.length > settings.softTrimMaxChars) {
      const trimmed = softTrimToolResult(
        msg.content,
        settings.softTrimMaxChars,
        settings.softTrimHeadChars,
        settings.softTrimTailChars
      );
      result[i] = { ...msg, content: trimmed };
      currentTotalChars = result.reduce((sum, m) => sum + m.content.length, 0);
    }
  }

  const newRatio = currentTotalChars / charWindow;
  console.log(`[上下文裁剪] 软裁剪后比例: ${newRatio.toFixed(2)}`);

  if (newRatio < settings.hardClearRatio) {
    return result; // Soft trimming was sufficient
  }

  // Phase 2: Hard clearing
  console.log(`[上下文裁剪] 阶段二：硬清除`);
  for (let i = pruneStart; i < cutoffIndex; i++) {
    const msg = result[i];
    if (msg.type !== 'tool_result') {
      continue;
    }

    result[i] = { ...msg, content: settings.hardClearPlaceholder };
    currentTotalChars = result.reduce((sum, m) => sum + m.content.length, 0);

    if (currentTotalChars / charWindow < settings.hardClearRatio) {
      break; // Reached target ratio
    }
  }

  const finalRatio = currentTotalChars / charWindow;
  console.log(`[上下文裁剪] 完成: ${messages.length} -> ${result.length} 条消息, 最终比例: ${finalRatio.toFixed(2)}`);

  return result;
}

/**
 * Find the cutoff index protecting the last N assistant messages
 * 
 * @param messages Array of messages
 * @param keepLastN Number of assistant messages to protect from end
 * @returns Index of the first protected assistant message, or null if not found
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
 * Soft trim a tool result by keeping head and tail portions
 * 
 * @param content Original content
 * @param maxChars Maximum characters allowed
 * @param headChars Characters to keep at the beginning
 * @param tailChars Characters to keep at the end
 * @returns Trimmed content with indicator
 */
function softTrimToolResult(
  content: string,
  maxChars: number,
  headChars: number,
  tailChars: number
): string {
  if (content.length <= maxChars) {
    return content;
  }

  const head = content.slice(0, headChars);
  const tail = content.slice(-tailChars);
  
  return `${head}\n...\n${tail}\n\n[Tool result trimmed: kept first ${headChars} chars and last ${tailChars} chars of ${content.length} chars.]`;
}
