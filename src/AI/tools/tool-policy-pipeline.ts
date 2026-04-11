/**
 * 工具策略管线
 * 参考 OpenClaw: src/agents/tool-policy-pipeline.ts
 */

import { AnyAgentTool } from './core';
import { ToolPolicyLike, filterToolsByPolicy } from './tool-policy';

/**
 * 策略管线步骤
 */
interface ToolPolicyPipelineStep {
  policy: ToolPolicyLike | undefined;
  label: string;  // 策略标签（用于日志）
}

/**
 * 策略管线参数
 */
interface ToolPolicyPipelineParams {
  tools: AnyAgentTool[];
  steps: ToolPolicyPipelineStep[];
}

/**
 * 应用策略管线
 * 按顺序应用多层策略过滤
 */
export function applyToolPolicyPipeline(
  params: ToolPolicyPipelineParams
): AnyAgentTool[] {
  let filtered = params.tools;
  
  for (const step of params.steps) {
    const beforeCount = filtered.length;
    filtered = filterToolsByPolicy(filtered, step.policy);
    const afterCount = filtered.length;
    
    if (beforeCount !== afterCount) {
      console.log(`[策略管线] ${step.label}: ${beforeCount} → ${afterCount} 个工具`);
    }
  }
  
  return filtered;
}

/**
 * 构建默认策略管线步骤
 */
export function buildDefaultToolPolicyPipelineSteps(params: {
  profilePolicy?: ToolPolicyLike;
  globalPolicy?: ToolPolicyLike;
  agentPolicy?: ToolPolicyLike;
  groupPolicy?: ToolPolicyLike;
  subagentPolicy?: ToolPolicyLike;
}): ToolPolicyPipelineStep[] {
  return [
    { policy: params.profilePolicy, label: 'tools.profile' },
    { policy: params.globalPolicy, label: 'tools.global' },
    { policy: params.agentPolicy, label: 'tools.agent' },
    { policy: params.groupPolicy, label: 'tools.group' },
    { policy: params.subagentPolicy, label: 'tools.subagent' },
  ];
}
