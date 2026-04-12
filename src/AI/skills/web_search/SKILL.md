---
name: web_search
description: 使用网络搜索获取消息，搜集用户提问问题关联的信息等
version: 1.0.0
author: Cyber Town
tags:
  - search
  - web
  - information
trigger_keywords:
  - 搜索
  - 上网
  - 查一下
  - 查一查
  - 查查
  - 查找
  - 查询
  - 最新
  - 新闻
  - 实时
  - 当前
  - 现在
  - search
  - look up
  - find
  - check
mcp_dependencies:
  - dashscope_websearch
system_prompt_enhancement: |
  【重要】当用户询问需要最新信息、新闻、实时数据或动态内容时，你必须调用 bailian_web_search 工具进行搜索。
  
  工具调用规则：
  1. 从用户输入中提取核心查询关键词作为 query 参数
  2. count 参数可省略（默认5条）或根据需求设置
  3. 不要自己编造信息，必须通过工具获取真实数据
  4. 如果用户明确要求搜索/查询/查找，优先使用此工具
  
  示例：
  - 用户说"查一下李艳的最新新闻" → 调用 bailian_web_search(query="李艳 最新新闻")
  - 用户说"今天天气怎么样" → 调用 bailian_web_search(query="今天天气")
  - 用户说"TypeScript最新版本" → 调用 bailian_web_search(query="TypeScript 最新版本")
---

# Web Search Skill

## 概述

这个技能允许智能体使用阿里云 DashScope WebSearch MCP 进行网络搜索，获取最新的网络信息。

## 何时使用

- 用户询问需要最新信息的问题
- 需要验证实时事实或数据
- 查询新闻、事件、天气等动态信息
- 需要了解某个主题的最新进展

## 如何使用

当匹配到此技能时，系统会自动加载 `dashscope_websearch` MCP 服务器，并提供 `bailian_web_search` 工具。

### 工具名称

- `dashscope_websearch_bailian_web_search`
- 或简写为 `bailian_web_search`

### 参数

```json
{
  "query": "搜索关键词",
  "count": 5  // 可选，默认5条结果
}
```

### 示例

**用户**: "TypeScript最新版本是什么？"
**智能体**: 调用 `bailian_web_search` 工具，查询 "TypeScript 最新版本"

**用户**: "今天的天气怎么样？"
**智能体**: 调用 `bailian_web_search` 工具，查询 "今天天气 [城市名]"

## 注意事项

1. 只在确实需要最新信息时使用网络搜索
2. 对于常识性或静态知识，优先使用内部知识
3. 搜索结果可能包含多个来源，需要综合判断
4. 注意搜索结果的时效性和可靠性
