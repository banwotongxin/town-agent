import { AgentState } from '../agent_graph'; // 导入智能体状态接口，包含匹配的技能列表和响应字段
import { BaseSkill, SkillManifest } from '../../skills/skill_system'; // 导入基础技能类和技能清单接口
import { getSkillRegistry } from '../../skills/skill_system'; // 导入获取技能注册表的函数

/**
 * 技能匹配评分接口
 * 用于评估技能与用户输入的匹配程度
 */
interface SkillMatchScore {
  skillName: string; // 技能名称
  skill: BaseSkill; // 技能对象
  score: number; // 匹配分数（0-100）
  matchedKeywords: string[]; // 匹配到的关键词列表
  reason: string; // 匹配原因说明
}

/**
 * 计算技能匹配分数
 * 根据用户输入和技能元数据计算匹配度
 * 
 * @param userInput 用户输入文本
 * @param skill 技能对象
 * @returns 匹配评分对象
 */
function calculateMatchScore(userInput: string, skill: BaseSkill): SkillMatchScore {
  const manifest = skill.Manifest; // 获取技能的元数据信息
  const inputLower = userInput.toLowerCase(); // 将用户输入转换为小写以便比较
  const matchedKeywords: string[] = []; // 存储匹配到的关键词
  let score = 0; // 初始化匹配分数
  
  // 1. 关键词匹配评分（最高60分）
  // 遍历技能的所有触发关键词，计算匹配数量
  for (const keyword of manifest.trigger_keywords) {
    if (inputLower.includes(keyword.toLowerCase())) {
      matchedKeywords.push(keyword); // 记录匹配到的关键词
      score += 10; // 每个匹配的关键词加10分
    }
  }
  // 限制关键词匹配最高60分
  score = Math.min(score, 60);
  
  // 2. 意图匹配评分（最高30分）
  // 如果技能定义了触发意图，且用户输入包含该意图，给予高分
  if (manifest.trigger_intent && inputLower.includes(manifest.trigger_intent.toLowerCase())) {
    score += 30; // 意图匹配加30分
  }
  
  // 3. 描述相似度评分（最高10分）
  // 简单的描述关键词匹配，作为辅助评分
  const descriptionWords = manifest.description.toLowerCase().split(/\s+/); // 将描述分词
  let descMatchCount = 0; // 描述匹配计数
  for (const word of descriptionWords) {
    if (word.length > 3 && inputLower.includes(word)) { // 忽略短词
      descMatchCount++;
    }
  }
  score += Math.min(descMatchCount * 2, 10); // 描述匹配最高10分
  
  // 返回评分结果
  return {
    skillName: manifest.name, // 技能名称
    skill: skill, // 技能对象
    score: Math.min(score, 100), // 确保分数不超过100
    matchedKeywords: matchedKeywords, // 匹配到的关键词
    reason: `匹配到${matchedKeywords.length}个关键词${manifest.trigger_intent ? ' + 意图匹配' : ''}` // 匹配原因
  };
}

/**
 * 技能调用节点函数
 * 负责执行所有匹配的技能，并根据技能执行结果更新智能体状态
 * 
 * @param state 智能体状态对象，包含已匹配的技能列表、用户输入等信息
 * @param agentId 可选的智能体ID，用于传递给技能执行的上下文
 * @returns 更新后的智能体状态，如果技能处理完毕则设置 should_continue = false
 */
