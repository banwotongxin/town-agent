/**
 * 技能系统模块
 * 用于管理智能体的各种技能，包括技能注册、加载和执行
 */
import * as fs from 'fs';
import * as path from 'path';

/**
 * 技能清单接口
 * 定义技能的元数据和行为
 */
export interface SkillManifest {
  name: string;                // 技能名称
  description: string;         // 技能描述
  trigger_keywords: string[];  // 触发关键词
  trigger_intent?: string;     // 触发意图（可选）
  mcp_dependencies: any[];     // MCP依赖
  system_prompt_enhancement: string; // 系统提示增强
  parameters: Record<string, any>; // 参数
  toDict(): Record<string, any>; // 转换为字典
}

/**
 * 技能清单实现类
 */
export class SkillManifestImpl implements SkillManifest {
  /**
   * 构造函数
   * @param name 技能名称
   * @param description 技能描述
   * @param trigger_keywords 触发关键词
   * @param trigger_intent 触发意图（可选）
   * @param mcp_dependencies MCP依赖
   * @param system_prompt_enhancement 系统提示增强
   * @param parameters 参数
   */
  constructor(
    public name: string,
    public description: string,
    public trigger_keywords: string[] = [],
    public trigger_intent?: string,
    public mcp_dependencies: any[] = [],
    public system_prompt_enhancement: string = "",
    public parameters: Record<string, any> = {}
  ) {}

  /**
   * 转换为字典
   * @returns 技能清单的字典表示
   */
  toDict(): Record<string, any> {
    return {
      name: this.name,
      description: this.description,
      trigger_keywords: this.trigger_keywords,
      trigger_intent: this.trigger_intent,
      mcp_dependencies: this.mcp_dependencies,
      system_prompt_enhancement: this.system_prompt_enhancement,
      parameters: this.parameters
    };
  }

  /**
   * 从 Markdown 文件 (SKILL.md) 加载技能清单
   */
  static fromMarkdown(mdPath: string): SkillManifest {
    try {
      const content = fs.readFileSync(mdPath, 'utf-8');
        
      // 解析 frontmatter (YAML 头部)
      const frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);
        
      if (!frontmatterMatch) {
        console.warn(`[SkillManifest] 文件 ${mdPath} 没有 frontmatter`);
        return new SkillManifestImpl("", "");
      }
        
      const frontmatter = frontmatterMatch[1];
        
      // 简单的 YAML 解析
      const nameMatch = frontmatter.match(/name:\s*(.+)/);
      const descMatch = frontmatter.match(/description:\s*(.+)/);
        
      const name = nameMatch ? nameMatch[1].trim() : "";
      const description = descMatch ? descMatch[1].trim() : "";
      
      // 提取触发关键词
      const triggerKeywords: string[] = [name];
      const commonKeywords = [
        '小说', '写小说', '创作', '故事', '续写', 
        '角色', '世界观', '科幻', '奇幻', '悬疑', 
        '言情', '武侠', '反派', '主角', '章节',
        '魔法', '设计', '构建', '构思', '情节',
        '人物', '背景', '设定', '大纲', '灵感'
      ];
      
      commonKeywords.forEach(keyword => {
        if (description.includes(keyword) && !triggerKeywords.includes(keyword)) {
          triggerKeywords.push(keyword);
        }
      });
        
      return new SkillManifestImpl(
        name,
        description,
        triggerKeywords,
        undefined,
        [],
        content.substring(frontmatterMatch[0].length).trim() // 使用剩余内容作为 system prompt
      );
    } catch (error) {
      console.error(`[SkillManifest] 读取 Markdown 文件失败 ${mdPath}:`, error);
      return new SkillManifestImpl("", "");
    }
  }

  /**
   * 从字典加载技能清单
   * @param data 字典数据
   * @returns 技能清单实例
   */
  static fromDict(data: Record<string, any>): SkillManifest {
    return new SkillManifestImpl(
      data.name || "",
      data.description || "",
      data.trigger_keywords || [],
      data.trigger_intent,
      data.mcp_dependencies || [],
      data.system_prompt_enhancement || "",
      data.parameters || {}
    );
  }
}

