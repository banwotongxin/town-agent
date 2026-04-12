import { Pool } from 'pg';
import { MemoryItem, MemoryItemImpl, LongTermMemoryInterface } from './dual_memory';

/**
 * PostgreSQL 长期记忆实现
 * 使用 PostgreSQL 数据库存储智能体的长期记忆
 */
export class PGLongTermMemory implements LongTermMemoryInterface {
  // 智能体ID
  private agentId: string;
  // 记忆集合名称
  private collectionName: string;
  // PostgreSQL 连接池
  private pool: Pool | null;

  /**
   * 构造函数
   * @param agentId 智能体ID
   * @param collectionName 记忆集合名称，默认为"default"
   */
  constructor(
    agentId: string,
    collectionName: string = "default"
  ) {
    this.agentId = agentId;
    this.collectionName = collectionName;
    this.pool = null;
  }

  /**
   * 初始化内存系统
   * 连接到 PostgreSQL 数据库并创建必要的表结构
   */
  async initialize(): Promise<void> {
    try {
      // 从配置中获取数据库连接信息
      const config = this.getPgConfig();
      
      // 创建连接池
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
      throw new Error(`Failed to initialize PGLongTermMemory: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 获取 PostgreSQL 配置
   * @returns 数据库配置对象
   */
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

  /**
   * 创建记忆表
   * 如果表不存在则创建
   */
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

  /**
   * 关闭连接池
   */
  async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
  }

  /**
   * 添加记忆
   * @param content 记忆内容
   * @param importance 重要性，默认0.5
   * @param metadata 元数据（可选）
   * @returns 记忆ID
   */
  async addMemory(
    content: string,
    importance: number = 0.5,
    metadata?: Record<string, any>
  ): Promise<string> {
    if (!this.pool) {
      throw new Error('Pool not initialized');
    }

    const timestamp = Date.now() / 1000;

    try {
      const result = await this.pool.query(
        `
        INSERT INTO agent_memories
          (agent_id, collection, content, importance, timestamp, metadata)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id
        `,
        [
          this.agentId,
          this.collectionName,
          content,
          importance,
          timestamp,
          metadata || {}
        ]
      );
      return result.rows[0].id;
    } catch (error) {
      throw new Error(`Failed to add memory: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 搜索记忆
   * @param query 查询字符串
   * @param topK 返回结果数量，默认3
   * @param minImportance 最小重要性，默认0.0
   * @returns 记忆项数组
   */
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
      throw new Error(`Failed to search memories: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 获取所有记忆
   * @returns 记忆项数组
   */
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
      throw new Error(`Failed to get all memories: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 计算记忆数量
   * @returns 记忆数量
   */
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
      throw new Error(`Failed to count memories: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 清空记忆
   */
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
      throw new Error(`Failed to clear memories: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 删除指定记忆
   * @param memoryId 记忆ID
   * @returns 是否删除成功
   */
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
      throw new Error(`Failed to delete memory: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
