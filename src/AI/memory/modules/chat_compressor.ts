export class ChatCompressor {
  compress(chatHistory: string): string {
    if (!chatHistory || chatHistory.length === 0) {
      return '';
    }

    // 简单的压缩策略：提取关键信息和总结
    const compressed = this.extractKeyInformation(chatHistory);
    return compressed;
  }

  private extractKeyInformation(text: string): string {
    // 这里实现一个简单的关键信息提取
    // 实际应用中可以使用更复杂的NLP技术
    const sentences = text.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 0);
    
    // 保留较长的句子，通常包含更多信息
    const keySentences = sentences.filter(sentence => sentence.length > 20);
    
    // 限制压缩后的长度
    const maxLength = 500;
    let compressed = keySentences.join('. ');
    
    if (compressed.length > maxLength) {
      compressed = compressed.substring(0, maxLength) + '...';
    }
    
    return compressed;
  }
}
