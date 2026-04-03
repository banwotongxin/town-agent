import { BaseMessage } from '../agents/base_agent';
import { DualMemorySystem } from './dual_memory';
import { ConversationCompressor } from './conversation_compressor';

export class MemoryManager {
  private memorySystems: Record<string, DualMemorySystem>;
  private compressor: ConversationCompressor;

  constructor() {
    this.memorySystems = {};
    this.compressor = new ConversationCompressor();
  }

  getMemorySystem(agentId: string): DualMemorySystem {
    if (!this.memorySystems[agentId]) {
      this.memorySystems[agentId] = new DualMemorySystem(agentId);
    }
    return this.memorySystems[agentId];
  }

  addMessage(
    agentId: string,
    message: BaseMessage,
    evaluateImportance: boolean = true
  ): void {
    const memorySystem = this.getMemorySystem(agentId);
    memorySystem.addMessage(message, evaluateImportance);
  }

  getContext(
    agentId: string,
    query?: string,
    includeLongTerm: boolean = true
  ): string {
    const memorySystem = this.getMemorySystem(agentId);
    return memorySystem.getContext(query, includeLongTerm);
  }

  compressConversation(
    agentId: string,
    messages: BaseMessage[],
    existingSummary?: string
  ): string {
    return this.compressor.compress(messages, existingSummary);
  }

  recall(
    agentId: string,
    query: string,
    nResults: number = 5
  ): Array<Record<string, any>> {
    const memorySystem = this.getMemorySystem(agentId);
    const memories = (memorySystem as any).longTerm.search(query, nResults);

    return memories.map((mem: any) => ({
      content: mem.content,
      importance: mem.importance,
      metadata: mem.metadata
    }));
  }

  saveImportantEvent(
    agentId: string,
    eventDescription: string,
    importance: number = 0.8
  ): string {
    const memorySystem = this.getMemorySystem(agentId);
    return memorySystem.saveImportantEvent(eventDescription, importance);
  }

  getMemoryState(agentId: string): Record<string, any> {
    const memorySystem = this.getMemorySystem(agentId);
    return memorySystem.getState();
  }

  clearMemory(agentId: string): void {
    const memorySystem = this.getMemorySystem(agentId);
    memorySystem.clear();
  }

  getAllAgents(): string[] {
    return Object.keys(this.memorySystems);
  }
}
