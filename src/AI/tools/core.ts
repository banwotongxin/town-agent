/**
 * 工具调用核心类型定义
 * 参考 OpenClaw: src/agents/tools/common.ts
 */

import { z } from 'zod';

/**
 * 工具执行参数
 */
export interface ToolExecuteArgs {
  toolCallId: string;      // 工具调用的唯一ID
  params: unknown;         // LLM传入的参数
  signal?: AbortSignal;    // 中止信号
  onUpdate?: (progress: string) => void; // 进度更新回调
}

/**
 * 工具返回结果
 */
export interface AgentToolResult<T = unknown> {
  content: Array<{
    type: 'text' | 'image';
    text?: string;
    source?: {
      type: 'base64';
      media_type: string;
      data: string;
    };
  }>;
  details?: T;  // 结构化详情
}

/**
 * 基础工具接口（参考OpenClaw的AgentTool）
 */
export interface AgentTool<TParameters = any, TResult = unknown> {
  name: string;                    // 工具名称
  label?: string;                  // 显示标签
  description: string;             // 工具描述（给LLM看）
  parameters: z.ZodType<TParameters>; // JSON Schema格式的参数定义
  ownerOnly?: boolean;             // 是否仅限所有者使用
  displaySummary?: string;         // 显示摘要
  
  execute: (
    toolCallId: string,
    params: TParameters,
    signal?: AbortSignal,
    onUpdate?: (progress: string) => void
  ) => Promise<AgentToolResult<TResult>>;
}

/**
 * 通用工具类型别名
 */
export type AnyAgentTool = AgentTool<any, unknown>;

/**
 * 工具输入错误类
 */
export class ToolInputError extends Error {
  constructor(message: string, public paramName?: string) {
    super(message);
    this.name = 'ToolInputError';
  }
}
