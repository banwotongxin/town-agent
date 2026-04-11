/**
 * 工具调用节点
 * 参考 OpenClaw 的工具执行流程
 * 
 * 负责执行LLM决定的工具调用
 */

// 导入代理状态类型定义
import { AgentState } from '../agent_graph';

/**
 * 工具调用节点
 * 负责执行LLM决定的工具调用
 */
export async function toolInvokeNode(state: AgentState): Promise<AgentState> {
  // 检查是否有工具调用，如果没有则直接返回当前状态
  if (!(state as any).tool_calls || (state as any).tool_calls.length === 0) {
    return state;
  }
  
  // 输出日志信息，显示即将执行的工具调用数量
  console.log(`[工具调用] 开始执行 ${(state as any).tool_calls.length} 个工具调用`);
  
  // 初始化工具结果数组，用于存储所有工具调用的结果
  const toolResults = [];
  
  // 遍历所有的工具调用请求
  for (const toolCall of (state as any).tool_calls) {
    try {
      // 1. 从注册表获取工具定义
      const toolDef = (state as any).tool_registry?.getTool(toolCall.name);
      
      // 如果找不到对应的工具定义，记录错误信息并继续下一个工具调用
      if (!toolDef) {
        toolResults.push({
          tool_call_id: toolCall.id,  // 工具调用ID
          content: `错误：未找到工具 "${toolCall.name}"`,  // 错误信息
        });
        continue;  // 跳过当前循环，处理下一个工具调用
      }
      
      // 2. 解析工具调用参数，如果是字符串则转换为JSON对象
      const params = typeof toolCall.arguments === 'string' 
        ? JSON.parse(toolCall.arguments)
        : toolCall.arguments;
      
      // 3. 执行工具（通过adapter包装，自动包含Hook）
      const result = await toolDef.execute(
        toolCall.id,     // 工具调用ID
        params,          // 工具参数
        undefined,       // signal - 信号量，用于取消操作
        undefined        // onUpdate - 更新回调函数
      );
      
      // 4. 提取文本类型的结果内容
      const textContent = result.content
        .filter((c: any) => c.type === 'text')  // 过滤出文本类型的内容
        .map((c: any) => c.text)                // 提取文本内容
        .join('\n');                            // 用换行符连接多个文本片段
      
      // 将工具调用结果添加到结果数组中
      toolResults.push({
        tool_call_id: toolCall.id,  // 工具调用ID
        content: textContent,       // 工具执行的文本结果
      });
      
      // 输出成功日志
      console.log(`[工具调用] ${toolCall.name} 执行成功`);
      
    } catch (error) {
      // 捕获并处理工具执行过程中的异常
      console.error(`[工具调用] ${toolCall.name} 执行失败:`, error);
      // 将错误信息添加到结果数组中
      toolResults.push({
        tool_call_id: toolCall.id,  // 工具调用ID
        content: `工具执行失败: ${error instanceof Error ? error.message : String(error)}`,  // 错误详情
      });
    }
  }
  
  // 将所有工具调用结果保存到状态中
  (state as any).tool_results = toolResults;
  
  // 返回更新后的状态
  return state;
}
