"""
Skill System
技能系统 - 插件化的专业技能管理
"""

from typing import Dict, List, Optional, Any, Callable
from dataclasses import dataclass, field
import yaml
from pathlib import Path


@dataclass
class SkillManifest:
    """
    技能清单
    
    Attributes:
        name: 技能 ID
        description: 技能描述
        trigger_keywords: 触发关键词列表
        trigger_intent: 触发意图
        mcp_dependencies: MCP 依赖配置
        system_prompt_enhancement: 系统提示词增强
        parameters: 参数定义
    """
    name: str
    description: str
    trigger_keywords: List[str] = field(default_factory=list)
    trigger_intent: Optional[str] = None
    mcp_dependencies: List[Dict] = field(default_factory=list)
    system_prompt_enhancement: str = ""
    parameters: Dict = field(default_factory=dict)
    
    @classmethod
    def from_yaml(cls, yaml_path: str) -> "SkillManifest":
        """从 YAML 文件加载"""
        with open(yaml_path, 'r', encoding='utf-8') as f:
            data = yaml.safe_load(f)
        
        return cls(
            name=data.get('name', ''),
            description=data.get('description', ''),
            trigger_keywords=data.get('trigger_keywords', []),
            trigger_intent=data.get('trigger_intent'),
            mcp_dependencies=data.get('mcp_dependencies', []),
            system_prompt_enhancement=data.get('system_prompt_enhancement', ''),
            parameters=data.get('parameters', {}),
        )
    
    @classmethod
    def from_dict(cls, data: Dict) -> "SkillManifest":
        """从字典创建"""
        return cls(**data)
    
    def to_dict(self) -> Dict:
        """转换为字典"""
        return {
            'name': self.name,
            'description': self.description,
            'trigger_keywords': self.trigger_keywords,
            'trigger_intent': self.trigger_intent,
            'mcp_dependencies': self.mcp_dependencies,
            'system_prompt_enhancement': self.system_prompt_enhancement,
            'parameters': self.parameters,
        }


class BaseSkill:
    """
    技能基类
    
    所有具体技能都继承自此类
    """
    
    def __init__(self, manifest: SkillManifest):
        """
        初始化技能
        
        Args:
            manifest: 技能清单
        """
        self.manifest = manifest
        self.is_loaded = False
        self.mcp_clients: List[Any] = []
    
    async def initialize(self) -> None:
        """初始化技能（加载 MCP 等依赖）"""
        self.is_loaded = True
    
    async def cleanup(self) -> None:
        """清理资源"""
        self.is_loaded = False
        # 清理 MCP 客户端
        for client in self.mcp_clients:
            if hasattr(client, 'close'):
                await client.close()
        self.mcp_clients.clear()
    
    def match(self, query: str) -> bool:
        """
        判断是否匹配查询
        
        Args:
            query: 用户查询
            
        Returns:
            是否匹配
        """
        query_lower = query.lower()
        
        # 关键词匹配
        for keyword in self.manifest.trigger_keywords:
            if keyword.lower() in query_lower:
                return True
        
        return False
    
    async def execute(
        self,
        query: str,
        context: Optional[Dict] = None,
        **kwargs
    ) -> str:
        """
        执行技能
        
        Args:
            query: 用户查询
            context: 上下文信息
            **kwargs: 其他参数
            
        Returns:
            执行结果文本
        """
        # 默认实现：返回提示信息
        return f"[技能 {self.manifest.name}] 已激活，但尚未实现具体功能。"
    
    def get_system_prompt(self) -> str:
        """获取技能增强的系统提示词"""
        if self.manifest.system_prompt_enhancement:
            return f"\n[专业技能：{self.manifest.name}]\n{self.manifest.system_prompt_enhancement}"
        return ""


