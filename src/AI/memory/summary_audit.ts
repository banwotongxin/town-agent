import { BaseMessage } from '../agents/base_agent';

/**
 * Audit summary quality to ensure important information is preserved.
 * 
 * @param summary Generated summary text
 * @param originalMessages Original messages that were summarized
 * @returns Audit result with pass/fail status and issues
 */
export function auditSummaryQuality(
  summary: string,
  originalMessages: BaseMessage[]
): { passed: boolean; issues: string[]; retry: boolean } {
  const issues: string[] = [];

  // Check 1: Summary should not be empty or too short
  if (summary.trim().length < 50) {
    issues.push('summary_too_short');
  }

  // Check 2: Extract opaque identifiers from original messages and verify preservation
  // Simplified version - looks for UUIDs
  const identifierPattern = /\b[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\b/gi;
  const originalIds = new Set<string>();
  
  for (const msg of originalMessages) {
    const matches = msg.content.match(identifierPattern);
    if (matches) {
      matches.forEach(id => originalIds.add(id));
    }
  }

  let missingIds = 0;
  for (const id of originalIds) {
    if (!summary.includes(id)) {
      missingIds++;
    }
  }
  
  if (missingIds > 5) {
    issues.push(`too_many_missing_ids (${missingIds})`);
  }

  // Check 3: Verify recent user request is recorded
  const lastUserMsg = [...originalMessages].reverse().find(m => m.type === 'human');
  if (lastUserMsg) {
    const content = lastUserMsg.content.slice(0, 100);
    if (content.length > 20 && !summary.includes(content)) {
      issues.push('missing_recent_request');
    }
  }

  return {
    passed: issues.length === 0,
    issues,
    retry: issues.length > 1  // Only retry if multiple issues
  };
}
