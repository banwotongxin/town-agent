// 导入消息相关类和双记忆系统
import { BaseMessage, HumanMessage, AIMessage, SystemMessage } from '../agents/base_agent';
import { DualMemorySystem } from '../memory/storage/dual_memory';
import { middlewarePreCheckNode, middlewareToolCheckNode, middlewarePostCheckNode } from './nodes/middleware_nodes';
import { mcpLoadNode } from './nodes/mcp_load_node'; // 导入MCP加载节点函数

/**
 * 智能体状态接口，定义了智能体图的状态
 */
export interface AgentState {
  messages: BaseMessage[];      // 消息历史
  user_input: string;           // 用户输入
  agent_response: string;       // 智能体响应
  memory_context: string;       // 记忆上下文
  emotion_context: string;      // 情感上下文
  matched_skills: string[];     // 匹配的技能
  should_continue: boolean;     // 是否继续处理
  agent_id?: string;            // 智能体ID（可选）
  agent_name?: string;          // 智能体名称（可选）
}

/**
 * 技能注册表接口，定义了技能管理的方法
 */
export interface SkillRegistry {
  findMatchingSkills: (input: string) => any[];  // 查找匹配的技能
  getSkill: (name: string) => any;              // 获取技能
}

/**
 * 情感引擎接口，定义了情感管理的方法
 */
export interface EmotionEngine {
  getRelationshipInfo: (agentId1: string, agentId2: string) => any;  // 获取关系信息
  getConversationStyleHint: (level: any) => string;                 // 获取对话风格提示
  interact: (params: any) => any;                                  // 互动
}

/**
 * 情感等级类
 */
export class EmotionLevel {
  /**
   * 根据情感分数获取情感等级
   * @param score 情感分数
   * @returns 情感等级实例
   */
  static fromScore(score: number): EmotionLevel {
    return new EmotionLevel();
  }
}

/**
 * 智能体图类，管理智能体的交互流程
 */
export class AgentGraph {
  private agent: any;               // 智能体实例
  private memory: DualMemorySystem;  // 双记忆系统
  private skills: SkillRegistry;     // 技能注册表
  private emotion: EmotionEngine;    // 情感引擎
  private otherAgentId: string;      // 其他智能体ID
  private state: AgentState;         // 智能体状态

  /**
   * 构造函数
   * @param agent 智能体实例
   * @param memorySystem 双记忆系统
   * @param skillRegistry 技能注册表
   * @param emotionEngine 情感引擎
   * @param otherAgentId 其他智能体ID
   */
  constructor(
    agent: any,
    memorySystem: DualMemorySystem,
    skillRegistry: SkillRegistry,
    emotionEngine: EmotionEngine,
    otherAgentId: string
  ) {
    this.agent = agent;
    this.memory = memorySystem;
    this.skills = skillRegistry;
    this.emotion = emotionEngine;
    this.otherAgentId = otherAgentId;

    // 初始化状态
    this.state = {
      messages: [],
      user_input: "",
      agent_response: "",
      memory_context: "",
      emotion_context: "",
      matched_skills: [],
      should_continue: true,
      agent_id: (agent as any).AgentId || 'unknown',  // 从 agent 对象获取 agentId
      agent_name: (agent as any).Profile?.name || 'unknown'  // 从 agent 的 profile 获取 name
    };
  }

  /**
   * 加载档案节点
   * @param state 智能体状态
   * @returns 更新后的状态
   */
  async loadProfileNode(state: AgentState): Promise<AgentState> {
    return state;
  }

  /**
   * 中间件前置检查节点
   * @param state 智能体状态
   * @returns 更新后的状态
   */
  async middlewarePreCheckNode(state: AgentState): Promise<AgentState> {
    return await middlewarePreCheckNode(state);
  }

  /**
   * 中间件工具检查节点
   * @param state 智能体状态
   * @returns 更新后的状态
   */
  async middlewareToolCheckNode(state: AgentState): Promise<AgentState> {
    return await middlewareToolCheckNode(state);
  }

