"""
MCP Package
MCP 模块 - Model Context Protocol 懒加载机制
"""

from .lazy_loader import (
    MCPLazyLoader,
    MCPServerConfig,
    MockMCPClient,
    create_mcp_loader,
    DEFAULT_MCP_SERVERS,
    setup_default_mcp_servers,
    get_mcp_loader,
)

__all__ = [
    "MCPLazyLoader",
    "MCPServerConfig",
    "MockMCPClient",
    "create_mcp_loader",
    "DEFAULT_MCP_SERVERS",
    "setup_default_mcp_servers",
    "get_mcp_loader",
]
