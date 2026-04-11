import { BaseMessage } from '../agents/base_agent';

/**
 * Configuration constants for tool result truncation (Layer 3)
 */
const MAX_TOOL_RESULT_SHARE = 0.3; // Single tool result max share of context window
const CHARS_PER_TOKEN = 4;
const MAX_LIVE_TOOL_RESULT_CHARS = 40000; // Absolute upper limit
const MIN_KEEP_CHARS = 2000; // Minimum chars to keep when truncating

/**
 * Intelligently truncate a single tool output.
 * If the tail contains important content (errors, JSON endings), preserve head + tail.
 * Otherwise, only preserve the head.
 * 
 * @param text The tool result content
 * @param maxChars Maximum characters to keep
 * @param minKeep Minimum characters to preserve
 * @returns Truncated text with suffix indicating removal
 */
export function truncateToolResult(
  text: string,
  maxChars: number,
  minKeep: number = MIN_KEEP_CHARS
): string {
  if (text.length <= maxChars) {
    return text;
  }

  const suffix = `\n\n[Truncated: ${text.length - maxChars} chars removed]`;
  const budget = Math.max(minKeep, maxChars - suffix.length);

  // Detect if tail contains important content
  const tail2000 = text.slice(-2000).toLowerCase();
  const hasImportantTail = (
    /\b(error|exception|failed|fatal|traceback|panic)\b/.test(tail2000) ||
    /\}\s*$/.test(tail2000.trim()) || // JSON ending
    /\b(total|summary|result|complete|done)\b/.test(tail2000)
  );

  if (hasImportantTail && budget > minKeep * 2) {
    // Head + tail preservation strategy (70% head, 30% tail)
    const marker = '\n\n[... middle content omitted ...]\n\n';
    const tailBudget = Math.min(Math.floor(budget / 3), 4000);
    const headBudget = budget - tailBudget - marker.length;

    const headCut = findNewlineBoundary(text, headBudget);
    const tailStart = findNewlineBoundaryReverse(text, text.length - tailBudget);

    return text.slice(0, headCut) + marker + text.slice(tailStart) + suffix;
  }

  // Default: only preserve head
  const cut = findNewlineBoundary(text, budget);
  return text.slice(0, cut) + suffix;
}

/**
 * Calculate maximum characters for a single tool result based on context window
 * 
 * @param contextWindowTokens Context window size in tokens
 * @returns Maximum characters allowed for a single tool result
 */
export function calculateMaxToolResultChars(contextWindowTokens: number): number {
  const maxTokens = Math.floor(contextWindowTokens * MAX_TOOL_RESULT_SHARE);
  const maxChars = maxTokens * CHARS_PER_TOKEN;
  return Math.min(maxChars, MAX_LIVE_TOOL_RESULT_CHARS);
}

/**
 * Aggregate budget truncation: When multiple tool results cumulatively exceed budget,
 * truncate from oldest to newest.
 * 
 * @param messages Array of messages
 * @param contextWindowTokens Context window size in tokens
 * @returns Messages with truncated tool results
 */
export function truncateAggregateToolResults(
  messages: BaseMessage[],
  contextWindowTokens: number
): BaseMessage[] {
  const maxSingle = calculateMaxToolResultChars(contextWindowTokens);
  const aggregateBudget = Math.max(maxSingle, 2000); // Recovery mode aggregate budget

  // Find all tool_result messages with their indices
  const toolResults = messages
    .map((msg, idx) => ({ idx, msg }))
    .filter(({ msg }) => msg.type === 'tool_result');

  // Calculate total characters
  const totalChars = toolResults.reduce(
    (sum, { msg }) => sum + msg.content.length,
    0
  );

  // If within budget or too few tool results, no truncation needed
  if (totalChars <= aggregateBudget || toolResults.length < 2) {
    return messages;
  }

  // Truncate from oldest (smallest index) first
  const result = [...messages];
  let reductionNeeded = totalChars - aggregateBudget;

  for (const { idx, msg } of toolResults) {
    if (reductionNeeded <= 0) {
      break;
    }

    const originalLength = msg.content.length;
    const newContent = truncateToolResult(msg.content, maxSingle);
    const saved = originalLength - newContent.length;

    if (saved > 0) {
      result[idx] = { ...msg, content: newContent };
      reductionNeeded -= saved;
    }
  }

  return result;
}

/**
 * Helper: Find newline boundary moving forward from target index
 * Ensures we don't cut in the middle of a line
 * 
 * @param text The text to search
 * @param targetIndex Target position
 * @returns Index at or before target where newline occurs
 */
function findNewlineBoundary(text: string, targetIndex: number): number {
  if (targetIndex >= text.length) {
    return text.length;
  }

  // Search backward for nearest newline
  for (let i = targetIndex; i >= 0; i--) {
    if (text[i] === '\n') {
      return i + 1;
    }
  }
  return targetIndex;
}

/**
 * Helper: Find newline boundary moving backward from target index
 * 
 * @param text The text to search
 * @param targetIndex Target position
 * @returns Index at or after target where newline occurs
 */
function findNewlineBoundaryReverse(text: string, targetIndex: number): number {
  if (targetIndex <= 0) {
    return 0;
  }

  // Search forward for nearest newline
  for (let i = targetIndex; i < text.length; i++) {
    if (text[i] === '\n') {
      return i + 1;
    }
  }
  return targetIndex;
}