  /**
   * 中间件后置检查节点
   * @param state 智能体状态
   * @returns 更新后的状态
   */
  async middlewarePostCheckNode(state: AgentState): Promise<AgentState> {
    return await middlewarePostCheckNode(state);
  }

  /**
   * 检查压缩节点
   * @param state 智能体状态
   * @returns 更新后的状态
   */
  async checkCompressNode(state: AgentState): Promise<AgentState> {
    return state;
  }

  /**
   * 查询记忆节点
   * @param state 智能体状态
   * @returns 更新后的状态
   */
  async queryMemoryNode(state: AgentState): Promise<AgentState> {
    // 1. 从 ChromaDB 获取语义相关的长期记忆
    const context = await this.memory.getContext(state.user_input);
    state.memory_context = context;
    
    // 2. 从文件加载对话历史并添加到 messages
    try {
      const { RoleHistoryManager } = await import('../memory/storage/role_history_manager');
      const roleHistoryManager = new RoleHistoryManager();
      const agentId = (this.agent as any).agentId || 'unknown';
      
      // 获取文件历史，限制token数
      const fileHistory = await roleHistoryManager.getContext(agentId, {
        maxTokens: 8000  // 控制在8000 token以内
      });
      
      if (fileHistory.length > 0) {
        console.log(`[文件历史] 角色 ${agentId} 加载了 ${fileHistory.length} 条历史消息`);
        // 将文件历史添加到 state.messages 前面
        state.messages = [...fileHistory, ...state.messages];
      }
    } catch (error) {
      console.error('[文件历史] 加载失败:', error);
      // 不中断流程
    }
    
    return state;
  }

  /**
   * 技能匹配节点
   * @param state 智能体状态
   * @returns 更新后的状态
   */
  async skillMatchNode(state: AgentState): Promise<AgentState> {
    const matched = this.skills.findMatchingSkills(state.user_input);
    state.matched_skills = matched.map((skill: any) => skill.manifest.name);
    return state;
  }

  /**
   * 注入情感上下文节点
   * @param state 智能体状态
   * @returns 更新后的状态
   */
  async injectEmotionContextNode(state: AgentState): Promise<AgentState> {
    const relationship = this.emotion.getRelationshipInfo(
      (this.agent as any).agentId,
      this.otherAgentId
    );

    if (relationship) {
      const level = EmotionLevel.fromScore(relationship.emotion_score);
      const styleHint = this.emotion.getConversationStyleHint(level);

      state.emotion_context = `
[与${this.otherAgentId}的关系]
等级：${relationship.level_name}
分数：${relationship.emotion_score.toFixed(1)}
互动次数：${relationship.interaction_count}
${styleHint}
`;
    } else {
      state.emotion_context = "";
    }

    return state;
  }

  /**
   * 加载MCP节点
   * @param state 智能体状态
   * @returns 更新后的状态
   */
  async loadMcpNode(state: AgentState): Promise<AgentState> {
    console.log('[MCP加载节点] 开始加载MCP依赖');
    return await mcpLoadNode(state);
  }