/**
 * 基础技能类
 * 所有技能的基类
 */
export class BaseSkill {
  protected manifest: SkillManifest; // 技能清单
  protected isLoaded: boolean;       // 是否加载
  protected mcpClients: any[];       // MCP客户端

  /**
   * 构造函数
   * @param manifest 技能清单
   */
  constructor(manifest: SkillManifest) {
    this.manifest = manifest;
    this.isLoaded = false;
    this.mcpClients = [];
  }

  /**
   * 初始化技能
   */
  async initialize(): Promise<void> {
    this.isLoaded = true;
  }

  /**
   * 清理技能
   */
  async cleanup(): Promise<void> {
    this.isLoaded = false;
    for (const client of this.mcpClients) {
      if (client.close) {
        await client.close();
      }
    }
    this.mcpClients = [];
  }

  /**
   * 匹配查询
   * @param query 查询字符串
   * @returns 是否匹配
   */
  match(query: string): boolean {
    const queryLower = query.toLowerCase();
    for (const keyword of this.manifest.trigger_keywords) {
      if (queryLower.includes(keyword.toLowerCase())) {
        return true;
      }
    }
    return false;
  }

  /**
   * 执行技能
   * @param query 查询字符串
   * @param context 上下文（可选）
   * @param kwargs 额外参数（可选）
   * @returns 执行结果
   */
  async execute(
    query: string,
    context?: Record<string, any>,
    kwargs?: Record<string, any>
  ): Promise<string> {
    return `[技能 ${this.manifest.name}] 已激活，但尚未实现具体功能。`;
  }

  /**
   * 获取系统提示
   * @returns 系统提示字符串
   */
  getSystemPrompt(): string {
    if (this.manifest.system_prompt_enhancement) {
      return `\n[专业技能：${this.manifest.name}]\n${this.manifest.system_prompt_enhancement}`;
    }
    return "";
  }

  /**
   * 获取技能清单
   */
  get Manifest(): SkillManifest {
    return this.manifest;
  }

  /**
   * 获取技能是否加载
   */
  get IsLoaded(): boolean {
    return this.isLoaded;
  }
}

/**
 * 技能注册表
 * 用于管理技能的注册、加载和查询
 */
export class SkillRegistry {
  private skills: Record<string, BaseSkill>; // 技能映射
  private skillClasses: Record<string, new (manifest: SkillManifest) => BaseSkill> = {}; // 技能类映射

  /**
   * 构造函数
   */
  constructor() {
    this.skills = {};
    this.skillClasses = {};
  }

  /**
   * 注册技能类
   * @param skillName 技能名称
   * @param skillClass 技能类
   */
  registerSkillClass(
    skillName: string,
    skillClass: new (manifest: SkillManifest) => BaseSkill
  ): void {
    this.skillClasses[skillName] = skillClass;
  }

  /**
   * 注册技能
   * @param skill 技能实例
   */
  registerSkill(skill: BaseSkill): void {
    this.skills[skill.Manifest.name] = skill;
  }

  /**
   * 注销技能
   * @param skillName 技能名称
   * @returns 是否注销成功
   */
  unregisterSkill(skillName: string): boolean {
    if (skillName in this.skills) {
      delete this.skills[skillName];
      return true;
    }
    return false;
  }

  /**
   * 获取技能
   * @param skillName 技能名称
   * @returns 技能实例或undefined
   */
  getSkill(skillName: string): BaseSkill | undefined {
    return this.skills[skillName];
  }

