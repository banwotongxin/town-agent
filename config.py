"""
Cyber Town V2 - 全局配置
从 .env 文件读取配置，初始化 LLM 和数据库连接参数
"""

import os
from functools import lru_cache
from dotenv import load_dotenv
from pathlib import Path

# 获取当前文件所在目录
BASE_DIR = Path(__file__).parent

# 加载 .env 文件
env_path = BASE_DIR / '.env'
print(f"[CONFIG] 尝试加载 .env 文件: {env_path}")
load_dotenv(dotenv_path=env_path, override=True)
print(f"[CONFIG] API Key 存在: {bool(os.getenv('DEEPSEEK_API_KEY'))}")


@lru_cache(maxsize=1)
def get_llm():
    """
    获取 DeepSeek LLM 实例（单例，延迟初始化）

    使用 LangChain 的 ChatOpenAI 兼容接口接入 DeepSeek API。
    DeepSeek V3.2 完全兼容 OpenAI Chat Completions 协议。
    """
    from langchain_openai import ChatOpenAI

    api_key = os.getenv("DEEPSEEK_API_KEY")
    if not api_key:
        # 从文件直接读取API Key作为备用方案
        try:
            with open(env_path, 'r', encoding='utf-8') as f:
                for line in f:
                    line = line.strip()
                    if line.startswith('DEEPSEEK_API_KEY='):
                        api_key = line.split('=', 1)[1]
                        break
        except Exception as e:
            print(f"[CONFIG] 读取 .env 文件失败: {e}")
    
    if not api_key:
        raise ValueError("未找到 DEEPSEEK_API_KEY，请检查 .env 文件")

    return ChatOpenAI(
        model=os.getenv("LLM_MODEL", "deepseek-chat"),
        api_key=api_key,
        base_url=os.getenv("LLM_BASE_URL", "https://api.deepseek.com"),
        temperature=float(os.getenv("LLM_TEMPERATURE", "0.7")),
        max_tokens=int(os.getenv("LLM_MAX_TOKENS", "4096")),
    )


def get_pg_dsn() -> str:
    """返回 asyncpg 格式的 PostgreSQL DSN"""
    host = os.getenv("PG_HOST", "localhost")
    port = os.getenv("PG_PORT", "5432")
    database = os.getenv("PG_DATABASE", "cyber_town")
    user = os.getenv("PG_USER", "postgres")
    password = os.getenv("PG_PASSWORD", "")

    if password:
        return f"postgresql://{user}:{password}@{host}:{port}/{database}"
    return f"postgresql://{user}@{host}:{port}/{database}"


def get_pg_config() -> dict:
    """返回 asyncpg 连接参数字典"""
    return {
        "host": os.getenv("PG_HOST", "localhost"),
        "port": int(os.getenv("PG_PORT", "5432")),
        "database": os.getenv("PG_DATABASE", "cyber_town"),
        "user": os.getenv("PG_USER", "postgres"),
        "password": os.getenv("PG_PASSWORD", "") or None,
        "min_size": int(os.getenv("PG_POOL_MIN", "2")),
        "max_size": int(os.getenv("PG_POOL_MAX", "10")),
    }
