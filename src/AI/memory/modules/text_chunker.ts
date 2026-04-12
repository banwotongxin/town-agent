// 文本分块器类，用于将长文本分割成较小的块，便于处理和存储
export class TextChunker {
  private chunkSize: number; // 每个块的最大大小
  private overlapSize: number; // 块之间的重叠大小

  // 构造函数，初始化块大小和重叠大小
  constructor(chunkSize: number = 256, overlapSize: number = 32) {
    this.chunkSize = chunkSize; // 设置块大小，默认为256个字符
    this.overlapSize = overlapSize; // 设置重叠大小，默认为32个字符
  }

  // 将文本分割成多个块的方法
  chunk(text: string): string[] {
    // 如果文本为空或长度为0，则返回空数组
    if (!text || text.length === 0) {
      return [];
    }

    const chunks: string[] = []; // 存储分块结果的数组
    const sentences = this.splitIntoSentences(text); // 将文本分割成句子
    let currentChunk = ''; // 当前正在构建的块
    let currentLength = 0; // 当前块的长度

    // 遍历每个句子
    for (const sentence of sentences) {
      const sentenceLength = sentence.length; // 获取当前句子的长度

      // 如果当前块加上新句子的长度超过块大小限制
      if (currentLength + sentenceLength > this.chunkSize) {
        // 如果当前块不为空，则将其添加到结果数组中
        if (currentChunk.trim()) {
          chunks.push(currentChunk.trim());
        }

        // 开始新的块，并包含重叠部分
        const overlapStart = Math.max(0, currentChunk.length - this.overlapSize); // 计算重叠起始位置
        currentChunk = currentChunk.substring(overlapStart) + ' ' + sentence; // 从重叠部分开始，加上新句子
        currentLength = currentChunk.length; // 更新当前块长度
      } else {
        // 如果不会超出块大小限制，则将句子添加到当前块
        currentChunk += ' ' + sentence; // 添加句子到当前块
        currentLength += sentenceLength + 1; // 更新长度（+1为空格）
      }
    }

    // 添加最后一个块
    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }

    return chunks; // 返回分块结果
  }

  // 私有方法：将文本分割成句子
  private splitIntoSentences(text: string): string[] {
    // 基于标点符号简单分割句子
    return text
      .split(/[.!?]+/) // 按句号、感叹号、问号分割
      .map(sentence => sentence.trim()) // 去除每个句子的首尾空白
      .filter(sentence => sentence.length > 0); // 过滤掉空句子
  }
}
