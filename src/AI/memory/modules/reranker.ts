import { MemoryItem } from '../dual_memory';

export class Reranker {
  rerank(query: string, candidates: MemoryItem[], topK: number = 5): MemoryItem[] {
    if (!candidates || candidates.length === 0) {
      return [];
    }

    // 计算每个候选的综合得分
    const scoredCandidates = candidates.map(candidate => {
      const score = this.calculateScore(query, candidate);
      return { ...candidate, score };
    });

    // 按得分排序
    scoredCandidates.sort((a, b) => (b.score as number) - (a.score as number));

    // 返回 topK 结果
    return scoredCandidates.slice(0, topK);
  }

  private calculateScore(query: string, candidate: MemoryItem): number {
    let score = 0;

    // 1. 向量相似度得分（距离越小，相似度越高）
    const vectorScore = 1 / (1 + (candidate.metadata?.score || 0));
    score += vectorScore * 0.5;

    // 2. 时间衰减因子（越新的记忆权重越高）
    const now = Date.now() / 1000;
    const age = now - candidate.timestamp;
    const timeDecay = Math.exp(-age / (24 * 3600)); // 1天的半衰期
    score += timeDecay * 0.2;

    // 3. 重要性权重
    score += candidate.importance * 0.2;

    // 4. 与查询的语义匹配度（简单的字符串匹配）
    const semanticMatch = this.calculateSemanticMatch(query, candidate.content);
    score += semanticMatch * 0.1;

    return score;
  }

  private calculateSemanticMatch(query: string, content: string): number {
    // 简单的字符串匹配，实际应用中可以使用更复杂的NLP技术
    const queryWords = new Set(query.toLowerCase().split(/\s+/));
    const contentWords = content.toLowerCase().split(/\s+/);
    
    let matchCount = 0;
    for (const word of contentWords) {
      if (queryWords.has(word)) {
        matchCount++;
      }
    }
    
    return matchCount / Math.max(queryWords.size, 1);
  }
}