  /**
   * 调用技能节点
   * @param state 智能体状态
   * @returns 更新后的状态
   */
  async invokeSkillsNode(state: AgentState): Promise<AgentState> {
    console.log('[技能调用] 匹配到的技能:', state.matched_skills);
    
    // 遍历所有匹配的技能
    for (const skillName of state.matched_skills) {
      const skill = this.skills.getSkill(skillName);
      
      if (!skill) {
        console.warn(`[技能调用] 未找到技能: ${skillName}`);
        continue;
      }
      
      try {
        console.log(`[技能调用] 执行技能: ${skillName}`);
        
        // 执行技能
        const result = await skill.execute(
          state.user_input,
          {
            agentId: (this.agent as any).agentId,
            conversationHistory: state.messages
          }
        );
        
        // 检查是否是默认实现（未实现具体功能）
        const isDefaultImplementation = result.includes('已激活，但尚未实现具体功能');
        
        // 如果技能有具体实现且返回了结果，直接使用
        if (!isDefaultImplementation && result && result.trim().length > 0) {
          console.log(`[技能调用] 技能 ${skillName} 执行成功`);
          state.agent_response = result;
          
          // 保存对话到文件历史
          try {
            const { RoleHistoryManager } = await import('../memory/storage/role_history_manager');
            const { HumanMessage, AIMessage } = await import('../agents/base_agent');
            const roleHistoryManager = new RoleHistoryManager();
            const agentId = (this.agent as any).agentId || 'unknown';
            
            await roleHistoryManager.addMessage(agentId, new HumanMessage(state.user_input));
            await roleHistoryManager.addMessage(agentId, new AIMessage(state.agent_response));
            
            console.log(`[文件历史] 角色 ${agentId} 已保存对话到文件`);
          } catch (error) {
            console.error('[文件历史] 保存失败:', error);
          }
          
          // 标记为已完成，跳过 LLM 调用
          state.should_continue = false;
          return state;
        } else if (isDefaultImplementation) {
          console.log(`[技能调用] 技能 ${skillName} 使用默认实现，将通过系统提示增强 LLM`);
          // 不设置 should_continue = false，让流程继续到 LLM 调用
          // 技能的 system_prompt_enhancement 会在 invokeLlmNode 中被添加
        }
      } catch (error) {
        console.error(`[技能调用] 技能 ${skillName} 执行失败:`, error);
        // 继续尝试下一个技能
      }
    }
    
    console.log('[技能调用] 所有技能执行完毕，将继续 LLM 调用');
    return state;
  }

