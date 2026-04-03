import { AgentState } from '../agent_graph';

export async function middlewarePreCheckNode(state: AgentState): Promise<AgentState> {
  // 中间件前置检查
  return state;
}

export async function middlewareToolCheckNode(state: AgentState): Promise<AgentState> {
  // 中间件工具检查
  return state;
}

export async function middlewarePostCheckNode(state: AgentState): Promise<AgentState> {
  // 中间件后置检查
  return state;
}
