import { AgentState } from '../agent_graph'; // 导入智能体状态接口
import { getMcpLoader } from '../../mcp/lazy_loader'; // 导入获取MCP加载器的函数
import { getSkillRegistry } from '../../skills/skill_system'; // 导入获取技能注册表的函数

/**
 * MCP加载节点函数
 * 负责根据匹配的技能加载对应的MCP依赖
 * @param state 智能体状态对象，包含当前处理的所有上下文信息
 * @returns 更新后的智能体状态对象
 */
export async function mcpLoadNode(state: AgentState): Promise<AgentState> {
  console.log('[MCP加载] 开始加载MCP依赖'); // 输出日志，标记MCP加载流程开始
  
  try {
    // 获取全局MCP加载器实例，用于管理MCP服务器连接
    const mcpLoader = await getMcpLoader();
    
    // 获取全局技能注册表实例，用于查询技能的详细信息
    const skillRegistry = getSkillRegistry();
    
    // 遍历所有匹配的技能，检查每个技能是否有MCP依赖
    for (const skillName of state.matched_skills) {
      console.log(`[MCP加载] 检查技能: ${skillName}`); // 输出当前正在检查的技能名称
      
      // 从技能注册表中获取技能对象
      const skill = skillRegistry.getSkill(skillName);
      
      // 如果技能不存在，跳过并记录警告
      if (!skill) {
        console.warn(`[MCP加载] 未找到技能: ${skillName}`); // 输出警告日志
        continue; // 继续下一个技能
      }
      
      // 检查技能是否有MCP依赖配置
      // Manifest.mcp_dependencies 是一个数组，包含所需的MCP服务器名称
      if (skill.Manifest.mcp_dependencies && skill.Manifest.mcp_dependencies.length > 0) {
        console.log(`[MCP加载] 技能 ${skillName} 有 ${skill.Manifest.mcp_dependencies.length} 个MCP依赖`); // 输出依赖数量
        
        // 遍历技能的所有MCP依赖
        for (const mcpDependency of skill.Manifest.mcp_dependencies) {
          // mcpDependency 可能是字符串（服务器名称）或对象（包含更多配置）
          const serverName = typeof mcpDependency === 'string' ? mcpDependency : mcpDependency.name;
          
          console.log(`[MCP加载] 正在加载MCP服务器: ${serverName}`); // 输出正在加载的服务器名称
          
          try {
            // 调用MCP加载器的getClient方法，懒加载MCP服务器客户端
            // 如果客户端已存在则直接返回，否则创建新连接
            const client = await mcpLoader.getClient(serverName);
            
            // 检查客户端是否成功加载
            if (client) {
              console.log(`[MCP加载] MCP服务器 ${serverName} 加载成功`); // 输出成功日志
              
              // 可选：将客户端添加到技能的mcpClients数组中
              // 这样技能在执行时可以直接使用已连接的客户端
              if ('mcpClients' in skill && Array.isArray((skill as any).mcpClients)) {
                (skill as any).mcpClients.push(client); // 将客户端添加到技能
              }
            } else {
              console.warn(`[MCP加载] MCP服务器 ${serverName} 加载失败，返回undefined`); // 输出警告
            }
          } catch (error) {
            // 捕获单个MCP服务器加载失败的错误
            console.error(`[MCP加载] 加载MCP服务器 ${serverName} 时出错:`, error); // 输出错误日志
            // 不中断流程，继续尝试加载其他依赖
          }
        }
      } else {
        console.log(`[MCP加载] 技能 ${skillName} 没有MCP依赖`); // 输出无依赖的日志
      }
      
      console.log(`[MCP加载] 技能 ${skillName} 的MCP依赖检查完成`); // 输出单个技能检查完成的日志
    }
    
    console.log('[MCP加载] 所有MCP依赖加载完成'); // 输出日志，标记所有MCP加载流程结束
  } catch (error) {
    // 捕获并记录MCP加载过程中的任何错误
    console.error('[MCP加载] 加载MCP依赖时发生错误:', error); // 输出错误日志
    // 不中断流程，MCP加载失败不应阻止后续处理
  }
  
  // 返回更新后的状态（当前实现中状态未改变）
  return state;
}
