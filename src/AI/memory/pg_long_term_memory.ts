import { Pool, PoolClient, QueryResult } from 'pg';
import { MemoryItem, MemoryItemImpl } from './dual_memory';

export class PGLongTermMemory {
  private agentId: string;
  private collectionName: string;
  private pool: Pool | null;

  constructor(
    agentId: string,
    collectionName: string = "default"
  ) {
    this.agentId = agentId;
    this.collectionName = collectionName;
    this.pool = null;
  }

  async initialize(): Promise<void> {
    try {
      const { Pool } = await import('pg');
      
      // 从配置中获取数据库连接信息
      const config = this.getPgConfig();
      
      this.pool = new Pool({
        host: config.host,
        port: config.port,
        database: config.database,
        user: config.user,
        password: config.password,
        min: config.min_size,
        max: config.max_size
      });

      // 建表
      await this.createTable();
    } catch (error) {
      throw new Error(`Failed to initialize PGLongTermMemory: ${error.message}`);
    }
  }

  private getPgConfig(): Record<string, any> {
    // 这里应该从配置文件中获取，暂时使用默认值
    return {
      host: process.env.PG_HOST || 'localhost',
      port: parseInt(process.env.PG_PORT || '5432'),
      database: process.env.PG_DATABASE || 'cyber_town',
      user: process.env.PG_USER || 'postgres',
      password: process.env.PG_PASSWORD || '',
      min_size: 2,
      max_size: 10
    };
  }

  private async createTable(): Promise<void> {
    if (!this.pool) {
      throw new Error('Pool not initialized');
    }

    const createTableSql = `
      CREATE TABLE IF NOT EXISTS agent_memories (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        agent_id    VARCHAR(100)  NOT NULL,
        collection  VARCHAR(100)  NOT NULL DEFAULT 'default',
        content     TEXT          NOT NULL,
        importance  FLOAT         NOT NULL DEFAULT 0.5,
        timestamp   FLOAT         NOT NULL,
        metadata    JSONB         NOT NULL DEFAULT '{}',
        created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_memories_agent
        ON agent_memories (agent_id, collection);

      CREATE INDEX IF NOT EXISTS idx_memories_importance
        ON agent_memories (importance DESC);
    `;

    try {
      await this.pool.query(createTableSql);
    } catch (error) {
      console.error('Error creating table:', error);
      throw error;
    }
  }

  async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
  }

  async addMemory(
    content: string,
    importance: number = 0.5,
    metadata?: Record<string, any>
  ): Promise<string> {
    if (!this.pool) {
      throw new Error('Pool not initialized');
    }

    const memoryId = Math.random().toString(16).substr(2, 8);
    const timestamp = Date.now() / 1000;

    try {
      await this.pool.query(
        `
        INSERT INTO agent_memories
          (id, agent_id, collection, content, importance, timestamp, metadata)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        `,
        [
          memoryId,
          this.agentId,
          this.collectionName,
          content,
          importance,
          timestamp,
          metadata || {}
        ]
      );
      return memoryId;
    } catch (error) {
      console.error('Error adding memory:', error);
      throw error;
    }
  }

  async search(
    query: string,
    topK: number = 3,
    minImportance: number = 0.0
  ): Promise<MemoryItem[]> {
    if (!this.pool) {
      throw new Error('Pool not initialized');
    }

    try {
      const result = await this.pool.query(
        `
        SELECT id, content, importance, timestamp, metadata
        FROM agent_memories
        WHERE agent_id   = $1
          AND collection = $2
          AND importance >= $3
          AND content ILIKE $4
        ORDER BY importance DESC
        LIMIT $5
        `,
        [
          this.agentId,
          this.collectionName,
          minImportance,
          `%${query}%`,
          topK
        ]
      );

      return result.rows.map(row => new MemoryItemImpl(
        row.id,
        row.content,
        row.importance,
        row.timestamp,
        row.metadata
      ));
    } catch (error) {
      console.error('Error searching memories:', error);
      return [];
    }
  }

  async getAllMemories(): Promise<MemoryItem[]> {
    if (!this.pool) {
      throw new Error('Pool not initialized');
    }

    try {
      const result = await this.pool.query(
        `
        SELECT id, content, importance, timestamp, metadata
        FROM agent_memories
        WHERE agent_id = $1 AND collection = $2
        ORDER BY importance DESC
        `,
        [this.agentId, this.collectionName]
      );

      return result.rows.map(row => new MemoryItemImpl(
        row.id,
        row.content,
        row.importance,
        row.timestamp,
        row.metadata
      ));
    } catch (error) {
      console.error('Error getting all memories:', error);
      return [];
    }
  }

  async count(): Promise<number> {
    if (!this.pool) {
      throw new Error('Pool not initialized');
    }

    try {
      const result = await this.pool.query(
        'SELECT COUNT(*) FROM agent_memories WHERE agent_id=$1 AND collection=$2',
        [this.agentId, this.collectionName]
      );
      return parseInt(result.rows[0].count) || 0;
    } catch (error) {
      console.error('Error counting memories:', error);
      return 0;
    }
  }

  async clear(): Promise<void> {
    if (!this.pool) {
      throw new Error('Pool not initialized');
    }

    try {
      await this.pool.query(
        'DELETE FROM agent_memories WHERE agent_id=$1 AND collection=$2',
        [this.agentId, this.collectionName]
      );
    } catch (error) {
      console.error('Error clearing memories:', error);
      throw error;
    }
  }

  async deleteMemory(memoryId: string): Promise<boolean> {
    if (!this.pool) {
      throw new Error('Pool not initialized');
    }

    try {
      const result = await this.pool.query(
        'DELETE FROM agent_memories WHERE id=$1 AND agent_id=$2',
        [memoryId, this.agentId]
      );
      return result.rowCount === 1;
    } catch (error) {
      console.error('Error deleting memory:', error);
      return false;
    }
  }
}
