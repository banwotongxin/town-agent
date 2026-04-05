/**
 * 情感等级枚举，定义了智能体之间的关系等级
 */
export enum EmotionLevel {
  STRANGER = 1,      // 陌生人 (0-20)
  ACQUAINTANCE = 2,  // 泛泛之交 (20-40)
  FRIEND = 3,        // 朋友 (40-60)
  GOOD_FRIEND = 4,   // 好友 (60-80)
  CLOSE_FRIEND = 5   // 挚友 (80-100)
}

/**
 * EmotionLevel命名空间，提供情感等级相关的工具方法
 */
export namespace EmotionLevel {
  /**
   * 根据情感分数获取情感等级
   * @param score 情感分数
   * @returns 情感等级
   */
  export function fromScore(score: number): EmotionLevel {
    score = Math.max(0, Math.min(100, score)); // 限制在 0-100

    if (score < 20) {
      return EmotionLevel.STRANGER;
    } else if (score < 40) {
      return EmotionLevel.ACQUAINTANCE;
    } else if (score < 60) {
      return EmotionLevel.FRIEND;
    } else if (score < 80) {
      return EmotionLevel.GOOD_FRIEND;
    } else {
      return EmotionLevel.CLOSE_FRIEND;
    }
  }

  /**
   * 获取情感等级对应的分数范围
   * @param level 情感等级
   * @returns 分数范围 [最小值, 最大值]
   */
  export function getRange(level: EmotionLevel): [number, number] {
    const ranges: Record<EmotionLevel, [number, number]> = {
      [EmotionLevel.STRANGER]: [0, 20],
      [EmotionLevel.ACQUAINTANCE]: [20, 40],
      [EmotionLevel.FRIEND]: [40, 60],
      [EmotionLevel.GOOD_FRIEND]: [60, 80],
      [EmotionLevel.CLOSE_FRIEND]: [80, 100],
    };
    return ranges[level];
  }

  /**
   * 获取情感等级的中文名称
   * @param level 情感等级
   * @returns 中文名称
   */
  export function getTitle(level: EmotionLevel): string {
    const titles: Record<EmotionLevel, string> = {
      [EmotionLevel.STRANGER]: "陌生人",
      [EmotionLevel.ACQUAINTANCE]: "泛泛之交",
      [EmotionLevel.FRIEND]: "朋友",
      [EmotionLevel.GOOD_FRIEND]: "好友",
      [EmotionLevel.CLOSE_FRIEND]: "挚友",
    };
    return titles[level];
  }
}

/**
 * 关系状态类，记录智能体之间的关系信息
 */
export class RelationshipState {
  agentAId: string;           // 智能体A的ID
  agentBId: string;           // 智能体B的ID
  emotionScore: number;        // 情感分数
  level: EmotionLevel;         // 情感等级
  interactionCount: number;    // 互动次数
  lastInteractionTime: number; // 最后互动时间
  nickname?: string;           // 昵称

  /**
   * 构造函数
   * @param agentAId 智能体A的ID
   * @param agentBId 智能体B的ID
   * @param emotionScore 初始情感分数（默认10.0，陌生人）
   * @param level 初始情感等级（默认STRANGER）
   * @param interactionCount 初始互动次数（默认0）
   * @param lastInteractionTime 最后互动时间（默认0.0）
   * @param nickname 昵称（可选）
   */
  constructor(
    agentAId: string,
    agentBId: string,
    emotionScore: number = 10.0, // 初始为陌生人
    level: EmotionLevel = EmotionLevel.STRANGER,
    interactionCount: number = 0,
    lastInteractionTime: number = 0.0,
    nickname?: string
  ) {
    this.agentAId = agentAId;
    this.agentBId = agentBId;
    this.emotionScore = emotionScore;
    this.level = level;
    this.interactionCount = interactionCount;
    this.lastInteractionTime = lastInteractionTime;
    this.nickname = nickname;
  }

  /**
   * 更新情感等级
   * @returns 等级是否发生变化
   */
  updateLevel(): boolean {
    const oldLevel = this.level;
    this.level = EmotionLevel.fromScore(this.emotionScore);
    return oldLevel !== this.level;
  }

  /**
   * 转换为字典
   * @returns 关系状态的字典表示
   */
  toDict(): Record<string, any> {
    return {
      agent_a_id: this.agentAId,
      agent_b_id: this.agentBId,
      emotion_score: Math.round(this.emotionScore * 100) / 100,
      level: this.level,
      level_name: EmotionLevel.getTitle(this.level),
      interaction_count: this.interactionCount,
      nickname: this.nickname,
    };
  }
}

/**
 * 情感计算器类，计算情感分数的变化
 */
export class EmotionCalculator {
  private baseIncrease: number;      // 基础增加量
  private baseDecrease: number;      // 基础减少量
  private decayRate: number;         // 时间衰减率（每天）
  private noInteractionDays: number;  // 开始衰减的天数

