"""
MCP Lazy Loader
MCP 协议懒加载机制
"""

from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field
import asyncio


@dataclass
class MCPServerConfig:
    """
    MCP 服务器配置
    
    Attributes:
        name: 服务器名称
        command: 启动命令
        args: 命令行参数
        env: 环境变量
        timeout: 超时时间（秒）
    """
    name: str
    command: str
    args: List[str] = field(default_factory=list)
    env: Dict[str, str] = field(default_factory=dict)
    timeout: int = 30


class MCPLazyLoader:
    """
    MCP 懒加载器
    
    按需启动和加载 MCP Server，节省资源
    """
    
    def __init__(self):
        """初始化 MCP 懒加载器"""
        self._configs: Dict[str, MCPServerConfig] = {}
        self._clients: Dict[str, Any] = {}
        self._loading: Dict[str, asyncio.Lock] = {}
    
    def register_server(self, config: MCPServerConfig) -> None:
        """
        注册 MCP 服务器配置
        
        Args:
            config: 服务器配置
        """
        self._configs[config.name] = config
        self._loading[config.name] = asyncio.Lock()
    
    def register_from_dict(self, name: str, config_dict: Dict) -> None:
        """从字典注册服务器"""
        config = MCPServerConfig(
            name=name,
            command=config_dict.get('command', ''),
            args=config_dict.get('args', []),
            env=config_dict.get('env', {}),
            timeout=config_dict.get('timeout', 30),
        )
        self.register_server(config)
    
    async def get_client(self, server_name: str) -> Optional[Any]:
        """
        获取或创建 MCP 客户端（懒加载）
        
        Args:
            server_name: 服务器名称
            
        Returns:
            MCP 客户端实例
        """
        # 如果已加载，直接返回
        if server_name in self._clients:
            return self._clients[server_name]
        
        # 获取锁，防止重复加载
        if server_name not in self._loading:
            self._loading[server_name] = asyncio.Lock()
        
        async with self._loading[server_name]:
            # 双重检查
            if server_name in self._clients:
                return self._clients[server_name]
            
            # 加载新客户端
            client = await self._load_client(server_name)
            if client:
                self._clients[server_name] = client
            
            return client
    
    async def _load_client(self, server_name: str) -> Optional[Any]:
        """
        实际加载 MCP 客户端
        
        Args:
            server_name: 服务器名称
            
        Returns:
            MCP 客户端实例
        """
        if server_name not in self._configs:
            print(f"MCP 服务器 {server_name} 未注册")
            return None
        
        config = self._configs[server_name]
        
        try:
            # TODO: 实际实现时，这里应该使用 mcp SDK 启动客户端
            # from mcp import ClientSession, StdioServerParameters
            # from mcp.client.stdio import stdio_client
            
            print(f"正在启动 MCP 服务器：{config.name}")
            
            # 模拟实现
            mock_client = MockMCPClient(config.name)
            await mock_client.connect()
            
            return mock_client
            
        except Exception as e:
            print(f"启动 MCP 服务器 {config.name} 失败：{e}")
            return None
    
    async def unload_client(self, server_name: str) -> bool:
        """
        卸载 MCP 客户端
        
        Args:
            server_name: 服务器名称
            
        Returns:
            是否成功卸载
        """
        if server_name in self._clients:
            client = self._clients[server_name]
            if hasattr(client, 'close'):
                await client.close()
            del self._clients[server_name]
            return True
        return False
    
    async def unload_all(self) -> None:
        """卸载所有 MCP 客户端"""
        for server_name in list(self._clients.keys()):
            await self.unload_client(server_name)
    
    def is_loaded(self, server_name: str) -> bool:
        """检查服务器是否已加载"""
        return server_name in self._clients
    
    def get_loaded_servers(self) -> List[str]:
        """获取已加载的服务器列表"""
        return list(self._clients.keys())


class MockMCPClient:
    """
    模拟 MCP 客户端
    
    用于测试和演示，实际使用时替换为真实的 MCP 客户端
    """
    
    def __init__(self, server_name: str):
        self.server_name = server_name
        self.is_connected = False
        self._tools: List[Dict] = []
    
    async def connect(self) -> None:
        """连接服务器"""
        self.is_connected = True
        print(f"[MockMCPClient] 连接到服务器：{self.server_name}")
        
        # 模拟一些工具
        self._tools = [
            {"name": f"{self.server_name}_tool_1", "description": "示例工具 1"},
            {"name": f"{self.server_name}_tool_2", "description": "示例工具 2"},
        ]
    
    async def close(self) -> None:
        """关闭连接"""
        self.is_connected = False
        print(f"[MockMCPClient] 断开连接：{self.server_name}")
    
    async def list_tools(self) -> List[Dict]:
        """列出可用工具"""
        return self._tools
    
    async def call_tool(self, tool_name: str, **kwargs) -> Any:
        """调用工具"""
        if not self.is_connected:
            raise RuntimeError("未连接到服务器")
        
        print(f"[MockMCPClient] 调用工具：{tool_name}, 参数：{kwargs}")
        return f"[{self.server_name}] 工具 {tool_name} 执行结果"


def create_mcp_loader() -> MCPLazyLoader:
    """创建 MCP 懒加载器"""
    return MCPLazyLoader()


# 预定义的 MCP 服务器配置
DEFAULT_MCP_SERVERS = {
    "literature_search": {
        "command": "python",
        "args": ["-m", "mcp_literature_server"],
        "timeout": 30,
    },
    "medical_database": {
        "command": "python",
        "args": ["-m", "mcp_medical_server"],
        "timeout": 30,
    },
    "code_analysis": {
        "command": "npx",
        "args": ["@mcp/code-analyzer"],
        "timeout": 60,
    },
    "education_tools": {
        "command": "python",
        "args": ["-m", "mcp_education_server"],
        "timeout": 30,
    },
}


def setup_default_mcp_servers(loader: MCPLazyLoader) -> None:
    """设置默认 MCP 服务器"""
    for name, config in DEFAULT_MCP_SERVERS.items():
        loader.register_from_dict(name, config)


# 全局 MCP 加载器
_global_loader: Optional[MCPLazyLoader] = None


def get_mcp_loader() -> MCPLazyLoader:
    """获取全局 MCP 懒加载器"""
    global _global_loader
    if _global_loader is None:
        _global_loader = create_mcp_loader()
        setup_default_mcp_servers(_global_loader)
    return _global_loader
