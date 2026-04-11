/**
 * before_tool_call Hook 系统
 * 参考 OpenClaw: src/agents/pi-tools.before-tool-call.ts
 */

/**
 * Hook执行结果
 */
export type HookOutcome = 
  | { blocked: true; reason: string }     // 阻止执行
  | { blocked: false; params: unknown };  // 允许执行（可能修改了参数）

/**
 * before_tool_call Hook参数
 */
interface BeforeToolCallHookParams {
  toolName: string;
  params: unknown;
  toolCallId: string;
}

/**
 * 运行 before_tool_call Hook
 * 依次执行所有注册的Hook，任何一个阻止则立即返回
 */
export async function runBeforeToolCallHook(
  params: BeforeToolCallHookParams
): Promise<HookOutcome> {
  let currentParams = params.params;
  
  // ★ Hook 1: 循环检测
  const loopDetectionResult = await checkLoopDetection(params.toolName, params.toolCallId);
  if (loopDetectionResult.blocked) {
    return loopDetectionResult;
  }
  
  // ★ Hook 2: 插件注册的自定义Hook（预留扩展点）
  const pluginResult = await runPluginBeforeToolCallHook({
    ...params,
    params: currentParams,
  });
  if (pluginResult.blocked) {
    return pluginResult;
  }
  currentParams = pluginResult.params;
  
  // ★ Hook 3: 审批流程（危险操作需要审批）
  const approvalResult = await checkApprovalRequirement(params.toolName, currentParams);
  if (approvalResult.blocked) {
    return approvalResult;
  }
  
  return { blocked: false, params: currentParams };
}

/**
 * 循环检测Hook
 * 防止LLM反复调用同一工具造成死循环
 */
async function checkLoopDetection(
  toolName: string,
  toolCallId: string
): Promise<HookOutcome> {
  // TODO: 实现循环检测逻辑
  // 可以维护一个最近工具调用历史记录
  // 如果同一工具在短时间内被调用超过阈值，则阻止
  
  return { blocked: false, params: {} };
}

/**
 * 插件Hook（预留扩展点）
 */
async function runPluginBeforeToolCallHook(
  params: BeforeToolCallHookParams & { params: unknown }
): Promise<HookOutcome> {
  // TODO: 遍历所有注册的插件Hook
  // 每个Hook可以修改参数或阻止执行
  
  return { blocked: false, params: params.params };
}

/**
 * 审批流程Hook
 */
async function checkApprovalRequirement(
  toolName: string,
  params: unknown
): Promise<HookOutcome> {
  // TODO: 检查工具是否需要审批
  // 如果需要审批且未获得批准，则阻止执行
  
  return { blocked: false, params: params };
}
