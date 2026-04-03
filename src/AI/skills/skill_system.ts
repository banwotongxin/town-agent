import * as fs from 'fs';
import * as path from 'path';

export interface SkillManifest {
  name: string;
  description: string;
  trigger_keywords: string[];
  trigger_intent?: string;
  mcp_dependencies: any[];
  system_prompt_enhancement: string;
  parameters: Record<string, any>;
  toDict(): Record<string, any>;
}

export class SkillManifestImpl implements SkillManifest {
  constructor(
    public name: string,
    public description: string,
    public trigger_keywords: string[] = [],
    public trigger_intent?: string,
    public mcp_dependencies: any[] = [],
    public system_prompt_enhancement: string = "",
    public parameters: Record<string, any> = {}
  ) {}

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

  static fromYaml(yamlPath: string): SkillManifest {
    // 这里需要实现从YAML文件加载的逻辑
    // 暂时返回一个默认实例
    return new SkillManifestImpl("", "");
  }

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

export class BaseSkill {
  protected manifest: SkillManifest;
  protected isLoaded: boolean;
  protected mcpClients: any[];

  constructor(manifest: SkillManifest) {
    this.manifest = manifest;
    this.isLoaded = false;
    this.mcpClients = [];
  }

  async initialize(): Promise<void> {
    this.isLoaded = true;
  }

  async cleanup(): Promise<void> {
    this.isLoaded = false;
    for (const client of this.mcpClients) {
      if (client.close) {
        await client.close();
      }
    }
    this.mcpClients = [];
  }

  match(query: string): boolean {
    const queryLower = query.toLowerCase();
    for (const keyword of this.manifest.trigger_keywords) {
      if (queryLower.includes(keyword.toLowerCase())) {
        return true;
      }
    }
    return false;
  }

  async execute(
    query: string,
    context?: Record<string, any>,
    kwargs?: Record<string, any>
  ): Promise<string> {
    return `[技能 ${this.manifest.name}] 已激活，但尚未实现具体功能。`;
  }

  getSystemPrompt(): string {
    if (this.manifest.system_prompt_enhancement) {
      return `\n[专业技能：${this.manifest.name}]\n${this.manifest.system_prompt_enhancement}`;
    }
    return "";
  }

  get Manifest(): SkillManifest {
    return this.manifest;
  }

  get IsLoaded(): boolean {
    return this.isLoaded;
  }
}

export class SkillRegistry {
  private skills: Record<string, BaseSkill>;
  private skillClasses: Record<string, new (manifest: SkillManifest) => BaseSkill>;

  constructor() {
    this.skills = {};
    this.skillClasses = {};
  }

  registerSkillClass(
    skillName: string,
    skillClass: new (manifest: SkillManifest) => BaseSkill
  ): void {
    this.skillClasses[skillName] = skillClass;
  }

  registerSkill(skill: BaseSkill): void {
    this.skills[skill.Manifest.name] = skill;
  }

  unregisterSkill(skillName: string): boolean {
    if (skillName in this.skills) {
      delete this.skills[skillName];
      return true;
    }
    return false;
  }

  getSkill(skillName: string): BaseSkill | undefined {
    return this.skills[skillName];
  }

  loadSkillsFromDirectory(directory: string): number {
    let count = 0;

    try {
      if (!fs.existsSync(directory)) {
        return 0;
      }

      const files = fs.readdirSync(directory);
      for (const file of files) {
        if (file.endsWith('.yaml') || file.endsWith('.yml')) {
          try {
            const yamlPath = path.join(directory, file);
            const manifest = SkillManifestImpl.fromYaml(yamlPath);

            if (manifest.name in this.skillClasses) {
              const skillClass = this.skillClasses[manifest.name];
              const skill = new skillClass(manifest);
              this.registerSkill(skill);
              count++;
            } else {
              const skill = new BaseSkill(manifest);
              this.registerSkill(skill);
              count++;
            }
          } catch (e) {
            console.error(`加载技能 ${file} 失败：`, e);
          }
        }
      }
    } catch (e) {
      console.error(`加载技能目录失败：`, e);
    }

    return count;
  }

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

  findMatchingSkills(query: string): BaseSkill[] {
    const matching: BaseSkill[] = [];

    for (const skill of Object.values(this.skills)) {
      if (skill.match(query)) {
        matching.push(skill);
      }
    }

    return matching;
  }

  getAllSkills(): BaseSkill[] {
    return Object.values(this.skills);
  }

  async initializeAll(): Promise<void> {
    for (const skill of Object.values(this.skills)) {
      try {
        await skill.initialize();
      } catch (e) {
        console.error(`初始化技能 ${skill.Manifest.name} 失败：`, e);
      }
    }
  }

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

export function createDefaultRegistry(): SkillRegistry {
  const registry = new SkillRegistry();
  registry.loadSkillsFromList(DEFAULT_SKILLS);
  return registry;
}

let globalRegistry: SkillRegistry | null = null;

export function getSkillRegistry(): SkillRegistry {
  if (!globalRegistry) {
    globalRegistry = createDefaultRegistry();
  }
  return globalRegistry;
}
