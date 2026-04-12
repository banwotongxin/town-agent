/**
 * 会话截断模块（第七层）- 物理删除已摘要的消息条目
 * 
 * 【功能说明】
 * 在压缩完成后，通过物理删除已被摘要的消息条目来控制存储文件大小。
 * 这有助于减少磁盘空间占用，提高文件读取效率。
 * 
 * 【注意事项】
 * 当前实现使用 JSON 数组格式，而非 JSONL 格式。
 * 此函数为将来可能迁移到 JSONL 格式而提供。
 */

/**
 * 在压缩后截断会话条目，删除已被摘要的消息
 * 
 * 【工作原理】
 * 1. 遍历所有条目，找到第一个需要保留的条目ID
 * 2. 收集该ID之前的所有消息类型条目的ID
 * 3. 过滤掉这些已被摘要的消息条目
 * 
 * @param entries 会话文件中的所有条目（JSONL格式）
 * @param firstKeptEntryId 第一个需要保留的条目ID（来自压缩结果）
 * @returns 过滤后的条目数组，已删除被摘要的消息
 */
export function truncateSessionAfterCompaction( // 压缩后截断会话函数
  entries: any[], // 所有会话条目
  firstKeptEntryId: string // 第一个保留条目的ID
): any[] { // 返回过滤后的条目数组
  // 创建集合用于存储需要删除的消息ID
  const summarizedIds = new Set<string>();
  let foundKeepPoint = false; // 标记是否找到保留点

  // 遍历所有条目，收集需要删除的消息ID
  for (const entry of entries) {
    // 如果找到第一个需要保留的条目，停止收集
    if (entry.id === firstKeptEntryId) {
      foundKeepPoint = true;
      break;
    }
    // 如果还没到保留点，且条目类型是消息，则添加到删除集合
    if (entry.type === 'message' && !foundKeepPoint) {
      summarizedIds.add(entry.id);
    }
  }

  // 过滤条目：只删除类型为'message'且ID在删除集合中的条目
  return entries.filter(entry => { // 过滤条目
    // 如果不是消息类型，或者ID不在删除集合中，则保留
    return entry.type !== 'message' || !summarizedIds.has(entry.id); // 保留非消息或不在删除集合中的条目
  });
}
