import { BaseMessage, HumanMessage, AIMessage } from '../agents/base_agent';

export class ConversationCompressor {
  constructor() {
    // 初始化对话压缩器
  }

  compress(
    messages: BaseMessage[],
    existingSummary?: string,
    maxTokens: number = 500
  ): string {
    const conversationText: string[] = [];

    for (const msg of messages) {
      if (msg.type === 'human') {
        conversationText.push(`用户：${msg.content}`);
      } else if (msg.type === 'ai') {
        conversationText.push(`助手：${msg.content}`);
      }
    }

    const conversationStr = conversationText.join('\n');

    if (existingSummary) {
      return `${existingSummary}\n\n[新对话]\n${conversationStr.substring(0, maxTokens * 4)}`;
    } else {
      return `[对话摘要]\n${conversationStr.substring(0, maxTokens * 4)}`;
    }
  }

  shouldCompress(
    messages: BaseMessage[],
    threshold: number = 10
  ): boolean {
    return messages.length >= threshold;
  }

  getCompressionRatio(original: string, compressed: string): number {
    if (!original) {
      return 0.0;
    }
    return compressed.length / original.length;
  }
}
