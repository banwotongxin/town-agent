import { AgentState } from '../agent_graph';
import { RoleHistoryManager } from '../../memory/storage/role_history_manager';

/**
 * 对话压缩节点
 * 在智能体图中检查并触发对话历史压缩
 */
export async function conversationCompressNode(state: AgentState): Promise<AgentState> {
  try {
    // 使用消息中的元数据获取角色ID，或使用默认值
    const lastMessage = state.messages[state.messages.length - 1];
    const roleId = lastMessage?.metadata?.role_id || 'default';
    
    console.log(`[压缩节点] 检查角色 ${roleId} 是否需要压缩`);
    
    // 创建角色历史管理器
    const roleHistoryManager = new RoleHistoryManager();
    
    // 触发压缩检查（内部会自动判断是否需要压缩）
    // 注意：这里我们直接调用 compress 方法，因为它会先检查阈值
    // 或者我们可以添加一个 public 的 triggerCompression 方法
    await roleHistoryManager.triggerCompression(roleId);
    
    // 可选：获取压缩后的上下文并更新状态
    const context = await roleHistoryManager.getContext(roleId);
    
    console.log(`[压缩节点] 角色 ${roleId} 处理完成，当前上下文消息数: ${context.length}`);
    
    return state;
  } catch (error) {
    console.error('[压缩节点错误]:', error);
    // 不中断流程，返回原状态
    return state;
  }
}
