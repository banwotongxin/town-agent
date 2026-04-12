import { AgentState } from '../agent_graph'; // 导入智能体状态接口，包含消息、用户输入、记忆上下文等字段
import { DualMemorySystem } from '../../memory/storage/dual_memory'; // 导入双记忆系统类，用于管理短期和长期记忆

/**
 * 记忆查询节点函数
 * 负责从记忆系统中检索与当前用户输入相关的历史信息
 * 
 * @param state 智能体状态对象，包含用户输入、消息历史、记忆上下文等信息
 * @param memorySystem 双记忆系统实例，用于查询短期记忆、会话记忆和长期记忆
 * @param agentId 智能体ID，用于标识是哪个角色的记忆
 * @returns 更新后的智能体状态，state.memory_context 字段会被填充查询到的记忆内容
 */
export async function memoryQueryNode(
  state: AgentState, // 智能体的当前状态，包含用户输入和需要更新的记忆上下文字段
  memorySystem?: DualMemorySystem, // 可选的记忆系统实例，如果未提供则尝试动态获取
  agentId?: string // 可选的智能体ID，用于确定查询哪个角色的记忆
): Promise<AgentState> {
  // 输出调试日志，标记记忆查询开始
  console.log('[记忆查询节点] 开始执行记忆查询...');
  
  // 检查用户输入是否有效，如果为空则跳过记忆查询
  if (!state.user_input || state.user_input.trim().length === 0) {
    // 记录日志：用户输入为空，无需查询记忆
    console.log('[记忆查询节点] 用户输入为空，跳过记忆查询步骤');
    return state; // 直接返回原始状态，不做任何修改
  }
  
  try {
    // 检查是否提供了记忆系统实例
    if (memorySystem) {
      // 情况1：记忆系统已通过参数传入，直接使用
      console.log(`[记忆查询节点] 使用传入的记忆系统实例`);
      
      // 调用双记忆系统的 getContext 方法获取相关记忆上下文
      // 这个方法会综合短期记忆、会话记忆摘要和长期记忆（知识库）
      const context = await memorySystem.getContext(state.user_input);
      
      // 将查询到的记忆上下文保存到状态中
      state.memory_context = context;
      
      // 记录日志：显示获取到的记忆上下文长度
      console.log(`[记忆查询节点] 成功获取记忆上下文，长度: ${context.length} 字符`);
      
      // 如果有记忆上下文，截取前100个字符用于日志展示
      if (context && context.length > 0) {
        const preview = context.substring(0, 100).replace(/\n/g, ' ');
        console.log(`[记忆查询节点] 记忆预览: "${preview}${context.length > 100 ? '...' : ''}"`);
      }
    } else {
      // 情况2：记忆系统未传入，记录警告信息
      // 这种情况通常发生在独立调用此节点时，实际使用中应该通过 AgentGraph 调用
      console.warn('[记忆查询节点] 未提供记忆系统实例，无法查询记忆');
      console.warn('[记忆查询节点] 提示：此节点应该在 AgentGraph.queryMemoryNode 中被调用');
      
      // 保持 memory_context 为空字符串，不影响后续流程
      state.memory_context = state.memory_context || '';
    }
    
  } catch (error) {
    // 捕获记忆查询过程中可能发生的错误
    // 错误不会中断整个流程，只是记录日志并继续执行
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[记忆查询节点] 查询记忆时发生错误:', errorMessage);
    
    // 发生错误时，将记忆上下文设置为空字符串，避免影响后续处理
    state.memory_context = '';
  }
  
  // 返回更新后的状态
  // 如果查询成功，state.memory_context 包含相关记忆；如果失败或跳过，则为空字符串
  return state;
}
