/**
 * 文件操作工具
 * 参考 OpenClaw: src/agents/pi-tools.read.ts
 */

import { AgentTool, AgentToolResult } from './core';
import * as fs from 'fs/promises';
import * as path from 'path';
import { z } from 'zod';

/**
 * 读取文件工具
 */
export function createReadTool(options?: {
  workspaceRoot?: string;
}): AgentTool<{ file_path: string }, { file_path: string; size: number }> {
  const workspaceRoot = options?.workspaceRoot || process.cwd();
  
  return {
    name: 'read',
    label: '读取文件',
    description: '读取指定路径的文件内容',
    parameters: z.object({
      file_path: z.string().describe('文件路径'),
    }),
    
    async execute(toolCallId, params) {
      // 工作区根目录保护
      const fullPath = path.resolve(workspaceRoot, params.file_path);
      if (!fullPath.startsWith(workspaceRoot)) {
        throw new Error(`拒绝访问：路径 ${params.file_path} 超出工作区范围`);
      }
      
      const content = await fs.readFile(fullPath, 'utf-8');
      
      return {
        content: [{ type: 'text', text: content }],
        details: { file_path: fullPath, size: content.length },
      };
    },
  };
}

/**
 * 写入文件工具
 */
export function createWriteTool(options?: {
  workspaceRoot?: string;
}): AgentTool<{ file_path: string; content: string }, void> {
  const workspaceRoot = options?.workspaceRoot || process.cwd();
  
  return {
    name: 'write',
    label: '写入文件',
    description: '向指定路径写入文件内容',
    ownerOnly: true,  // 仅所有者可用
    parameters: z.object({
      file_path: z.string().describe('文件路径'),
      content: z.string().describe('文件内容'),
    }),
    
    async execute(toolCallId, params) {
      const fullPath = path.resolve(workspaceRoot, params.file_path);
      if (!fullPath.startsWith(workspaceRoot)) {
        throw new Error(`拒绝写入：路径 ${params.file_path} 超出工作区范围`);
      }
      
      await fs.writeFile(fullPath, params.content, 'utf-8');
      
      return {
        content: [{ type: 'text', text: `文件已写入：${fullPath}` }],
      };
    },
  };
}
