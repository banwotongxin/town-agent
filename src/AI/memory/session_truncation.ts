/**
 * Session truncation (Layer 7) - physically delete summarized message entries.
 * This helps control storage file size after compaction.
 * 
 * Note: Current implementation uses JSON arrays, not JSONL format.
 * This function is provided for future migration to JSONL if needed.
 */

/**
 * Truncate session entries after compaction by removing summarized messages.
 * 
 * @param entries All entries in session file (JSONL format)
 * @param firstKeptEntryId ID of the first entry to keep (from compaction result)
 * @returns Filtered entries with summarized messages removed
 */
export function truncateSessionAfterCompaction(
  entries: any[],
  firstKeptEntryId: string
): any[] {
  // Collect IDs of message entries to delete
  const summarizedIds = new Set<string>();
  let foundKeepPoint = false;

  for (const entry of entries) {
    if (entry.id === firstKeptEntryId) {
      foundKeepPoint = true;
      break;
    }
    if (entry.type === 'message' && !foundKeepPoint) {
      summarizedIds.add(entry.id);
    }
  }

  // Filter: only delete message type entries that were summarized
  return entries.filter(entry => {
    return entry.type !== 'message' || !summarizedIds.has(entry.id);
  });
}
