import { AgentState } from '../agent_graph';
import { MiddlewareManager, MiddlewareContext, MiddlewarePhase } from '../../middleware/base';
import { GuardrailMiddleware } from '../../middleware/guardrail';
import { LoopDetectionMiddleware } from '../../middleware/loop_detection';
import { MemorySummarizationMiddleware } from '../../middleware/memory_summarization';

// 全局中间件管理器实例
let globalMiddlewareManager: MiddlewareManager | null = null;

/**
 * 获取或创建中间件管理器
 */
function getMiddlewareManager(): MiddlewareManager {
  if (!globalMiddlewareManager) {
    globalMiddlewareManager = new MiddlewareManager();
    
    // 注册默认中间件
    globalMiddlewareManager.addMiddleware(new GuardrailMiddleware());
    globalMiddlewareManager.addMiddleware(new LoopDetectionMiddleware());
    globalMiddlewareManager.addMiddleware(new MemorySummarizationMiddleware());
    
    console.log('[Middleware] 中间件管理器已初始化');
  }
  return globalMiddlewareManager;
}

/**
 * 中间件前置检查节点（在 LLM 调用前）
 * @param state 智能体状态
 * @returns 更新后的状态
 */
export async function middlewarePreCheckNode(state: AgentState): Promise<AgentState> {
  // 获取或创建全局中间件管理器实例
  const manager = getMiddlewareManager();
  
  // 构建中间件上下文，包含执行所需的所有信息
  const context: MiddlewareContext = {
    agent_id: state.agent_id || 'unknown', // 从 state 中获取智能体ID，如果没有则使用默认值
    agent_name: state.agent_name || 'unknown', // 从 state 中获取智能体名称，如果没有则使用默认值
    phase: MiddlewarePhase.BEFORE_THINK, // 设置阶段为思考前，表示在LLM调用之前执行
    current_state: 'thinking', // 当前状态设置为思考中
    current_location: '', // 当前位置，暂时为空字符串
    goal: state.user_input, // 将用户输入作为目标
    metadata: {
      matched_skills: state.matched_skills, // 添加匹配的技能列表到元数据
      memory_context: state.memory_context // 添加记忆上下文到元数据
    }
  };
  
  // 执行中间件处理，传入上下文和智能体实例（这里传null）
  const result = manager.process(context, null);
  
  // 如果中间件返回不应该继续执行
  if (!result.should_continue) {
    // 记录警告日志，说明前置检查阻止了继续执行
    console.warn('[Middleware] 前置检查阻止继续执行:', result.message);
    // 将中间件的阻止消息设置为智能体响应
    state.agent_response = result.message || '[安全限制] 操作被阻止';
    // 设置状态为不继续执行
    state.should_continue = false;
  }
  
  // 返回更新后的状态
  return state;
}

/**
 * 中间件工具检查节点（在技能调用后、LLM 调用前）
 * @param state 智能体状态
 * @returns 更新后的状态
 */
export async function middlewareToolCheckNode(state: AgentState): Promise<AgentState> {
  // 如果技能已经处理完毕，不需要继续执行，直接返回当前状态
  if (!state.should_continue) {
    return state;
  }
  
  // 获取或创建全局中间件管理器实例
  const manager = getMiddlewareManager();
  
  // 构建中间件上下文，包含执行所需的所有信息
  const context: MiddlewareContext = {
    agent_id: state.agent_id || 'unknown', // 从 state 中获取智能体ID，如果没有则使用默认值
    agent_name: state.agent_name || 'unknown', // 从 state 中获取智能体名称，如果没有则使用默认值
    phase: MiddlewarePhase.BEFORE_ACTION, // 设置阶段为行动前，表示在技能调用之后、LLM调用之前
    current_state: 'action_pending', // 当前状态设置为待执行行动
    current_location: '', // 当前位置，暂时为空字符串
    action: state.user_input, // 将用户输入作为要执行的行动
    metadata: {
      matched_skills: state.matched_skills // 添加匹配的技能列表到元数据
    }
  };
  
  // 执行中间件处理，传入上下文和智能体实例（这里传null）
  const result = manager.process(context, null);
  
  // 如果中间件返回不应该继续执行
  if (!result.should_continue) {
    // 记录警告日志，说明工具检查阻止了继续执行
    console.warn('[Middleware] 工具检查阻止继续执行:', result.message);
    // 将中间件的阻止消息设置为智能体响应
    state.agent_response = result.message || '[安全限制] 操作被阻止';
    // 设置状态为不继续执行
    state.should_continue = false;
  }
  
  // 返回更新后的状态
  return state;
}

/**
 * 中间件后置检查节点（在 LLM 调用后）
 * @param state 智能体状态
 * @returns 更新后的状态
 */
export async function middlewarePostCheckNode(state: AgentState): Promise<AgentState> {
  // 如果没有智能体响应，说明还没有生成结果，跳过检查直接返回
  if (!state.agent_response) {
    return state;
  }
  
  // 获取或创建全局中间件管理器实例
  const manager = getMiddlewareManager();
  
  // 构建中间件上下文，包含执行所需的所有信息
  const context: MiddlewareContext = {
    agent_id: state.agent_id || 'unknown', // 从 state 中获取智能体ID，如果没有则使用默认值
    agent_name: state.agent_name || 'unknown', // 从 state 中获取智能体名称，如果没有则使用默认值
    phase: MiddlewarePhase.AFTER_ACTION, // 设置阶段为行动后，表示在LLM调用之后执行
    current_state: 'completed', // 当前状态设置为已完成
    current_location: '', // 当前位置，暂时为空字符串
    action: state.user_input, // 将用户输入作为原始行动
    action_result: state.agent_response, // 将智能体响应作为行动结果
    metadata: {
      matched_skills: state.matched_skills // 添加匹配的技能列表到元数据
    }
  };
  
  // 执行中间件处理，传入上下文和智能体实例（这里传null）
  const result = manager.process(context, null);
  
  // 如果中间件修改了输出内容
  if (result.modified_action) {
    // 记录日志，说明输出已被中间件修改
    console.log('[Middleware] 输出已被中间件修改');
    // 使用中间件修改后的行动结果替换原有的智能体响应
    state.agent_response = result.modified_action;
  }
  
  // 如果中间件返回不应该继续执行
  if (!result.should_continue) {
    // 记录警告日志，说明后置检查阻止了返回结果
    console.warn('[Middleware] 后置检查阻止返回结果:', result.message);
    // 将中间件的阻止消息设置为智能体响应
    state.agent_response = result.message || '[安全限制] 结果被阻止';
  }
  
  // 返回更新后的状态
  return state;
}
