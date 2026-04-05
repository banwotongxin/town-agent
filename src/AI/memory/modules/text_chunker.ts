export class TextChunker {
  private chunkSize: number;
  private overlapSize: number;

  constructor(chunkSize: number = 256, overlapSize: number = 32) {
    this.chunkSize = chunkSize;
    this.overlapSize = overlapSize;
  }

  chunk(text: string): string[] {
    if (!text || text.length === 0) {
      return [];
    }

    const chunks: string[] = [];
    const sentences = this.splitIntoSentences(text);
    let currentChunk = '';
    let currentLength = 0;

    for (const sentence of sentences) {
      const sentenceLength = sentence.length;

      if (currentLength + sentenceLength > this.chunkSize) {
        // Add current chunk
        if (currentChunk.trim()) {
          chunks.push(currentChunk.trim());
        }

        // Start new chunk with overlap
        const overlapStart = Math.max(0, currentChunk.length - this.overlapSize);
        currentChunk = currentChunk.substring(overlapStart) + ' ' + sentence;
        currentLength = currentChunk.length;
      } else {
        currentChunk += ' ' + sentence;
        currentLength += sentenceLength + 1; // +1 for space
      }
    }

    // Add the last chunk
    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }

  private splitIntoSentences(text: string): string[] {
    // Simple sentence splitting based on punctuation
    return text
      .split(/[.!?]+/)
      .map(sentence => sentence.trim())
      .filter(sentence => sentence.length > 0);
  }
}
