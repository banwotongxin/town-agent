// 导入基础消息类型
import { BaseMessage } from '../../agents/base_agent'; // 导入基础消息类型

/**
 * 审计摘要质量，确保重要信息被保留
 * 
 * 【功能说明】
 * 在生成对话摘要后，检查摘要是否包含了关键信息，如：
 * 1. 摘要长度是否足够
 * 2. 是否保留了重要的标识符（如UUID）
 * 3. 是否记录了最近的用户请求
 * 
 * @param summary 生成的摘要文本
 * @param originalMessages 被摘要的原始消息数组
 * @returns 审计结果，包含是否通过、问题列表和是否需要重试
 */
export function auditSummaryQuality( // 审计摘要质量函数
  summary: string, // 生成的摘要文本
  originalMessages: BaseMessage[] // 原始消息数组
): { passed: boolean; issues: string[]; retry: boolean } { // 返回审计结果
  const issues: string[] = []; // 存储发现的问题

  // 检查1：摘要不应为空或过短
  if (summary.trim().length < 50) { // 如果摘要长度小于50字符
    issues.push('summary_too_short'); // 标记为摘要过短
  }

  // 检查2：提取原始消息中的不透明标识符（如UUID），并验证是否在摘要中保留
  // 简化版本 - 查找UUID格式的字符串
  const identifierPattern = /\b[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\b/gi; // UUID正则表达式
  const originalIds = new Set<string>(); // 存储原始消息中的所有ID
  
  // 遍历所有原始消息，提取其中的UUID
  for (const msg of originalMessages) { // 遍历所有原始消息
    const matches = msg.content.match(identifierPattern); // 匹配UUID
    if (matches) { // 如果找到匹配项
      matches.forEach((id: string) => originalIds.add(id)); // 添加到ID集合
    }
  }

  // 检查有多少ID在摘要中缺失
  let missingIds = 0; // 缺失ID计数器
  for (const id of originalIds) { // 遍历所有原始ID
    if (!summary.includes(id)) { // 如果摘要中不包含该ID
      missingIds++; // 统计缺失的ID数量
    }
  }
  
  // 如果缺失超过5个ID，则标记为问题
  if (missingIds > 5) { // 如果缺失超过5个
    issues.push(`too_many_missing_ids (${missingIds})`); // 标记为缺失太多ID
  }

  // 检查3：验证最近的用户请求是否被记录
  const lastUserMsg = [...originalMessages].reverse().find(m => m.type === 'human'); // 找到最后一条用户消息
  if (lastUserMsg) { // 如果存在用户消息
    const content = lastUserMsg.content.slice(0, 100); // 截取前100个字符
    // 如果内容长度大于20且不在摘要中，则标记为问题
    if (content.length > 20 && !summary.includes(content)) { // 如果内容重要但未被包含
      issues.push('missing_recent_request'); // 标记为缺少最近请求
    }
  }

  // 返回审计结果
  return {
    passed: issues.length === 0, // 如果没有问题，则通过
    issues, // 问题列表
    retry: issues.length > 1  // 如果有多个问题，则需要重试
  };
}