  /**
   * 从目录加载技能
   * @param directory 目录路径
   * @returns 加载的技能数量
   */
  loadSkillsFromDirectory(directory: string): number {
    let count = 0;
    console.log(`[SkillRegistry] 正在从目录加载技能: ${directory}`);

    try {
      if (!fs.existsSync(directory)) {
        console.log(`[SkillRegistry] 目录不存在: ${directory}`);
        return 0;
      }

      const files = fs.readdirSync(directory);
      console.log(`[SkillRegistry] 目录中的文件: ${files.join(', ')}`);
      
      for (const file of files) {
        // 只支持 Markdown 格式 (SKILL.md)
        if (file.toLowerCase() === 'skill.md') {
          try {
            console.log(`[SkillRegistry] 正在解析技能文件: ${file}`);
            const manifest = SkillManifestImpl.fromMarkdown(path.join(directory, file));
            
            if (manifest && manifest.name) {
              console.log(`[SkillRegistry] 解析到技能名称: ${manifest.name}`);
              const skillClass = this.skillClasses[manifest.name];
              console.log(`[SkillRegistry] 查找技能类: ${manifest.name}, 找到: ${!!skillClass}`);
              const skill = skillClass ? new skillClass(manifest) : new BaseSkill(manifest);
              console.log(`[SkillRegistry] 创建技能实例，类型: ${skill.constructor.name}`);
              this.registerSkill(skill);
              count++;
              console.log(`[SkillRegistry] 已加载技能: ${manifest.name}`);
            } else {
              console.log(`[SkillRegistry] 技能清单为空或名称为空`);
            }
          } catch (e) {
            console.error(`加载技能 ${file} 失败：`, e);
          }
        }
      }
    } catch (e) {
      console.error(`加载技能目录失败：`, e);
    }

    console.log(`[SkillRegistry] 从目录 ${directory} 加载了 ${count} 个技能`);
    return count;
  }

  /**
   * 从列表加载技能
   * @param manifests 技能清单列表
   * @returns 加载的技能数量
   */
  loadSkillsFromList(manifests: Record<string, any>[]): number {
    let count = 0;

    for (const data of manifests) {
      const manifest = SkillManifestImpl.fromDict(data);

      if (manifest.name in this.skillClasses) {
        const skillClass = this.skillClasses[manifest.name];
        const skill = new skillClass(manifest);
        this.registerSkill(skill);
      } else {
        const skill = new BaseSkill(manifest);
        this.registerSkill(skill);
      }

      count++;
    }

    return count;
  }

  /**
   * 查找匹配的技能
   * @param query 查询字符串
   * @returns 匹配的技能列表
   */
  findMatchingSkills(query: string): BaseSkill[] {
    const matching: BaseSkill[] = [];
    console.log(`[SkillRegistry] 正在查找匹配的技能，查询: "${query.substring(0, 50)}..."`);
    console.log(`[SkillRegistry] 当前注册的技能数量: ${Object.keys(this.skills).length}`);
    console.log(`[SkillRegistry] 已注册的技能类: ${Object.keys(this.skillClasses).join(', ')}`);

    for (const skill of Object.values(this.skills)) {
      console.log(`[SkillRegistry] 检查技能: ${skill.Manifest.name}, 类型: ${skill.constructor.name}`);
      if (skill.match(query)) {
        console.log(`[SkillRegistry] 技能 ${skill.Manifest.name} 匹配成功!`);
        matching.push(skill);
      }
    }

    console.log(`[SkillRegistry] 找到 ${matching.length} 个匹配的技能`);
    return matching;
  }

  /**
   * 获取所有技能
   * @returns 技能列表
   */
  getAllSkills(): BaseSkill[] {
    return Object.values(this.skills);
  }

  /**
   * 初始化所有技能
   */
  async initializeAll(): Promise<void> {
    for (const skill of Object.values(this.skills)) {
      try {
        await skill.initialize();
      } catch (e) {
        console.error(`初始化技能 ${skill.Manifest.name} 失败：`, e);
      }
    }
  }

  /**
   * 清理所有技能
   */
  async cleanupAll(): Promise<void> {
    for (const skill of Object.values(this.skills)) {
      try {
        await skill.cleanup();
      } catch (e) {
        console.error(`清理技能 ${skill.Manifest.name} 失败：`, e);
      }
    }
  }
}