  /**
   * 构造函数
   * @param baseIncrease 基础增加量（默认3.0）
   * @param baseDecrease 基础减少量（默认5.0）
   * @param decayRate 时间衰减率（默认0.5）
   * @param noInteractionDays 开始衰减的天数（默认7.0）
   */
  constructor(
    baseIncrease: number = 3.0,     // 基础增加量
    baseDecrease: number = 5.0,     // 基础减少量
    decayRate: number = 0.5,        // 时间衰减率（每天）
    noInteractionDays: number = 7.0  // 开始衰减的天数
  ) {
    this.baseIncrease = baseIncrease;
    this.baseDecrease = baseDecrease;
    this.decayRate = decayRate;
    this.noInteractionDays = noInteractionDays;
  }

  /**
   * 计算情感变化量
   * @param interactionType 互动类型
   * @param currentScore 当前情感分数
   * @param currentLevel 当前情感等级
   * @param sentiment 情感倾向（默认positive）
   * @returns 情感变化量
   */
  calculateDelta(
    interactionType: string,
    currentScore: number,
    currentLevel: EmotionLevel,
    sentiment: string = "positive"
  ): number {
    // 基础变化量
    let delta: number;
    if (sentiment === "positive") {
      delta = this.baseIncrease;
    } else if (sentiment === "negative") {
      delta = -this.baseDecrease;
    } else {
      delta = 0.5; // 中性互动少量增加
    }

    // 互动类型系数
    const typeMultipliers: Record<string, number> = {
      conversation: 1.0,
      help: 1.5,       // 帮助行为增加更多
      gift: 1.3,
      conflict: -2.0,  // 冲突减少更多
      praise: 1.2,
      criticism: -1.5,
    };
    const multiplier = typeMultipliers[interactionType] || 1.0;
    delta *= multiplier;

    // 边际递减效应：等级越高，提升越难
    if (delta > 0) {
      const levelFactor = 1.0 - (currentLevel - 1) * 0.15;
      delta *= Math.max(levelFactor, 0.4);
    }

    // 等级门槛：不能跨级提升
    const [levelMin, levelMax] = EmotionLevel.getRange(currentLevel);
    if (delta > 0) {
      // 最多提升到当前等级上限
      const maxDelta = levelMax - currentScore;
      delta = Math.min(delta, maxDelta * 0.8); // 保留 20% 余量
    }

    return Math.round(delta * 100) / 100;
  }

  /**
   * 应用时间衰减
   * @param currentScore 当前情感分数
   * @param daysSinceLastInteraction 距离上次互动的天数
   * @returns 衰减后的情感分数
   */
  applyTimeDecay(
    currentScore: number,
    daysSinceLastInteraction: number
  ): number {
    if (daysSinceLastInteraction <= this.noInteractionDays) {
      return currentScore;
    }

    // 超过阈值天数后开始衰减
    const decayDays = daysSinceLastInteraction - this.noInteractionDays;
    const decayAmount = decayDays * this.decayRate;

    const newScore = currentScore - decayAmount;
    return Math.max(newScore, 0); // 不低于 0
  }
}

/**
 * 关系存储类，管理智能体之间的关系
 */
export class RelationshipStore {
  private relationships: Record<string, RelationshipState>; // 关系存储

  /**
   * 构造函数
   */
  constructor() {
    this.relationships = {};
  }

  /**
   * 获取关系状态
   * @param agentAId 智能体A的ID
   * @param agentBId 智能体B的ID
   * @returns 关系状态或undefined
   */
  getRelationship(
    agentAId: string,
    agentBId: string
  ): RelationshipState | undefined {
    const key = this.makeKey(agentAId, agentBId);
    return this.relationships[key];
  }

  /**
   * 设置关系状态
   * @param agentAId 智能体A的ID
   * @param agentBId 智能体B的ID
   * @param state 关系状态
   */
  setRelationship(
    agentAId: string,
    agentBId: string,
    state: RelationshipState
  ): void {
    const key = this.makeKey(agentAId, agentBId);
    this.relationships[key] = state;
  }

  /**
   * 获取或创建关系状态
   * @param agentAId 智能体A的ID
   * @param agentBId 智能体B的ID
   * @param initialScore 初始情感分数（默认10.0）
   * @returns 关系状态
   */
  getOrCreate(
    agentAId: string,
    agentBId: string,
    initialScore: number = 10.0
  ): RelationshipState {
    const key = this.makeKey(agentAId, agentBId);

    if (!this.relationships[key]) {
      // 创建新关系
      const state = new RelationshipState(
        agentAId,
        agentBId,
        initialScore
      );
      this.relationships[key] = state;
    }

    return this.relationships[key];
  }

  /**
   * 生成关系键
   * @param agentAId 智能体A的ID
   * @param agentBId 智能体B的ID
   * @returns 关系键
   */
  private makeKey(agentAId: string, agentBId: string): string {
    return [agentAId, agentBId].sort().join("-");
  }

