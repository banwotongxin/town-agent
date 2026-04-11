/**
 * 工具组定义
 * 参考 OpenClaw: src/agents/tool-policy-shared.ts
 */

/**
 * 预定义工具组
 * 方便在策略中一次性引用多个工具
 */
export const TOOL_GROUPS: Record<string, string[]> = {
  // 文件系统工具
  fs: ['read', 'write', 'edit', 'apply_patch'],
  
  // 运行时工具
  runtime: ['exec', 'process'],
  
  // Web工具
  web: ['web_search', 'web_fetch'],
  
  // 会话管理工具
  sessions: [
    'sessions_list',
    'sessions_history',
    'sessions_send',
    'sessions_spawn',
  ],
  
  // 所有内置工具
  all: [
    'read', 'write', 'exec',
    // TODO: 添加更多工具
  ],
};

/**
 * 展开工具组
 */
export function expandToolGroups(names: string[]): string[] {
  const expanded: string[] = [];
  
  for (const name of names) {
    if (name in TOOL_GROUPS) {
      expanded.push(...TOOL_GROUPS[name]);
    } else {
      expanded.push(name);
    }
  }
  
  return [...new Set(expanded)];  // 去重
}