  /**
   * 调用LLM节点
   * @param state 智能体状态
   * @returns 更新后的状态
   */
  async invokeLlmNode(state: AgentState): Promise<AgentState> {
    // 如果技能已经处理完毕，跳过 LLM 调用
    if (!state.should_continue) {
      console.log('[LLM] 技能已处理，跳过 LLM 调用');
      return state;
    }
    
    const messages = [...state.messages, new HumanMessage(state.user_input)];

    let systemPrompt = (this.agent as any).getSystemPrompt();

    // 添加记忆上下文
    if (state.memory_context) {
      systemPrompt += `\n\n${state.memory_context}`;
    }

    // 添加情感上下文
    if (state.emotion_context) {
      systemPrompt += `\n${state.emotion_context}`;
    }

    // 添加技能系统提示
    for (const skillName of state.matched_skills) {
      const skill = this.skills.getSkill(skillName);
      if (skill) {
        systemPrompt += skill.getSystemPrompt();
      }
    }

    console.log('[LLM调用] 系统提示长度:', systemPrompt.length, '字符');
    console.log('[LLM调用] 系统提示预览:', systemPrompt.substring(0, 500));

    // ★ Layer 4: 预防性压缩决策
    try {
      const { decideCompactionRoute, CompactionRoute } = await import('../memory/compression/preemptive_compaction');
      const { truncateAggregateToolResults } = await import('../memory/compression/tool_result_truncation');
      const { activeCompact } = await import('../memory/compression/active_compaction');
      
      const routeInfo = decideCompactionRoute(
        messages,
        systemPrompt,
        state.user_input,
        8000,  // context_token_budget
        4096   // reserve_tokens (SUMMARIZATION_OVERHEAD)
      );
      
      console.log(`[预防性压缩] 路由: ${routeInfo.route}, 预估 tokens: ${routeInfo.estimatedTokens}, 溢出: ${routeInfo.overflowTokens}`);
      
      let processedMessages = messages;
      
      switch (routeInfo.route) {
        case CompactionRoute.TRUNCATE_TOOL_RESULTS_ONLY:
        case CompactionRoute.COMPACT_THEN_TRUNCATE:
          // 应用 Layer 3 - 工具结果截断
          console.log('[预防性压缩] 应用工具结果截断');
          processedMessages = truncateAggregateToolResults(processedMessages, 8000);
          break;
      }
      
      if (routeInfo.shouldCompact) {
        // 应用 Layer 5 - 主动压缩
        const llmModel = (this.agent as any).llmModel;
        if (llmModel && processedMessages.length > 10) {
          console.log('[预防性压缩] 应用主动压缩');
          const result = await activeCompact(
            processedMessages.slice(0, -1), // 移除最后一条用户消息
            8000,
            llmModel
          );
          processedMessages = [...result.keptMessages, processedMessages[processedMessages.length - 1]];
          console.log(`[预防性压缩] 压缩完成: ${result.tokensBefore} → ${result.tokensAfter} tokens`);
        }
      }
      
      // 使用处理后的消息
      state.messages = processedMessages.slice(0, -1); // 保存除最后一条用户消息外的所有消息
    } catch (error) {
      console.error('[预防性压缩失败，继续正常流程]:', error);
      // 不中断流程，使用原始消息
    }

    // 重新构建消息（可能已被压缩）
    const finalMessages = [...state.messages, new HumanMessage(state.user_input)];

    // 调用语言模型
    if ((this.agent as any).llmModel) {
      // 准备工具列表（从已加载的 MCP 客户端获取）
      let tools: any[] = [];
      
      if (state.matched_skills.length > 0) {
        try {
          const { getMcpLoader } = await import('../mcp/lazy_loader');
          const mcpLoader = getMcpLoader();
          
          // 遍历所有匹配的技能，收集它们的 MCP 工具
          for (const skillName of state.matched_skills) {
            const skill = this.skills.getSkill(skillName);
            if (skill && skill.Manifest.mcp_dependencies) {
              for (const mcpDep of skill.Manifest.mcp_dependencies) {
                const serverName = typeof mcpDep === 'string' ? mcpDep : mcpDep.name;
                
                // 检查 MCP 服务器是否已加载
                if (mcpLoader.isLoaded(serverName)) {
                  // 获取 MCP 客户端
                  const client = await mcpLoader.getClient(serverName);
                  if (client && client.listTools) {
                    const mcpTools = await client.listTools();
                    
                    // 转换 MCP 工具格式为 LLM 需要的格式
                    for (const tool of mcpTools) {
                      tools.push({
                        type: 'function',
                        function: {
                          name: tool.name,
                          description: tool.description || '',
                          parameters: tool.inputSchema || {}
                        }
                      });
                    }
                    
                    console.log(`[LLM调用] 从 ${serverName} 加载了 ${mcpTools.length} 个工具`);
                  }
                }
              }
            }
          }
        } catch (error) {
          console.error('[LLM调用] 获取 MCP 工具失败:', error);
        }
      }
      
      const fullMessages = [new SystemMessage(systemPrompt), ...finalMessages];
      
      // 调用 LLM，传递工具列表
      const response = await (this.agent as any).llmModel.invoke(fullMessages, { tools });
      
      // 如果 LLM 决定调用工具，执行工具并获取结果
      if (response.tool_calls && response.tool_calls.length > 0) {
        console.log(`[LLM调用] LLM 决定调用 ${response.tool_calls.length} 个工具`);
        (state as any).tool_calls = response.tool_calls;
        
        // 执行工具调用
        try {
          const { getMcpLoader } = await import('../mcp/lazy_loader');
          const mcpLoader = getMcpLoader();
          
          const toolResults = [];
          
          for (const toolCall of response.tool_calls) {
            const toolName = toolCall.function.name;
            const toolArgs = JSON.parse(toolCall.function.arguments || '{}');
            
            console.log(`[工具执行] 调用工具: ${toolName}, 参数:`, toolArgs);
            
            // 查找对应的 MCP 客户端并执行工具
            let executed = false;
            for (const skillName of state.matched_skills) {
              const skill = this.skills.getSkill(skillName);
              if (skill && skill.Manifest.mcp_dependencies) {
                for (const mcpDep of skill.Manifest.mcp_dependencies) {
                  const serverName = typeof mcpDep === 'string' ? mcpDep : mcpDep.name;
                  
                  if (mcpLoader.isLoaded(serverName)) {
                    const client = await mcpLoader.getClient(serverName);
                    if (client && client.callTool) {
                      try {
                        const result = await client.callTool(toolName, toolArgs);
                        console.log(`[工具执行] 工具 ${toolName} 执行成功`);
                        
                        // 提取工具返回的文本内容
                        let resultText = '';
                        if (result.content && Array.isArray(result.content)) {
                          resultText = result.content.map((c: any) => c.text || '').join('\n');
                        } else if (typeof result === 'string') {
                          resultText = result;
                        } else {
                          resultText = JSON.stringify(result, null, 2);
                        }
                        
                        toolResults.push({
                          tool_call_id: toolCall.id,
                          content: resultText
                        });
                        
                        executed = true;
                        break;
                      } catch (error) {
                        console.error(`[工具执行] 工具 ${toolName} 执行失败:`, error);
                        toolResults.push({
                          tool_call_id: toolCall.id,
                          content: `工具执行错误: ${error instanceof Error ? error.message : String(error)}`
                        });
                        executed = true;
                        break;
                      }
                    }
                  }
                }
              }
              if (executed) break;
            }
            
            if (!executed) {
              console.warn(`[工具执行] 未找到工具 ${toolName} 的执行器`);
              toolResults.push({
                tool_call_id: toolCall.id,
                content: `错误：未找到工具 "${toolName}"`
              });
            }
          }
          
          // 将工具结果添加到消息历史
          const messagesWithToolResults = [...fullMessages];
          
          // 添加 AI 的工具调用消息
          messagesWithToolResults.push({
            type: 'ai',
            content: '',
            tool_calls: response.tool_calls
          } as any);
          
          // 添加工具结果消息
          for (const result of toolResults) {
            messagesWithToolResults.push({
              type: 'tool_result',
              content: result.content,
              tool_call_id: result.tool_call_id
            } as any);
          }
          
          // 再次调用 LLM，让它根据工具结果生成最终回复
          console.log('[LLM调用] 基于工具结果生成最终回复...');
          const finalResponse = await (this.agent as any).llmModel.invoke(messagesWithToolResults);
          state.agent_response = finalResponse.content || '[系统] 工具执行完成，但无法生成回复';
          
          console.log(`[工具执行] 所有工具执行完毕，生成最终回复`);
          
        } catch (error) {
          console.error('[工具执行] 执行工具时出错:', error);
          state.agent_response = '[系统] 工具执行过程中出现错误';
        }
      } else {
        // 没有工具调用，直接使用 LLM 的回复
        state.agent_response = response.content || '[系统] 暂无回复';
      }
      
      // 保存对话到文件历史
      try {
        const { RoleHistoryManager } = await import('../memory/storage/role_history_manager');
        const { HumanMessage, AIMessage } = await import('../agents/base_agent');
        const roleHistoryManager = new RoleHistoryManager();
        const agentId = (this.agent as any).agentId || 'unknown';
        
        // 保存用户消息和助手响应
        await roleHistoryManager.addMessage(agentId, new HumanMessage(state.user_input));
        await roleHistoryManager.addMessage(agentId, new AIMessage(state.agent_response));
        
        console.log(`[文件历史] 角色 ${agentId} 已保存对话到文件`);
      } catch (error) {
        console.error('[文件历史] 保存失败:', error);
        // 不中断流程
      }
    } else {
      state.agent_response = "[系统] 我还没有学会说话...";
    }

    return state;
  }

