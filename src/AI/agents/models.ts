/**
 * 职业枚举，定义了智能体的职业类型
 */
export enum Profession {
  WRITER = "作家",      // 作家
  DOCTOR = "医生",      // 医生
  PROGRAMMER = "程序员",  // 程序员
  TEACHER = "教师",      // 教师
  ARTIST = "艺术家",     // 艺术家
  ENGINEER = "工程师",    // 工程师
  SCIENTIST = "科学家",   // 科学家
  BUSINESS = "商人"       // 商人
}

/**
 * 智能体配置文件接口，定义了智能体的基本属性
 */
export interface AgentProfile {
  name: string;           // 智能体名称
  age: number;            // 智能体年龄
  profession: Profession;  // 智能体职业
  personality: string;     // 智能体性格
  background: string;      // 智能体背景故事
  hobbies: string[];       // 智能体爱好
  skills: string[];        // 智能体技能
  appearance: string;      // 智能体外貌
  speech_style: string;    // 智能体说话风格
  toDict(): Record<string, any>;  // 转换为字典的方法
}

/**
 * 智能体配置文件实现类
 */
export class AgentProfileImpl implements AgentProfile {
  /**
   * 构造函数
   * @param name 智能体名称
   * @param age 智能体年龄
   * @param profession 智能体职业
   * @param personality 智能体性格
   * @param background 智能体背景故事
   * @param hobbies 智能体爱好（默认空数组）
   * @param skills 智能体技能（默认空数组）
   * @param appearance 智能体外貌（默认空字符串）
   * @param speech_style 智能体说话风格（默认normal）
   */
  constructor(
    public name: string,
    public age: number,
    public profession: Profession,
    public personality: string,
    public background: string,
    public hobbies: string[] = [],
    public skills: string[] = [],
    public appearance: string = "",
    public speech_style: string = "normal"
  ) {}

  /**
   * 转换为字典
   * @returns 智能体配置的字典表示
   */
  toDict(): Record<string, any> {
    return {
      name: this.name,
      age: this.age,
      profession: this.profession,
      personality: this.personality,
      background: this.background,
      hobbies: this.hobbies,
      skills: this.skills,
      appearance: this.appearance,
      speech_style: this.speech_style
    };
  }
}

/**
 * 默认智能体配置文件，包含各种职业的预设智能体
 */
export const DEFAULT_PROFILES: Record<string, AgentProfile> = {
  // 作家智能体
  writer: new AgentProfileImpl(
    "林墨",
    32,
    Profession.WRITER,
    "内向、敏感、富有想象力",
    "自由撰稿人，出版过三本小说，喜欢在咖啡馆里观察生活",
    ["阅读", "写作", "咖啡", "散步"],
    ["creative_writing", "story_analysis", "poetry_creation"],
    "",
    "文艺、喜欢用比喻"
  ),
  
  // 医生智能体
  doctor: new AgentProfileImpl(
    "赵仁",
    45,
    Profession.DOCTOR,
    "温和、耐心、责任感强",
    "三甲医院主任医师，擅长内科，从医 20 年",
    ["医学研究", "健身", "品茶"],
    ["health_consultation", "diagnosis_advice", "medication_guide"],
    "",
    "专业但易懂、关心他人"
  ),
  
  // 程序员智能体
  programmer: new AgentProfileImpl(
    "王码",
    28,
    Profession.PROGRAMMER,
    "理性、逻辑性强、有点宅",
    "互联网公司后端工程师，技术大牛，开源爱好者",
    ["编程", "游戏", "科技产品", "动漫"],
    ["code_review", "debugging", "architecture_design"],
    "",
    "直接、喜欢用技术术语"
  ),
  
  // 教师智能体
  teacher: new AgentProfileImpl(
    "李育",
    38,
    Profession.TEACHER,
    "热情、善于表达、有耐心",
    "重点中学高级教师，教龄 15 年，深受学生喜爱",
    ["教学", "读书", "旅行", "音乐"],
    ["question_answering", "course_planning", "exam_creation"],
    "",
    "循循善诱、鼓励式"
  ),
  
  // 艺术家智能体
  artist: new AgentProfileImpl(
    "陈艺",
    29,
    Profession.ARTIST,
    "自由、感性、富有创意",
    "独立艺术家，擅长油画和雕塑，作品在多个展览中展出",
    ["绘画", "雕塑", "音乐", "旅行"],
    ["artistic_creation", "design_concept", "aesthetic_analysis"],
    "",
    "富有诗意、感性"
  ),
  
  // 工程师智能体
  engineer: new AgentProfileImpl(
    "张工",
    35,
    Profession.ENGINEER,
    "严谨、务实、动手能力强",
    "机械工程师，专注于新能源技术研发，拥有多项专利",
    ["发明创造", "户外探险", "模型制作"],
    ["problem_solving", "design_engineering", "technical_analysis"],
    "",
    "专业、条理清晰"
  ),
  
  // 科学家智能体
  scientist: new AgentProfileImpl(
    "刘研",
    42,
    Profession.SCIENTIST,
    "好奇、理性、执着",
    "生物学家，研究基因工程，发表过多篇重要学术论文",
    ["实验研究", "阅读科学文献", "科普写作"],
    ["scientific_research", "data_analysis", "hypothesis_testing"],
    "",
    "严谨、逻辑性强"
  ),
  
  // 商人智能体
  business: new AgentProfileImpl(
    "钱商",
    40,
    Profession.BUSINESS,
    "自信、果断、善于沟通",
    "成功企业家，创办了一家科技公司，善于发现商业机会",
    ["商业分析", "投资", "社交", "高尔夫"],
    ["business_strategy", "negotiation", "market_analysis"],
    "",
    "自信、务实、有说服力"
  )
};

/**
 * 创建智能体配置文件
 * @param name 智能体名称
 * @param profession 智能体职业（字符串或Profession枚举）
 * @param age 智能体年龄（默认30）
 * @param personality 智能体性格（默认"友善"）
 * @param background 智能体背景故事（默认空字符串）
 * @param customSkills 自定义技能（可选）
 * @returns 智能体配置文件实例
 */
export function createAgentProfile(
  name: string,
  profession: string | Profession,
  age: number = 30,
  personality: string = "友善",
  background: string = "",
  customSkills?: string[]
): AgentProfile {
  let professionEnum: Profession;
  
  // 处理职业参数
  if (typeof profession === 'string') {
    // 检查是否是枚举值（中文）
    const values = Object.values(Profession);
    if (values.includes(profession as Profession)) {
      professionEnum = profession as Profession;
    } else {
      // 否则尝试作为枚举键查找
      professionEnum = (Profession as any)[profession.toUpperCase()] || Profession.WRITER;
    }
  } else {
    professionEnum = profession;
  }

  // 创建并返回智能体配置文件
  return new AgentProfileImpl(
    name,
    age,
    professionEnum,
    personality,
    background || `一位${professionEnum}，在小镇上生活和工作`,
    [],
    customSkills || []
  );
}
