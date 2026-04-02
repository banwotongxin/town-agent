"""对话压缩器

用于压缩对话历史，生成摘要
"""

from typing import List, Optional
from langchain_core.messages import BaseMessage, HumanMessage, AIMessage


class ConversationCompressor:
    """
    对话压缩器
    
    使用 LLM 压缩对话历史，生成摘要
    """
    
    def __init__(self):
        """
        初始化对话压缩器
        """
        pass
    
    def compress(
        self,
        messages: List[BaseMessage],
        existing_summary: Optional[str] = None,
        max_tokens: int = 500
    ) -> str:
        """
        压缩对话历史
        
        Args:
            messages: 对话消息列表
            existing_summary: 现有的摘要（如果有）
            max_tokens: 最大令牌数
            
        Returns:
            压缩后的摘要
        """
        # 简单的压缩实现
        # 实际项目中应该使用 LLM 进行智能压缩
        
        # 构建对话文本
        conversation_text = []
        
        for msg in messages:
            if isinstance(msg, HumanMessage):
                conversation_text.append(f"用户：{msg.content}")
            elif isinstance(msg, AIMessage):
                conversation_text.append(f"助手：{msg.content}")
        
        conversation_str = "\n".join(conversation_text)
        
        # 生成摘要
        if existing_summary:
            new_summary = f"{existing_summary}\n\n[新对话]\n{conversation_str[:max_tokens * 4]}"
        else:
            new_summary = f"[对话摘要]\n{conversation_str[:max_tokens * 4]}"
        
        return new_summary
    
    def should_compress(
        self,
        messages: List[BaseMessage],
        threshold: int = 10
    ) -> bool:
        """
        判断是否需要压缩
        
        Args:
            messages: 对话消息列表
            threshold: 消息数量阈值
            
        Returns:
            是否需要压缩
        """
        return len(messages) >= threshold
    
    def get_compression_ratio(self, original: str, compressed: str) -> float:
        """
        计算压缩率
        
        Args:
            original: 原始文本
            compressed: 压缩后文本
            
        Returns:
            压缩率 (0-1)
        """
        if not original:
            return 0.0
        return len(compressed) / len(original)
