"""
PostgreSQL Long-Term Memory
基于 PostgreSQL 的长期记忆实现，替代 mock 的内存存储
"""

import time
import json
import uuid
from typing import List, Optional, Dict

from .dual_memory import MemoryItem

# asyncpg 是可选依赖，运行时检查
try:
    import asyncpg
    HAS_ASYNCPG = True
except ImportError:
    HAS_ASYNCPG = False

# 建表 DDL
_CREATE_TABLE_SQL = """
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
"""


class PGLongTermMemory:
    """
    基于 PostgreSQL 的长期记忆

    使用全文关键词检索 + 重要性排序，支持异步操作。
    表结构在首次 initialize() 时自动创建。
    """

    def __init__(
        self,
        agent_id: str,
        collection_name: str = "default",
    ):
        """
        Args:
            agent_id: 所属智能体 ID
            collection_name: 记忆集合名称（用于隔离不同上下文）
        """
        self.agent_id = agent_id
        self.collection_name = collection_name
        self._pool = None  # asyncpg 连接池，由 initialize() 创建

    async def initialize(self) -> None:
        """初始化连接池并建表（幂等）"""
        if not HAS_ASYNCPG:
            raise RuntimeError(
                "asyncpg 未安装，请执行：pip install asyncpg"
            )

        from cyber_town.config import get_pg_config

        config = get_pg_config()
        pool_kwargs = {
            "host": config["host"],
            "port": config["port"],
            "database": config["database"],
            "user": config["user"],
            "min_size": config["min_size"],
            "max_size": config["max_size"],
        }
        if config.get("password"):
            pool_kwargs["password"] = config["password"]

        self._pool = await asyncpg.create_pool(**pool_kwargs)

        async with self._pool.acquire() as conn:
            await conn.execute(_CREATE_TABLE_SQL)

    async def close(self) -> None:
        """关闭连接池"""
        if self._pool:
            await self._pool.close()
            self._pool = None

    async def add_memory(
        self,
        content: str,
        importance: float = 0.5,
        metadata: Optional[Dict] = None,
    ) -> str:
        """
        写入一条长期记忆

        Returns:
            记忆 ID（UUID 字符串）
        """
        memory_id = str(uuid.uuid4())
        async with self._pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO agent_memories
                    (id, agent_id, collection, content, importance, timestamp, metadata)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                """,
                memory_id,
                self.agent_id,
                self.collection_name,
                content,
                importance,
                time.time(),
                json.dumps(metadata or {}),
            )
        return memory_id

    async def search(
        self,
        query: str,
        top_k: int = 3,
        min_importance: float = 0.0,
    ) -> List[MemoryItem]:
        """
        关键词 + 重要性检索记忆

        使用 PostgreSQL ILIKE 全文模糊匹配，按重要性降序返回。
        """
        async with self._pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT id, content, importance, timestamp, metadata
                FROM agent_memories
                WHERE agent_id   = $1
                  AND collection = $2
                  AND importance >= $3
                  AND content ILIKE $4
                ORDER BY importance DESC
                LIMIT $5
                """,
                self.agent_id,
                self.collection_name,
                min_importance,
                f"%{query}%",
                top_k,
            )

        return [
            MemoryItem(
                id=str(row["id"]),
                content=row["content"],
                importance=row["importance"],
                timestamp=row["timestamp"],
                metadata=json.loads(row["metadata"]) if row["metadata"] else {},
            )
            for row in rows
        ]

    async def get_all_memories(self) -> List[MemoryItem]:
        """获取该 agent 在该集合中的全部记忆（按重要性降序）"""
        async with self._pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT id, content, importance, timestamp, metadata
                FROM agent_memories
                WHERE agent_id = $1 AND collection = $2
                ORDER BY importance DESC
                """,
                self.agent_id,
                self.collection_name,
            )

        return [
            MemoryItem(
                id=str(row["id"]),
                content=row["content"],
                importance=row["importance"],
                timestamp=row["timestamp"],
                metadata=json.loads(row["metadata"]) if row["metadata"] else {},
            )
            for row in rows
        ]

    async def count(self) -> int:
        """统计记忆条数"""
        async with self._pool.acquire() as conn:
            result = await conn.fetchval(
                "SELECT COUNT(*) FROM agent_memories WHERE agent_id=$1 AND collection=$2",
                self.agent_id,
                self.collection_name,
            )
        return result or 0

    async def clear(self) -> None:
        """清除该 agent 在该集合中的全部记忆"""
        async with self._pool.acquire() as conn:
            await conn.execute(
                "DELETE FROM agent_memories WHERE agent_id=$1 AND collection=$2",
                self.agent_id,
                self.collection_name,
            )

    async def delete_memory(self, memory_id: str) -> bool:
        """删除单条记忆"""
        async with self._pool.acquire() as conn:
            result = await conn.execute(
                "DELETE FROM agent_memories WHERE id=$1 AND agent_id=$2",
                memory_id,
                self.agent_id,
            )
        return result == "DELETE 1"
