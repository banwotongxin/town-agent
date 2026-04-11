import { BaseMessage } from '../agents/base_agent';
import { TokenUtils } from './token_utils';
import { calculateMaxToolResultChars } from './tool_result_truncation';

/**
 * Compaction route decisions (Layer 4)
 */
export enum CompactionRoute {
  FITS = 'fits',                                    // No action needed
  COMPACT_ONLY = 'compact_only',                    // Only LLM compaction needed
  TRUNCATE_TOOL_RESULTS_ONLY = 'truncate_only',     // Only tool result truncation needed
  COMPACT_THEN_TRUNCATE = 'compact_then_truncate'   // Both compaction and truncation needed
}

/**
 * Configuration constants for preemptive compaction
 */
const SAFETY_MARGIN = 1.2;
const CHARS_PER_TOKEN = 4;
const TRUNCATION_BUFFER_TOKENS = 512;

/**
 * Decide compaction route before sending to LLM.
 * Estimates tokens and chooses the most efficient processing path.
 * 
 * @param messages Array of messages to send
 * @param systemPrompt System prompt text
 * @param userPrompt User's current input
 * @param contextTokenBudget Total context window in tokens
 * @param reserveTokens Tokens reserved for summarization overhead (default: 4096)
 * @returns Route decision with estimates
 */
export function decideCompactionRoute(
  messages: BaseMessage[],
  systemPrompt: string,
  userPrompt: string,
  contextTokenBudget: number,
  reserveTokens: number = 4096  // SUMMARIZATION_OVERHEAD
): {
  route: CompactionRoute;
  shouldCompact: boolean;
  estimatedTokens: number;
  overflowTokens: number;
} {
  // Estimate total tokens
  const estimatedTokens = (
    TokenUtils.calculateMessagesTokenCount(messages) +
    TokenUtils.calculateTokenCount(systemPrompt) +
    TokenUtils.calculateTokenCount(userPrompt)
  ) * SAFETY_MARGIN;

  const budget = contextTokenBudget - reserveTokens;
  const overflowTokens = Math.max(0, estimatedTokens - budget);

  // If no overflow, fits within budget
  if (overflowTokens <= 0) {
    return {
      route: CompactionRoute.FITS,
      shouldCompact: false,
      estimatedTokens,
      overflowTokens: 0
    };
  }

  console.log(`[预防性压缩] 检测到溢出: ${overflowTokens} tokens`);

  // Evaluate how much space can be freed by truncating tool results
  const reducible = estimateToolResultReduction(messages, contextTokenBudget);
  const overflowChars = overflowTokens * CHARS_PER_TOKEN;
  const bufferChars = TRUNCATION_BUFFER_TOKENS * CHARS_PER_TOKEN;
  const truncateThreshold = Math.max(
    overflowChars + bufferChars,
    overflowChars * 1.5
  );

  let route: CompactionRoute;
  if (reducible.maxReducibleChars <= 0) {
    // Can't reduce via truncation, must compact
    route = CompactionRoute.COMPACT_ONLY;
    console.log('[预防性压缩] 路由决策: 仅压缩 (无工具结果可截断)');
  } else if (reducible.maxReducibleChars >= truncateThreshold) {
    // Truncation alone is sufficient
    route = CompactionRoute.TRUNCATE_TOOL_RESULTS_ONLY;
    console.log(`[预防性压缩] 路由决策: 仅截断 (可释放 ${reducible.maxReducibleChars} chars)`);
  } else {
    // Need both compaction and truncation
    route = CompactionRoute.COMPACT_THEN_TRUNCATE;
    console.log(`[预防性压缩] 路由决策: 压缩+截断`);
  }

  return {
    route,
    shouldCompact: route === CompactionRoute.COMPACT_ONLY ||
                   route === CompactionRoute.COMPACT_THEN_TRUNCATE,
    estimatedTokens,
    overflowTokens
  };
}

/**
 * Estimate how many characters can be reduced by truncating oversized tool results
 * 
 * @param messages Array of messages
 * @param contextWindowTokens Context window size in tokens
 * @returns Maximum reducible characters
 */
function estimateToolResultReduction(
  messages: BaseMessage[],
  contextWindowTokens: number
): { maxReducibleChars: number } {
  const maxSingle = calculateMaxToolResultChars(contextWindowTokens);
  const toolResults = messages.filter(m => m.type === 'tool_result');

  const reducible = toolResults.reduce((sum, msg) => {
    if (msg.content.length > maxSingle) {
      return sum + (msg.content.length - maxSingle);
    }
    return sum;
  }, 0);

  return { maxReducibleChars: reducible };
}