class SkillRegistry:
    """
    技能注册中心
    
    管理所有技能的注册、查找和执行
    """
    
    def __init__(self):
        """初始化技能注册中心"""
        self._skills: Dict[str, BaseSkill] = {}
        self._skill_classes: Dict[str, type] = {}
    
    def register_skill_class(
        self,
        skill_name: str,
        skill_class: type,
    ) -> None:
        """
        注册技能类
        
        Args:
            skill_name: 技能名称
            skill_class: 技能类
        """
        self._skill_classes[skill_name] = skill_class
    
    def register_skill(self, skill: BaseSkill) -> None:
        """
        注册技能实例
        
        Args:
            skill: 技能实例
        """
        self._skills[skill.manifest.name] = skill
    
    def unregister_skill(self, skill_name: str) -> bool:
        """注销技能"""
        if skill_name in self._skills:
            del self._skills[skill_name]
            return True
        return False
    
    def get_skill(self, skill_name: str) -> Optional[BaseSkill]:
        """获取技能"""
        return self._skills.get(skill_name)
    
    def load_skills_from_directory(self, directory: str) -> int:
        """
        从目录加载所有技能配置
        
        Args:
            directory: 技能配置目录
            
        Returns:
            加载的技能数量
        """
        count = 0
        dir_path = Path(directory)
        
        if not dir_path.exists():
            return 0
        
        for yaml_file in dir_path.glob("*.yaml"):
            try:
                manifest = SkillManifest.from_yaml(str(yaml_file))
                
                # 如果有注册的类，创建实例
                if manifest.name in self._skill_classes:
                    skill_class = self._skill_classes[manifest.name]
                    skill = skill_class(manifest)
                    self.register_skill(skill)
                    count += 1
                else:
                    # 使用基类
                    skill = BaseSkill(manifest)
                    self.register_skill(skill)
                    count += 1
                    
            except Exception as e:
                print(f"加载技能 {yaml_file} 失败：{e}")
        
        return count
    
    def load_skills_from_list(self, manifests: List[Dict]) -> int:
        """
        从字典列表加载技能
        
        Args:
            manifests: 技能清单字典列表
            
        Returns:
            加载的技能数量
        """
        count = 0
        
        for data in manifests:
            manifest = SkillManifest.from_dict(data)
            
            if manifest.name in self._skill_classes:
                skill_class = self._skill_classes[manifest.name]
                skill = skill_class(manifest)
            else:
                skill = BaseSkill(manifest)
            
            self.register_skill(skill)
            count += 1
        
        return count
    
    def find_matching_skills(self, query: str) -> List[BaseSkill]:
        """
        查找匹配查询的技能
        
        Args:
            query: 用户查询
            
        Returns:
            匹配的技能列表
        """
        matching = []
        
        for skill in self._skills.values():
            if skill.match(query):
                matching.append(skill)
        
        return matching
    
    def get_all_skills(self) -> List[BaseSkill]:
        """获取所有技能"""
        return list(self._skills.values())
    
    async def initialize_all(self) -> None:
        """初始化所有技能"""
        for skill in self._skills.values():
            try:
                await skill.initialize()
            except Exception as e:
                print(f"初始化技能 {skill.manifest.name} 失败：{e}")
    
    async def cleanup_all(self) -> None:
        """清理所有技能"""
        for skill in self._skills.values():
            try:
                await skill.cleanup()
            except Exception as e:
                print(f"清理技能 {skill.manifest.name} 失败：{e}")


# 预定义的技能模板
DEFAULT_SKILLS = [
    {
        'name': 'creative_writing',
        'description': '创意写作技能，用于创作小说、故事、诗歌等',
        'trigger_keywords': ['写小说', '写故事', '创作', '写诗', '写作'],
        'trigger_intent': 'creative_writing',
        'system_prompt_enhancement': '''你是一位经验丰富的作家，擅长各种文学创作。
在创作时，你会：
- 注重情节的连贯性和人物的立体性
- 运用丰富的修辞和生动的描写
- 根据用户需求调整文风和体裁''',
    },
    {
        'name': 'health_consultation',
        'description': '健康咨询技能，提供医疗建议和健康管理',
        'trigger_keywords': ['看病', '健康', '症状', '治疗', '用药', '医生'],
        'trigger_intent': 'health_consult',
        'system_prompt_enhancement': '''你是一位专业的医生，提供健康咨询服务。
在咨询时，你会：
- 耐心询问症状细节
- 给出专业的医学建议
- 提醒用户必要时就医检查
- 注意用语通俗易懂''',
    },
    {
        'name': 'code_review',
        'description': '代码审查技能，帮助改进代码质量',
        'trigger_keywords': ['代码', '编程', 'debug', '审查', '优化', 'python', 'java'],
        'trigger_intent': 'code_review',
        'system_prompt_enhancement': '''你是一位资深程序员，擅长代码审查和优化。
在审查时，你会：
- 指出代码中的问题和潜在 bug
- 提出性能优化建议
- 关注代码可读性和可维护性
- 给出具体的改进示例''',
    },
    {
        'name': 'teaching',
        'description': '教学答疑技能，解答学习问题',
        'trigger_keywords': ['学习', '教学', '题目', '考试', '作业', '知识点'],
        'trigger_intent': 'teaching',
        'system_prompt_enhancement': '''你是一位经验丰富的教师，善于答疑解惑。
在教学时，你会：
- 循循善诱，引导学生思考
- 用简单易懂的方式解释复杂概念
- 鼓励学生，建立学习信心
- 提供练习题巩固知识''',
    },
]


def create_default_registry() -> SkillRegistry:
    """创建默认技能注册中心"""
    registry = SkillRegistry()
    registry.load_skills_from_list(DEFAULT_SKILLS)
    return registry


# 全局技能注册中心
_global_registry: Optional[SkillRegistry] = None


def get_skill_registry() -> SkillRegistry:
    """获取全局技能注册中心"""
    global _global_registry
    if _global_registry is None:
        _global_registry = create_default_registry()
    return _global_registry