/**
 * 默认技能列表
 */
export const DEFAULT_SKILLS = [
  {
    name: 'creative_writing',
    description: '创意写作技能，用于创作小说、故事、诗歌等',
    trigger_keywords: ['写小说', '写故事', '创作', '写诗', '写作'],
    trigger_intent: 'creative_writing',
    system_prompt_enhancement: `你是一位经验丰富的作家，擅长各种文学创作。
在创作时，你会：
- 注重情节的连贯性和人物的立体性
- 运用丰富的修辞和生动的描写
- 根据用户需求调整文风和体裁`,
  },
  {
    name: 'health_consultation',
    description: '健康咨询技能，提供医疗建议和健康管理',
    trigger_keywords: ['看病', '健康', '症状', '治疗', '用药', '医生'],
    trigger_intent: 'health_consult',
    system_prompt_enhancement: `你是一位专业的医生，提供健康咨询服务。
在咨询时，你会：
- 耐心询问症状细节
- 给出专业的医学建议
- 提醒用户必要时就医检查
- 注意用语通俗易懂`,
  },
  {
    name: 'code_review',
    description: '代码审查技能，帮助改进代码质量',
    trigger_keywords: ['代码', '编程', 'debug', '审查', '优化', 'python', 'java'],
    trigger_intent: 'code_review',
    system_prompt_enhancement: `你是一位资深程序员，擅长代码审查和优化。
在审查时，你会：
- 指出代码中的问题和潜在 bug
- 提出性能优化建议
- 关注代码可读性和可维护性
- 给出具体的改进示例`,
  },
  {
    name: 'teaching',
    description: '教学答疑技能，解答学习问题',
    trigger_keywords: ['学习', '教学', '题目', '考试', '作业', '知识点'],
    trigger_intent: 'teaching',
    system_prompt_enhancement: `你是一位经验丰富的教师，善于答疑解惑。
在教学时，你会：
- 循循善诱，引导学生思考
- 用简单易懂的方式解释复杂概念
- 鼓励学生，建立学习信心
- 提供练习题巩固知识`,
  },
];

/**
 * 创建默认技能注册表
 * @returns 技能注册表实例
 */
export function createDefaultRegistry(): SkillRegistry {
  const registry = new SkillRegistry();
  
  // 注册自定义技能类（在加载之前注册）
  try {
    const { NovelWriterCnSkill } = require('./write/novel-writer-cn/index');
    registry.registerSkillClass('novel-writer-cn', NovelWriterCnSkill);
    console.log('[SkillRegistry] 已注册 novel-writer-cn 技能类');
  } catch (error) {
    console.warn('[SkillRegistry] 无法注册 novel-writer-cn 技能类:', error);
  }
  
  // 加载 write 目录下的 Markdown skills
  const writeSkillsDir = path.join(__dirname, 'write');
  if (fs.existsSync(writeSkillsDir)) {
    console.log('[SkillRegistry] 扫描 write 目录...');
    const subdirs = fs.readdirSync(writeSkillsDir);
    
    for (const subdir of subdirs) {
      const skillDir = path.join(writeSkillsDir, subdir);
      const stats = fs.statSync(skillDir);
      
      if (stats.isDirectory()) {
        const skillMdPath = path.join(skillDir, 'SKILL.md');
        if (fs.existsSync(skillMdPath)) {
          console.log(`[SkillRegistry] 发现技能目录: ${subdir}`);
          registry.loadSkillsFromDirectory(skillDir);
        }
      }
    }
  }
  
  // 加载默认技能列表
  registry.loadSkillsFromList(DEFAULT_SKILLS);
  
  return registry;
}

// 全局技能注册表实例
let globalRegistry: SkillRegistry | null = null;

/**
 * 获取技能注册表
 * @returns 技能注册表实例
 */
export function getSkillRegistry(): SkillRegistry {
  if (!globalRegistry) {
    globalRegistry = createDefaultRegistry();
  }
  return globalRegistry;
}
