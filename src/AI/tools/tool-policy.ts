/**
 * 工具策略系统
 * 参考 OpenClaw: src/agents/tool-policy.ts
 */

import { AnyAgentTool } from './core';

/**
 * 工具策略接口
 */
export interface ToolPolicyLike {
  allow?: string[];   // 允许的工具列表
  deny?: string[];    // 拒绝的工具列表
}

/**
 * 工具名称别名映射
 */
const TOOL_NAME_ALIASES: Record<string, string> = {
  bash: 'exec',
  'apply-patch': 'apply_patch',
};

/**
 * 标准化工具名称
 */
export function normalizeToolName(name: string): string {
  const normalized = name.toLowerCase();
  return TOOL_NAME_ALIASES[normalized] ?? normalized;
}

/**
 * 按策略过滤工具
 */
export function filterToolsByPolicy(
  tools: AnyAgentTool[],
  policy?: ToolPolicyLike
): AnyAgentTool[] {
  if (!policy) {
    return tools;
  }
  
  let filtered = tools;
  
  // 应用 deny 列表
  if (policy.deny && policy.deny.length > 0) {
    const denySet = new Set(policy.deny.map(normalizeToolName));
    filtered = filtered.filter(tool => !denySet.has(normalizeToolName(tool.name)));
  }
  
  // 应用 allow 列表（如果存在，只保留允许的工具）
  if (policy.allow && policy.allow.length > 0) {
    const allowSet = new Set(policy.allow.map(normalizeToolName));
    filtered = filtered.filter(tool => allowSet.has(normalizeToolName(tool.name)));
  }
  
  return filtered;
}

/**
 * 检查工具是否为 owner-only
 */
export function isOwnerOnlyTool(tool: AnyAgentTool): boolean {
  return tool.ownerOnly === true;
}

/**
 * 过滤掉 owner-only 工具（对非所有者）
 */
export function filterOwnerOnlyTools(
  tools: AnyAgentTool[],
  isOwner: boolean
): AnyAgentTool[] {
  if (isOwner) {
    return tools;
  }
  return tools.filter(tool => !isOwnerOnlyTool(tool));
}
