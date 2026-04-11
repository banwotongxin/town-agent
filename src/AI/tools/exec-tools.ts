/**
 * 命令执行工具
 * 参考 OpenClaw: src/agents/bash-tools.ts
 */

import { AgentTool, AgentToolResult } from './core';
import { exec } from 'child_process';
import { promisify } from 'util';
import { z } from 'zod';

const execAsync = promisify(exec);

/**
 * 执行命令工具
 */
export function createExecTool(options?: {
  allowedCommands?: string[];
  timeout?: number;
}): AgentTool<{ command: string }, string> {
  const allowedCommands = options?.allowedCommands || [];
  const timeout = options?.timeout || 30000;
  
  return {
    name: 'exec',
    label: '执行命令',
    description: '在shell中执行命令并返回输出',
    ownerOnly: true,
    parameters: z.object({
      command: z.string().describe('要执行的命令'),
    }),
    
    async execute(toolCallId, params, signal) {
      // 命令白名单检查
      if (allowedCommands.length > 0) {
        const cmd = params.command.split(' ')[0];
        if (!allowedCommands.includes(cmd)) {
          throw new Error(`命令 "${cmd}" 不在允许列表中`);
        }
      }
      
      const { stdout, stderr } = await execAsync(params.command, {
        timeout,
        signal,
      });
      
      let output = stdout;
      if (stderr) {
        output += `\n[STDERR]\n${stderr}`;
      }
      
      return {
        content: [{ type: 'text', text: output }],
      };
    },
  };
}
