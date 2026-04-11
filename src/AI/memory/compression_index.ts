/**
 * Context Compression Module Exports
 * 
 * Seven-layer defense system for AI agent context management
 */

// Layer 1: Context Engine Interface
export {
  ContextEngine,
  CompactResult,
  ContextEngineRegistry,
  LegacyContextEngine,
  getContextEngineRegistry
} from './context_engine';

// Layer 2: Context Pruning
export {
  pruneContext,
  PruningSettings,
  DEFAULT_PRUNING_SETTINGS
} from './context_pruning';

// Layer 3: Tool Result Truncation
export {
  truncateToolResult,
  calculateMaxToolResultChars,
  truncateAggregateToolResults
} from './tool_result_truncation';

// Layer 4: Preemptive Compaction
export {
  decideCompactionRoute,
  CompactionRoute
} from './preemptive_compaction';

// Layer 5: Active Compaction (Core)
export {
  activeCompact
} from './active_compaction';

// Layer 6: Summary Quality Audit
export {
  auditSummaryQuality
} from './summary_audit';

// Layer 7: Session Truncation
export {
  truncateSessionAfterCompaction
} from './session_truncation';

// Enhanced Token Utilities
export {
  TokenUtils
} from './token_utils';
