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
  const manager = getMiddlewareManager();
  
  // 构建中间件上下文
  const context: MiddlewareContext = {
    agent_id: 'unknown', // TODO: 需要从外部传入
    agent_name: 'unknown',
    phase: MiddlewarePhase.BEFORE_THINK,
    current_state: 'thinking',
    current_location: '',
    goal: state.user_input,
    metadata: {
      matched_skills: state.matched_skills,
      memory_context: state.memory_context
    }
  };
  
  // 执行中间件
  const result = manager.process(context, null);
  
  if (!result.should_continue) {
    console.warn('[Middleware] 前置检查阻止继续执行:', result.message);
    state.agent_response = result.message || '[安全限制] 操作被阻止';
    state.should_continue = false;
  }
  
  return state;
}

/**
 * 中间件工具检查节点（在技能调用后、LLM 调用前）
 * @param state 智能体状态
 * @returns 更新后的状态
 */
export async function middlewareToolCheckNode(state: AgentState): Promise<AgentState> {
  // 如果技能已经处理完毕，跳过中间件检查
  if (!state.should_continue) {
    return state;
  }
  
  const manager = getMiddlewareManager();
  
  // 构建中间件上下文
  const context: MiddlewareContext = {
    agent_id: 'unknown', // TODO: 需要从外部传入
    agent_name: 'unknown',
    phase: MiddlewarePhase.BEFORE_ACTION,
    current_state: 'action_pending',
    current_location: '',
    action: state.user_input,
    metadata: {
      matched_skills: state.matched_skills
    }
  };
  
  // 执行中间件
  const result = manager.process(context, null);
  
  if (!result.should_continue) {
    console.warn('[Middleware] 工具检查阻止继续执行:', result.message);
    state.agent_response = result.message || '[安全限制] 操作被阻止';
    state.should_continue = false;
  }
  
  return state;
}

/**
 * 中间件后置检查节点（在 LLM 调用后）
 * @param state 智能体状态
 * @returns 更新后的状态
 */
export async function middlewarePostCheckNode(state: AgentState): Promise<AgentState> {
  // 如果没有响应，跳过检查
  if (!state.agent_response) {
    return state;
  }
  
  const manager = getMiddlewareManager();
  
  // 构建中间件上下文
  const context: MiddlewareContext = {
    agent_id: 'unknown', // TODO: 需要从外部传入
    agent_name: 'unknown',
    phase: MiddlewarePhase.AFTER_ACTION,
    current_state: 'completed',
    current_location: '',
    action: state.user_input,
    action_result: state.agent_response,
    metadata: {
      matched_skills: state.matched_skills
    }
  };
  
  // 执行中间件
  const result = manager.process(context, null);
  
  // 如果中间件修改了输出，使用修改后的结果
  if (result.modified_action) {
    console.log('[Middleware] 输出已被中间件修改');
    // 这里可以根据需要修改 state.agent_response
  }
  
  if (!result.should_continue) {
    console.warn('[Middleware] 后置检查阻止返回结果:', result.message);
    state.agent_response = result.message || '[安全限制] 结果被阻止';
  }
  
  return state;
}
