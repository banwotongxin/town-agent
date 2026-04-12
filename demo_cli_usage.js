/**
 * CLI工具使用示例
 * 
 * 这个脚本演示了如何使用MCP CLI工具进行网络搜索
 */

require('dotenv').config();

const { getMcpLoader } = require('./dist/src/AI/mcp/lazy_loader');
const { getMcpCliManager } = require('./dist/src/AI/cli/mcp_cli_manager');

async function demo() {
  console.log('=== MCP CLI 工具使用演示 ===\n');
  
  // 1. 连接MCP服务器
  console.log('步骤1: 连接MCP服务器...');
  const mcpLoader = await getMcpLoader();
  
  try {
    const client = await mcpLoader.getClient('dashscope_websearch');
    if (client) {
      console.log('✓ 成功连接到 dashscope_websearch 服务器\n');
    }
  } catch (error) {
    console.error('✗ 连接失败:', error.message);
    return;
  }
  
  // 2. 获取CLI管理器（自动预加载工具）
  console.log('步骤2: 初始化CLI管理器...');
  const cliManager = await getMcpCliManager();
  
  const commands = cliManager.getRegisteredCommands();
  console.log(`✓ 已注册 ${commands.length} 个CLI命令`);
  commands.forEach(cmd => {
    console.log(`  - ${cmd.toolName}: ${cmd.description.substring(0, 50)}...`);
  });
  console.log('');
  
  // 3. 执行搜索
  console.log('步骤3: 执行搜索 "李岩是谁"...');
  const result = await cliManager.executeCliCommand('bailian_web_search', {
    query: '李岩是谁',
    count: 3
  });
  
  if (result.success) {
    console.log('✓ 搜索成功！\n');
    
    // 解析结果
    try {
      const output = typeof result.output === 'string' ? JSON.parse(result.output) : result.output;
      
      if (output.content && output.content[0] && output.content[0].text) {
        const searchData = JSON.parse(output.content[0].text);
        
        console.log('搜索结果摘要:\n');
        searchData.pages.forEach((page, index) => {
          console.log(`${index + 1}. ${page.title}`);
          console.log(`   来源: ${page.hostname}`);
          console.log(`   摘要: ${page.snippet.substring(0, 150)}...`);
          console.log(`   链接: ${page.url}\n`);
        });
      }
    } catch (e) {
      console.log('原始输出:', result.output);
    }
  } else {
    console.error('✗ 搜索失败:', result.error);
  }
  
  console.log('\n=== 演示完成 ===');
}

demo().catch(console.error);