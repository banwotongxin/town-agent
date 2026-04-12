import { MemoryItem } from '../storage/dual_memory'; // 导入记忆项接口

// 重排序器类，用于对候选记忆进行重新排序，以提高检索结果的相关性
export class Reranker {
  // 重排序方法：根据查询对候选记忆进行评分和排序
  rerank(query: string, candidates: MemoryItem[], topK: number = 5): MemoryItem[] {
    // 如果候选列表为空，则返回空数组
    if (!candidates || candidates.length === 0) {
      return [];
    }

    // 计算每个候选的综合得分
    const scoredCandidates = candidates.map(candidate => {
      const score = this.calculateScore(query, candidate); // 计算单个候选的得分
      return { ...candidate, score }; // 将得分添加到候选对象中
    });

    // 按得分从高到低排序
    scoredCandidates.sort((a, b) => (b.score as number) - (a.score as number));

    // 返回前topK个结果
    return scoredCandidates.slice(0, topK);
  }

  // 私有方法：计算查询与候选记忆的匹配得分
  private calculateScore(query: string, candidate: MemoryItem): number {
    let score = 0; // 初始化得分为0

    // 1. 向量相似度得分（距离越小，相似度越高）
    const vectorScore = 1 / (1 + (candidate.metadata?.score || 0)); // 使用倒数转换距离为相似度
    score += vectorScore * 0.5; // 向量相似度权重为0.5

    // 2. 时间衰减因子（越新的记忆权重越高）
    const now = Date.now() / 1000; // 当前时间戳（秒）
    const age = now - candidate.timestamp; // 记忆的年龄（秒）
    const timeDecay = Math.exp(-age / (24 * 3600)); // 指数衰减，半衰期为1天
    score += timeDecay * 0.2; // 时间衰减权重为0.2

    // 3. 重要性权重
    score += candidate.importance * 0.2; // 重要性权重为0.2

    // 4. 与查询的语义匹配度（简单的字符串匹配）
    const semanticMatch = this.calculateSemanticMatch(query, candidate.content); // 计算语义匹配度
    score += semanticMatch * 0.1; // 语义匹配权重为0.1

    return score; // 返回总得分
  }

  // 私有方法：计算查询与内容的语义匹配度
  private calculateSemanticMatch(query: string, content: string): number {
    // 简单的字符串匹配，实际应用中可以使用更复杂的NLP技术
    const queryWords = new Set(query.toLowerCase().split(/\s+/)); // 将查询转换为小写并分割成单词集合
    const contentWords = content.toLowerCase().split(/\s+/); // 将内容转换为小写并分割成单词数组
    
    let matchCount = 0; // 初始化匹配计数
    for (const word of contentWords) {
      if (queryWords.has(word)) { // 如果内容中的单词在查询中出现
        matchCount++; // 增加匹配计数
      }
    }
    
    return matchCount / Math.max(queryWords.size, 1); // 返回匹配率（匹配数/查询词总数）
  }
}