export async function skillInvokeNode(
  state: AgentState, // 智能体的当前状态，包含 matched_skills 和 user_input 等字段
  agentId?: string // 可选的智能体ID，用于技能执行的上下文信息
): Promise<AgentState> {
  // 输出调试日志，标记技能调用开始
  console.log('[技能调用节点] 开始执行技能调用...');
  
  // 检查是否有匹配的技能，如果没有则直接返回原状态
  if (!state.matched_skills || state.matched_skills.length === 0) {
    // 记录日志：没有匹配到任何技能
    console.log('[技能调用节点] 没有匹配的技能，跳过技能调用步骤');
    return state; // 直接返回原始状态，不做任何修改
  }
  
  // 记录匹配到的技能数量
  console.log(`[技能调用节点] 找到 ${state.matched_skills.length} 个匹配的技能: ${state.matched_skills.join(', ')}`);
  
  try {
    // 获取全局技能注册表实例，用于查询和获取技能对象
    const skillRegistry = getSkillRegistry();
    
    // 第一步：计算所有匹配技能的评分，按分数排序
    const scoredSkills: SkillMatchScore[] = [];
    
    // 遍历所有匹配的技能名称，计算每个技能的匹配分数
    for (const skillName of state.matched_skills) {
      // 从技能注册表中获取技能对象
      const skill = skillRegistry.getSkill(skillName);
      
      // 检查技能是否存在，如果不存在则跳过并记录警告
      if (!skill) {
        console.warn(`[技能调用节点] 未找到技能: ${skillName}`);
        continue; // 继续下一个技能
      }
      
      // 计算技能与用户输入的匹配分数
      const matchScore = calculateMatchScore(state.user_input, skill);
      scoredSkills.push(matchScore);
      
      // 输出评分详情日志
      console.log(`[技能调用节点] 技能 "${skillName}" 评分: ${matchScore.score}/100, 原因: ${matchScore.reason}`);
    }
    
    // 第二步：按分数从高到低排序，优先执行最相关的技能
    scoredSkills.sort((a, b) => b.score - a.score);
    
    // 输出排序后的技能列表
    console.log(`[技能调用节点] 技能执行顺序（按相关性排序）:`);
    scoredSkills.forEach((scored, index) => {
      console.log(`  ${index + 1}. ${scored.skillName} (${scored.score}分)`);
    });
    
    // 第三步：依次执行技能，优先执行最相关的
    for (const scoredSkill of scoredSkills) {
      const skillName = scoredSkill.skillName; // 获取技能名称
      const skill = scoredSkill.skill; // 获取技能对象
      
      // 记录日志：开始执行当前技能
      console.log(`[技能调用节点] 正在执行技能: ${skillName} (评分: ${scoredSkill.score})`);
      
      try {
        // 调用技能的 execute 方法执行技能逻辑
        // 传入用户输入、上下文（包含智能体ID和对话历史）和额外参数
        const result = await skill.execute(
          state.user_input, // 用户的原始输入，作为技能的主要参数
          { // 上下文信息，提供给技能更多的环境信息
            agentId: agentId, // 智能体ID，标识是哪个角色在执行技能
            conversationHistory: state.messages, // 对话历史，供技能参考
            matchScore: scoredSkill.score, // 传递匹配分数，技能可以根据分数调整行为
            matchedKeywords: scoredSkill.matchedKeywords // 传递匹配到的关键词
          },
          {} // 额外参数，目前为空对象，可根据需要扩展
        );
        
        // 检查技能返回的结果是否是默认实现（未实现具体功能）
        // 默认实现会返回 "[技能 XXX] 已激活，但尚未实现具体功能。"
        const isDefaultImplementation = result.includes('已激活，但尚未实现具体功能');
        
        // 判断技能是否有具体的实现且返回了有效结果
        if (!isDefaultImplementation && result && result.trim().length > 0) {
          // 情况1：技能有具体实现，直接使用技能的返回结果作为智能体响应
          console.log(`[技能调用节点] 技能 ${skillName} 执行成功，使用技能返回结果`);
          
          // 将技能的执行结果设置为智能体的响应
          state.agent_response = result;
          
          // 标记为已完成，跳过后续的 LLM 调用步骤
          // 这样可以避免重复生成响应，提高效率和一致性
          state.should_continue = false;
          
          // 记录日志：显示响应内容的预览
          const preview = result.substring(0, 100).replace(/\n/g, ' ');
          console.log(`[技能调用节点] 响应预览: "${preview}${result.length > 100 ? '...' : ''}"`);
          
          // 立即返回状态，不再执行后续技能
          // 这样确保只有一个技能产生最终响应（最相关的那个）
          return state;
        } else if (isDefaultImplementation) {
          // 情况2：技能使用默认实现，将通过系统提示增强 LLM
          console.log(`[技能调用节点] 技能 ${skillName} 使用默认实现，将通过系统提示增强 LLM`);
          
          // 不设置 should_continue = false，让流程继续到 LLM 调用
          // 技能的 system_prompt_enhancement 会在 invokeLlmNode 中被添加到系统提示中
          // 这样 LLM 会根据技能的专业知识生成更准确的响应
        }
        
      } catch (error) {
        // 捕获单个技能执行过程中的错误
        // 错误不会中断整个流程，只是记录日志并继续尝试下一个技能
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`[技能调用节点] 技能 ${skillName} 执行失败:`, errorMessage);
        
        // 继续尝试下一个技能，不因单个技能失败而中断整体流程
      }
    }
    
    // 所有技能执行完毕的日志
    console.log('[技能调用节点] 所有技能执行完毕，将继续后续流程');
    
  } catch (error) {
    // 捕获技能调用过程中的整体错误
    // 例如技能注册表获取失败等严重错误
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[技能调用节点] 技能调用过程中发生错误:', errorMessage);
    
    // 发生错误时，保持 should_continue = true，让流程继续到 LLM 调用
    // 这样即使技能系统出错，智能体仍然可以通过 LLM 正常响应
  }
  
  // 返回更新后的状态
  // 如果某个技能成功处理，should_continue 会被设为 false；否则保持 true
  return state;
}
