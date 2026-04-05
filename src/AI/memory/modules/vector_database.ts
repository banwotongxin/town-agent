import { ChromaClient, Collection } from 'chromadb';
import { MemoryItem, MemoryItemImpl } from '../dual_memory';

export interface VectorDatabase {
  add(embeddings: number[][], documents: string[], metadatas: any[]): Promise<void>;
  query(queryEmbedding: number[], topK: number): Promise<MemoryItem[]>;
  delete(ids: string[]): Promise<void>;
  count(): Promise<number>;
}

export class ChromaVectorDatabase implements VectorDatabase {
  private client: ChromaClient;
  private collection: Collection | null = null;
  private collectionName: string;

  constructor(collectionName: string, agentId: string) {
    this.client = new ChromaClient();
    this.collectionName = `${collectionName}_${agentId}`;
  }

  private async initializeCollection(): Promise<void> {
    if (!this.collection) {
      try {
        this.collection = await this.client.getCollection({ name: this.collectionName });
      } catch (error) {
        // If collection doesn't exist, create a new one
        this.collection = await this.client.createCollection({ name: this.collectionName });
      }
    }
  }

  async add(embeddings: number[][], documents: string[], metadatas: any[]): Promise<void> {
    await this.initializeCollection();

    const ids = documents.map((_, index) => `id_${Date.now()}_${index}`);

    await this.collection!.add({
      ids,
      documents,
      embeddings,
      metadatas
    });
  }

  async query(queryEmbedding: number[], topK: number): Promise<MemoryItem[]> {
    await this.initializeCollection();

    const results = await this.collection!.query({
      queryEmbeddings: [queryEmbedding],
      nResults: topK
    });

    const memories: MemoryItem[] = [];
    for (let i = 0; i < results.documents.length; i++) {
      const docArray = results.documents[i];
      if (docArray) {
        for (let j = 0; j < docArray.length; j++) {
          const content = docArray[j];
          if (content) {
            const metadata = (results.metadatas[i] && results.metadatas[i][j]) || {};
            const id = results.ids[i]?.[j] || `id_${Date.now()}_${i}_${j}`;
            const score = results.distances[i]?.[j] || 0;

            memories.push(new MemoryItemImpl(
              id.toString(),
              content,
              typeof metadata.importance === 'number' ? metadata.importance : 0.5,
              typeof metadata.timestamp === 'number' ? metadata.timestamp : Date.now() / 1000,
              { ...metadata, score }
            ));
          }
        }
      }
    }

    return memories;
  }

  async delete(ids: string[]): Promise<void> {
    await this.initializeCollection();
    await this.collection!.delete({ ids });
  }

  async count(): Promise<number> {
    await this.initializeCollection();
    const results = await this.collection!.get();
    return (results.ids || []).length;
  }
}
