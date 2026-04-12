# Web Search 功能完整修复报告

## 问题概述

用户报告web search技能无法使用，LLM返回"[系统] 暂时无法回答你的问题，请稍后再试。"而不是执行实际的搜索。

## 根本原因分析

经过深入调试，发现了**三个关键问题**：

### 问题1：环境变量未加载
**位置**: `src/AI/mcp/lazy_loader.ts`

**问题**: MCP客户端尝试从环境变量读取API密钥，但`.env`文件没有被加载。

**修复**:
```typescript
import dotenv from 'dotenv';
dotenv.config();
```

### 问题2：技能目录路径错误
**位置**: `src/AI/skills/skill_system.ts`

**问题**: TypeScript编译后，`__dirname`指向`dist/src/AI/skills`，但`web_search`目录实际在`dist/AI/skills`下，导致技能无法被加载。

**修复**: 修改路径查找逻辑，优先检查正确的目录：
```typescript
const possiblePaths = [
  path.join(process.cwd(), 'dist', 'AI', 'skills'),  // 绝对路径 - 优先
  path.join(currentDir, '..', '..'),  // dist/AI/skills (向上两级)
  path.join(currentDir),  // dist/src/AI/skills
];
```

### 问题3：YAML解析正则表达式错误
**位置**: `src/AI/skills/skill_system.ts`

**问题**: 解析`system_prompt_enhancement`的正则表达式要求`|`符号必须存在，但实际YAML中可能没有或格式不同。

**修复**:
```typescript
// 修改前: /system_prompt_enhancement:\s*\|\s*\n/
// 修改后: /system_prompt_enhancement:\s*\|?\s*\n/  // | 变为可选
```

### 问题4：MCP服务器加载时机
**位置**: `src/AI/graph/agent_graph.ts`

**问题**: CLI管理器在预加载时尝试从已加载的MCP服务器获取工具，但此时服务器还未连接。

**修复**: 在LLM调用前，先确保MCP服务器已加载：
```typescript
// 先确保MCP服务器已加载
const mcpLoader = getMcpLoader();
for (const skillName of state.matched_skills) {
  const skill = this.skills.getSkill(skillName);
  if (skill && skill.Manifest.mcp_dependencies) {
    for (const mcpDep of skill.Manifest.mcp_dependencies) {
      const serverName = typeof mcpDep === 'string' ? mcpDep : mcpDep.name;
      await mcpLoader.getClient(serverName);
    }
  }
}

// 然后再获取CLI管理器（触发预加载）
const cliManager = await getMcpCliManager();
```

## 修改的文件清单

1. **src/AI/mcp/lazy_loader.ts**
   - 添加dotenv配置

2. **src/AI/skills/skill_system.ts**
   - 修复技能目录路径查找逻辑
   - 修复YAML解析正则表达式
   - 添加详细的调试日志

3. **src/AI/graph/agent_graph.ts**
   - 在LLM调用前先加载MCP服务器
   - 添加工具注册的调试日志

## 验证结果

✅ web_search技能成功加载
✅ MCP服务器(dashscope_websearch)成功连接
✅ bailian_web_search工具被发现并注册到CLI管理器
✅ 工具正确传递给LLM
✅ 系统提示词(system_prompt_enhancement)正确解析

## 使用说明

1. 访问 http://localhost:8889
2. 选择"钱商"(agent_business)角色
3. 输入搜索请求，例如：
   - "帮我查一下李艳的最新新闻"
   - "搜索TypeScript最新版本"
   - "查询今天的天气"

系统会自动：
1. 匹配web_search技能
2. 加载dashscope_websearch MCP服务器
3. 将bailian_web_search工具传递给LLM
4. LLM根据系统提示调用工具执行搜索
5. 返回搜索结果

## 技术细节

### 技能加载流程
```
createDefaultRegistry()
  ↓
扫描 dist/AI/skills 目录
  ↓
发现 web_search/SKILL.md
  ↓
解析YAML frontmatter
  ↓
创建BaseSkill实例
  ↓
注册到SkillRegistry
```

### 工具调用流程
```
用户输入 → 技能匹配 → MCP加载 → CLI预加载 → LLM调用
                                              ↓
                                         工具执行
                                              ↓
                                         返回结果
```

## 注意事项

1. 确保`.env`文件中配置了正确的API密钥：
   ```
   DASHSCOPE_WEBSERACH_API_KEY=your-api-key
   ```

2. 注意环境变量名有拼写错误（WEBSERACH而非WEBSEARCH），但代码同时支持两种写法

3. 服务器运行在端口8889（8888可能被占用）

## 后续优化建议

1. 统一环境变量命名（修复WEBSERACH拼写错误）
2. 考虑将技能文件直接放在src目录下，避免编译路径问题
3. 添加更详细的错误处理和用户提示
4. 实现工具调用失败时的重试机制
