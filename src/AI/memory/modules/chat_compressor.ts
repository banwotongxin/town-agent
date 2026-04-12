// 聊天压缩器类，用于压缩聊天记录以节省存储空间
export class ChatCompressor {
  // 压缩聊天记录的方法
  compress(chatHistory: string): string {
    // 如果聊天记录为空或长度为0，则返回空字符串
    if (!chatHistory || chatHistory.length === 0) {
      return '';
    }

    // 简单的压缩策略：提取关键信息和总结
    const compressed = this.extractKeyInformation(chatHistory);
    return compressed;
  }

  // 私有方法：提取文本中的关键信息
  private extractKeyInformation(text: string): string {
    // 这里实现一个简单的关键信息提取
    // 实际应用中可以使用更复杂的NLP技术
    // 使用正则表达式按句子分隔符分割文本，并过滤掉空白和过短的句子
    const sentences = text.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 0);
    
    // 保留较长的句子，通常包含更多信息
    // 只保留长度大于20个字符的句子作为关键句子
    const keySentences = sentences.filter(sentence => sentence.length > 20);
    
    // 限制压缩后的长度
    const maxLength = 500; // 最大允许的长度为500个字符
    let compressed = keySentences.join('. '); // 将关键句子用句号连接起来
    
    // 如果压缩后的内容超过最大长度，则截断并添加省略号
    if (compressed.length > maxLength) {
      compressed = compressed.substring(0, maxLength) + '...';
    }
    
    return compressed; // 返回压缩后的文本
  }
}