  /**
   * 保存记忆节点
   * @param state 智能体状态
   * @returns 更新后的状态
   */
  async saveMemoryNode(state: AgentState): Promise<AgentState> {
    // 不再将对话保存到长期记忆（ChromaDB）
    // 对话历史由 Session Memory 管理
    console.log(`[记忆] 对话已保存到会话记忆，未存入长期记忆`);

    return state;
  }

  /**
   * 评估情感节点
   * @param state 智能体状态
   * @returns 更新后的状态
   */
  async evaluateEmotionNode(state: AgentState): Promise<AgentState> {
    const result = this.emotion.interact({
      agent_a_id: (this.agent as any).agentId,
      agent_b_id: this.otherAgentId,
      interaction_type: "conversation",
      sentiment: "positive"
    });

    // 如果关系等级变化，保存重要事件
    if (result.level_changed) {
      const eventDesc = `与${this.otherAgentId}的关系提升到${result.new_level}`;
      this.memory.saveImportantEvent(eventDesc, 0.9);
    }

    return state;
  }

  /**
   * 路由判断
   * @param state 智能体状态
   * @returns 路由方向
   */
  shouldRoute(state: AgentState): string {
    return state.should_continue ? "continue" : "end";
  }

  /**
   * 处理消息
   * @param userInput 用户输入
   * @param conversationHistory 对话历史（可选）
   * @returns 处理结果
   */
  async processMessage(
    userInput: string,
    conversationHistory?: BaseMessage[]
  ): Promise<Record<string, any>> {
    // 初始化状态
    this.state = {
      messages: conversationHistory || [],
      user_input: userInput,
      agent_response: "",
      memory_context: "",
      emotion_context: "",
      matched_skills: [],
      should_continue: true,
      agent_id: (this.agent as any).AgentId || 'unknown',  // 从 agent 对象获取 agentId
      agent_name: (this.agent as any).Profile?.name || 'unknown'  // 从 agent 的 profile 获取 name
    };

    let state = this.state;

    // 1. 中间件前置检查（安全检查）
    state = await this.middlewarePreCheckNode(state);
    if (!state.should_continue) {
      return {
        response: state.agent_response,
        matched_skills: state.matched_skills,
        memory_state: this.memory.getState()
      };
    }

    // 2. 加载档案
    state = await this.loadProfileNode(state);

    // 3. 查询记忆
    state = await this.queryMemoryNode(state);

    // 4. 匹配技能
    state = await this.skillMatchNode(state);

    // 5. 加载 MCP（如果技能有依赖）
    if (state.matched_skills.length > 0) {
      state = await this.loadMcpNode(state);
    }

    // 6. 调用技能（如果匹配到）
    if (state.matched_skills.length > 0) {
      state = await this.invokeSkillsNode(state);
      
      // 如果技能已经处理完毕，跳过后续步骤
      if (!state.should_continue) {
        // 但仍需要执行后置中间件检查
        state = await this.middlewarePostCheckNode(state);
        
        this.state = state;
        return {
          response: state.agent_response,
          matched_skills: state.matched_skills,
          memory_state: this.memory.getState()
        };
      }
    }

    // 7. 中间件工具检查（在 LLM 调用前）
    state = await this.middlewareToolCheckNode(state);
    if (!state.should_continue) {
      this.state = state;
      return {
        response: state.agent_response,
        matched_skills: state.matched_skills,
        memory_state: this.memory.getState()
      };
    }

    // 8. 注入情感上下文
    state = await this.injectEmotionContextNode(state);

    // 9. 调用 LLM
    state = await this.invokeLlmNode(state);

    // 10. 中间件后置检查（安全检查输出）
    state = await this.middlewarePostCheckNode(state);

    // 11. 保存记忆
    state = await this.saveMemoryNode(state);

    // 12. 评估情感
    state = await this.evaluateEmotionNode(state);

    this.state = state;

    return {
      response: state.agent_response,
      matched_skills: state.matched_skills,
      memory_state: this.memory.getState()
    };
  }

  /**
   * 获取智能体图状态
   * @returns 状态对象
   */
  getState(): Record<string, any> {
    return {
      agent: (this.agent as any).getStatus(),
      memory: this.memory.getState(),
      other_agent_id: this.otherAgentId
    };
  }
}

/**
 * 创建智能体图
 * @param agent 智能体实例
 * @param memorySystem 双记忆系统
 * @param skillRegistry 技能注册表
 * @param emotionEngine 情感引擎
 * @param otherAgentId 其他智能体ID
 * @returns 智能体图实例
 */
export async function createAgentGraph(
  agent: any,
  memorySystem: DualMemorySystem,
  skillRegistry: SkillRegistry,
  emotionEngine: EmotionEngine,
  otherAgentId: string
): Promise<AgentGraph> {
  return new AgentGraph(
    agent,
    memorySystem,
    skillRegistry,
    emotionEngine,
    otherAgentId
  );
}