  /**
   * 获取智能体的所有关系
   * @param agentId 智能体ID
   * @returns 关系状态数组
   */
  getAllRelationships(agentId: string): RelationshipState[] {
    const results: RelationshipState[] = [];
    for (const state of Object.values(this.relationships)) {
      if (state.agentAId === agentId || state.agentBId === agentId) {
        results.push(state);
      }
    }
    return results;
  }
}

/**
 * 情感引擎类，管理智能体之间的情感互动
 */
export class EmotionEngine {
  private calculator: EmotionCalculator; // 情感计算器
  private store: RelationshipStore;      // 关系存储

  /**
   * 构造函数
   */
  constructor() {
    this.calculator = new EmotionCalculator();
    this.store = new RelationshipStore();
  }

  /**
   * 智能体之间互动
   * @param agentAId 智能体A的ID
   * @param agentBId 智能体B的ID
   * @param interactionType 互动类型（默认conversation）
   * @param sentiment 情感倾向（默认positive）
   * @returns 互动结果
   */
  interact(
    agentAId: string,
    agentBId: string,
    interactionType: string = "conversation",
    sentiment: string = "positive"
  ): Record<string, any> {
    // 获取或创建关系
    const relationship = this.store.getOrCreate(agentAId, agentBId);

    // 计算情感变化
    const delta = this.calculator.calculateDelta(
      interactionType,
      relationship.emotionScore,
      relationship.level,
      sentiment
    );

    // 更新分数
    const oldLevel = relationship.level;
    relationship.emotionScore += delta;
    relationship.emotionScore = Math.max(0, Math.min(100, relationship.emotionScore)); // 限制在 0-100
    relationship.interactionCount += 1;
    relationship.lastInteractionTime = Date.now() / 1000; // 转换为秒

    // 检查等级变化
    const levelChanged = relationship.updateLevel();

    // 等级提升时可能触发特殊事件
    let eventTriggered = false;
    if (levelChanged && delta > 0) {
      eventTriggered = true;
      // TODO: 可以添加升级事件通知
    }

    return {
      old_score: Math.round((relationship.emotionScore - delta) * 100) / 100,
      new_score: Math.round(relationship.emotionScore * 100) / 100,
      delta,
      old_level: EmotionLevel.getTitle(oldLevel),
      new_level: EmotionLevel.getTitle(relationship.level),
      level_changed: levelChanged,
      event_triggered: eventTriggered,
    };
  }

  /**
   * 获取关系信息
   * @param agentAId 智能体A的ID
   * @param agentBId 智能体B的ID
   * @returns 关系信息或undefined
   */
  getRelationshipInfo(
    agentAId: string,
    agentBId: string
  ): Record<string, any> | undefined {
    const relationship = this.store.getRelationship(agentAId, agentBId);
    if (relationship) {
      return relationship.toDict();
    }
    return undefined;
  }

  /**
   * 获取对话风格提示
   * @param level 情感等级
   * @returns 对话风格提示
   */
  getConversationStyleHint(level: EmotionLevel): string {
    const hints: Record<EmotionLevel, string> = {
      [EmotionLevel.STRANGER]: `
[对话风格：陌生人]
- 使用尊称（您、先生、女士）
- 语气礼貌但保持距离
- 话题相对浅表，避免涉及隐私
- 回复较为正式和简短`,
      
      [EmotionLevel.ACQUAINTANCE]: `
[对话风格：泛泛之交]
- 可以使用一般称呼（姓 + 职业/称呼）
- 语气友好但仍有一定距离
- 可以分享一些日常话题
- 开始展现一些个人特点`,
      
      [EmotionLevel.FRIEND]: `
[对话风格：朋友]
- 可以直接称呼名字
- 语气轻松自然
- 分享日常生活和感受
- 互相关心，提供帮助
- 可以开一些善意的玩笑`,
      
      [EmotionLevel.GOOD_FRIEND]: `
[对话风格：好友]
- 可以使用昵称或外号
- 语气亲密，不拘束
- 分享更深层次的想法和情感
- 主动关心对方的状况
- 开玩笑更加随意`,
      
      [EmotionLevel.CLOSE_FRIEND]: `
[对话风格：挚友]
- 使用专属昵称
- 完全信任和坦诚
- 无话不谈，分享最深的秘密
- 强烈的关心和保护欲
- 对话充满默契和理解`,
    };
    return hints[level] || "";
  }
}

// 全局情感引擎实例
let globalEmotionEngine: EmotionEngine | null = null;

/**
 * 获取全局情感引擎实例
 * @returns 情感引擎实例
 */
export function getEmotionEngine(): EmotionEngine {
  if (!globalEmotionEngine) {
    globalEmotionEngine = new EmotionEngine();
  }
  return globalEmotionEngine;
}

/**
 * 创建情感引擎实例
 * @returns 情感引擎实例
 */
export function createEmotionEngine(): EmotionEngine {
  return new EmotionEngine();
}
