import logger from '../../utils/logger';
import AIService from '../ai/aiService';
import ContextService from './contextService';
import UserService from '../user/userService';
import EmailService from '../email/emailService';
import { ContextEntry } from '../../models/index';
import { User } from '../../models/User';

export interface UserPattern {
  userId: string;
  workingHours: {
    start: string; // HH:MM
    end: string;   // HH:MM
    peakHours: string[]; // 高效时段
  };
  productivityTrends: {
    dailyPattern: Record<string, number>; // 每日工作强度 0-1
    weeklyPattern: Record<string, number>; // 每周工作强度 0-1
    averageReportLength: number;
    reportFrequency: number; // 每周报告次数
  };
  workStyle: {
    preferredTaskTypes: string[]; // 偏好的任务类型
    averageTaskDuration: number; // 平均任务时长（分钟）
    multitaskingLevel: 'low' | 'medium' | 'high';
    focusScore: number; // 专注度评分 0-100
  };
  challenges: {
    common: string[]; // 常见挑战
    recurring: string[]; // 重复出现的问题
    solved: string[]; // 已解决的问题
  };
  achievements: {
    recent: string[]; // 近期成就
    patterns: string[]; // 成就模式
    strengths: string[]; // 优势领域
  };
}

export interface PersonalizedSuggestion {
  type: 'productivity' | 'time_management' | 'skill_development' | 'wellbeing' | 'workflow';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  reasoning: string;
  actionItems: string[];
  expectedBenefit: string;
  timeframe: string; // 建议实施时间框架
  difficulty: 'easy' | 'medium' | 'hard';
  category: string[];
}

export interface PersonalizationResult {
  userId: string;
  generatedAt: Date;
  userPattern: UserPattern;
  suggestions: PersonalizedSuggestion[];
  insights: string[];
  nextReviewDate: Date;
}

class PersonalizationService {
  private aiService: AIService;
  private contextService: ContextService;
  private userService: UserService;
  private emailService: EmailService;

  constructor() {
    this.aiService = new AIService();
    this.contextService = new ContextService();
    this.userService = new UserService();
    this.emailService = new EmailService();
  }

  async initialize(): Promise<void> {
    await this.contextService.initialize();
    await this.userService.initialize();
    logger.info('Personalization service initialized');
  }

  /**
   * 为指定用户生成个性化建议
   */
  async generatePersonalizedSuggestions(userId: string = 'admin'): Promise<PersonalizationResult> {
    try {
      logger.info(`Generating personalized suggestions for user ${userId}`);
      
      const user = this.userService.getUserById(userId);
      if (!user) {
        throw new Error(`User ${userId} not found`);
      }

      // 分析用户模式
      const userPattern = await this.analyzeUserPattern(userId);
      
      // 生成个性化建议
      const suggestions = await this.generateSuggestions(userPattern, user);
      
      // 生成深度洞察
      const insights = await this.generateInsights(userPattern, user);

      const result: PersonalizationResult = {
        userId,
        generatedAt: new Date(),
        userPattern,
        suggestions,
        insights,
        nextReviewDate: this.calculateNextReviewDate()
      };

      logger.info(`Generated ${suggestions.length} personalized suggestions for user ${userId}`);
      return result;
    } catch (error) {
      logger.error('Failed to generate personalized suggestions:', error);
      throw error;
    }
  }

  /**
   * 发送个性化建议邮件
   */
  async sendPersonalizedSuggestions(userId: string = 'admin'): Promise<void> {
    try {
      const result = await this.generatePersonalizedSuggestions(userId);
      await this.sendSuggestionsEmail(result);
      logger.info(`Personalized suggestions sent to user ${userId}`);
    } catch (error) {
      logger.error('Failed to send personalized suggestions:', error);
      throw error;
    }
  }

  /**
   * 分析用户工作模式
   */
  private async analyzeUserPattern(userId: string): Promise<UserPattern> {
    logger.debug(`Analyzing user pattern for ${userId}`);
    
    // 获取最近30天的数据
    const recentEntries = await this.contextService.getRecentContext(30, userId);
    const workEntries = recentEntries.filter(entry => entry.type === 'work_summary');
    
    // 分析工作时间模式
    const workingHours = this.analyzeWorkingHours(workEntries);
    
    // 分析生产力趋势
    const productivityTrends = this.analyzeProductivityTrends(workEntries);
    
    // 分析工作风格
    const workStyle = this.analyzeWorkStyle(workEntries);
    
    // 提取挑战和成就
    const challenges = this.extractChallenges(workEntries);
    const achievements = this.extractAchievements(workEntries);

    return {
      userId,
      workingHours,
      productivityTrends,
      workStyle,
      challenges,
      achievements
    };
  }

  /**
   * 分析工作时间模式
   */
  private analyzeWorkingHours(entries: ContextEntry[]): UserPattern['workingHours'] {
    const timeMap = new Map<number, number>(); // hour -> count
    
    for (const entry of entries) {
      const hour = entry.timestamp.getHours();
      timeMap.set(hour, (timeMap.get(hour) || 0) + 1);
    }
    
    // 找出最活跃的时间段
    const sortedHours = Array.from(timeMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([hour]) => `${hour.toString().padStart(2, '0')}:00`);

    return {
      start: '09:00',
      end: '18:00',
      peakHours: sortedHours.length > 0 ? sortedHours : ['10:00', '14:00']
    };
  }

  /**
   * 分析生产力趋势
   */
  private analyzeProductivityTrends(entries: ContextEntry[]): UserPattern['productivityTrends'] {
    const dailyMap = new Map<string, number[]>(); // dayOfWeek -> lengths
    const weeklyMap = new Map<string, number[]>(); // week -> lengths
    
    for (const entry of entries) {
      const dayOfWeek = entry.timestamp.toLocaleDateString('en-US', { weekday: 'long' });
      const week = this.getWeekKey(entry.timestamp);
      const length = entry.content.length;
      
      if (!dailyMap.has(dayOfWeek)) {
        dailyMap.set(dayOfWeek, []);
      }
      dailyMap.get(dayOfWeek)!.push(length);
      
      if (!weeklyMap.has(week)) {
        weeklyMap.set(week, []);
      }
      weeklyMap.get(week)!.push(length);
    }
    
    const dailyPattern: Record<string, number> = {};
    for (const [day, lengths] of dailyMap) {
      dailyPattern[day] = lengths.reduce((sum, len) => sum + len, 0) / lengths.length / 1000;
    }
    
    const weeklyPattern: Record<string, number> = {};
    for (const [week, lengths] of weeklyMap) {
      weeklyPattern[week] = lengths.reduce((sum, len) => sum + len, 0) / lengths.length / 1000;
    }
    
    const totalLength = entries.reduce((sum, entry) => sum + entry.content.length, 0);
    const averageReportLength = entries.length > 0 ? totalLength / entries.length : 0;
    const reportFrequency = entries.length / 4; // 假设分析4周数据

    return {
      dailyPattern,
      weeklyPattern,
      averageReportLength,
      reportFrequency
    };
  }

  /**
   * 分析工作风格
   */
  private analyzeWorkStyle(entries: ContextEntry[]): UserPattern['workStyle'] {
    const taskTypes = this.extractTaskTypes(entries);
    const avgDuration = this.estimateAverageTaskDuration(entries);
    const multitasking = this.assessMultitaskingLevel(entries);
    const focus = this.calculateFocusScore(entries);

    return {
      preferredTaskTypes: taskTypes,
      averageTaskDuration: avgDuration,
      multitaskingLevel: multitasking,
      focusScore: focus
    };
  }

  /**
   * 提取任务类型
   */
  private extractTaskTypes(entries: ContextEntry[]): string[] {
    const typeKeywords = {
      'development': ['开发', '编程', '代码', 'coding', 'development', 'programming'],
      'meeting': ['会议', '讨论', 'meeting', 'discussion', '沟通'],
      'documentation': ['文档', '记录', 'documentation', '整理'],
      'testing': ['测试', 'testing', '调试', 'debug'],
      'planning': ['计划', '规划', 'planning', '设计'],
      'review': ['审核', '检查', 'review', '评估']
    };

    const typeCounts = new Map<string, number>();
    
    for (const entry of entries) {
      const content = entry.content.toLowerCase();
      for (const [type, keywords] of Object.entries(typeKeywords)) {
        for (const keyword of keywords) {
          if (content.includes(keyword)) {
            typeCounts.set(type, (typeCounts.get(type) || 0) + 1);
            break;
          }
        }
      }
    }

    return Array.from(typeCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([type]) => type);
  }

  /**
   * 估算平均任务时长
   */
  private estimateAverageTaskDuration(entries: ContextEntry[]): number {
    // 基于内容长度估算，简单实现
    const avgLength = entries.reduce((sum, entry) => sum + entry.content.length, 0) / entries.length;
    return Math.min(Math.max(avgLength / 10, 30), 180); // 30分钟到3小时
  }

  /**
   * 评估多任务处理水平
   */
  private assessMultitaskingLevel(entries: ContextEntry[]): 'low' | 'medium' | 'high' {
    const keywords = ['同时', '并行', '多个', '切换', 'meanwhile', 'simultaneously'];
    const multitaskCount = entries.filter(entry => 
      keywords.some(keyword => entry.content.includes(keyword))
    ).length;
    
    const ratio = multitaskCount / entries.length;
    if (ratio > 0.3) return 'high';
    if (ratio > 0.1) return 'medium';
    return 'low';
  }

  /**
   * 计算专注度评分
   */
  private calculateFocusScore(entries: ContextEntry[]): number {
    const focusKeywords = ['完成', '专注', '深入', 'completed', 'focused', 'concentrated'];
    const distractionKeywords = ['打断', '中断', '分心', 'interrupted', 'distracted'];
    
    const focusCount = entries.filter(entry =>
      focusKeywords.some(keyword => entry.content.includes(keyword))
    ).length;
    
    const distractionCount = entries.filter(entry =>
      distractionKeywords.some(keyword => entry.content.includes(keyword))
    ).length;
    
    const baseScore = 70;
    const focusBonus = (focusCount / entries.length) * 30;
    const distractionPenalty = (distractionCount / entries.length) * 20;
    
    return Math.min(Math.max(baseScore + focusBonus - distractionPenalty, 0), 100);
  }

  /**
   * 提取挑战
   */
  private extractChallenges(entries: ContextEntry[]): UserPattern['challenges'] {
    const challengeKeywords = ['困难', '问题', '挑战', '阻碍', 'challenge', 'problem', 'difficulty', 'issue'];
    const solvedKeywords = ['解决', '完成', '修复', 'solved', 'fixed', 'resolved'];
    
    const challenges: string[] = [];
    const solved: string[] = [];
    
    for (const entry of entries) {
      const sentences = entry.content.split(/[。！？\n]/).filter(s => s.length > 10);
      
      for (const sentence of sentences) {
        if (challengeKeywords.some(keyword => sentence.includes(keyword))) {
          if (solvedKeywords.some(keyword => sentence.includes(keyword))) {
            solved.push(sentence.trim());
          } else {
            challenges.push(sentence.trim());
          }
        }
      }
    }
    
    // 检测重复出现的挑战
    const challengeCounts = new Map<string, number>();
    challenges.forEach(challenge => {
      const key = challenge.substring(0, 20); // 简单的重复检测
      challengeCounts.set(key, (challengeCounts.get(key) || 0) + 1);
    });
    
    const recurring = Array.from(challengeCounts.entries())
      .filter(([, count]) => count > 1)
      .map(([challenge]) => challenge);

    return {
      common: [...new Set(challenges)].slice(0, 5),
      recurring: recurring.slice(0, 3),
      solved: [...new Set(solved)].slice(0, 5)
    };
  }

  /**
   * 提取成就
   */
  private extractAchievements(entries: ContextEntry[]): UserPattern['achievements'] {
    const achievementKeywords = ['完成', '成功', '实现', '突破', '优化', 'completed', 'achieved', 'accomplished'];
    const strengthKeywords = ['擅长', '熟练', '精通', 'expert', 'skilled', 'proficient'];
    
    const achievements: string[] = [];
    const strengths: string[] = [];
    
    for (const entry of entries) {
      const sentences = entry.content.split(/[。！？\n]/).filter(s => s.length > 10);
      
      for (const sentence of sentences) {
        if (achievementKeywords.some(keyword => sentence.includes(keyword))) {
          achievements.push(sentence.trim());
        }
        if (strengthKeywords.some(keyword => sentence.includes(keyword))) {
          strengths.push(sentence.trim());
        }
      }
    }
    
    // 分析成就模式
    const patterns = this.analyzeAchievementPatterns(achievements);

    return {
      recent: [...new Set(achievements)].slice(0, 8),
      patterns,
      strengths: [...new Set(strengths)].slice(0, 5)
    };
  }

  /**
   * 分析成就模式
   */
  private analyzeAchievementPatterns(achievements: string[]): string[] {
    const patterns = new Map<string, number>();
    const patternKeywords = {
      '技术突破': ['技术', '代码', '算法', 'technical', 'code'],
      '团队协作': ['团队', '协作', '沟通', 'team', 'collaboration'],
      '效率提升': ['优化', '提升', '改进', 'optimization', 'improvement'],
      '问题解决': ['解决', '修复', 'solved', 'fixed'],
      '学习成长': ['学习', '掌握', 'learned', 'mastered']
    };

    for (const achievement of achievements) {
      for (const [pattern, keywords] of Object.entries(patternKeywords)) {
        if (keywords.some(keyword => achievement.includes(keyword))) {
          patterns.set(pattern, (patterns.get(pattern) || 0) + 1);
        }
      }
    }

    return Array.from(patterns.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([pattern]) => pattern);
  }

  /**
   * 生成个性化建议
   */
  private async generateSuggestions(pattern: UserPattern, user: User): Promise<PersonalizedSuggestion[]> {
    const suggestions: PersonalizedSuggestion[] = [];
    
    // 基于工作时间的建议
    suggestions.push(...this.generateTimeManagementSuggestions(pattern));
    
    // 基于生产力趋势的建议
    suggestions.push(...this.generateProductivitySuggestions(pattern));
    
    // 基于工作风格的建议
    suggestions.push(...this.generateWorkflowSuggestions(pattern));
    
    // 基于挑战的建议
    suggestions.push(...this.generateChallengeSuggestions(pattern));
    
    // 基于技能发展的建议
    suggestions.push(...this.generateSkillDevelopmentSuggestions(pattern));
    
    // 使用AI生成额外的个性化建议
    const aiSuggestions = await this.generateAISuggestions(pattern, user);
    suggestions.push(...aiSuggestions);
    
    // 按优先级排序并限制数量
    return suggestions
      .sort((a, b) => {
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      })
      .slice(0, 8);
  }

  /**
   * 生成时间管理建议
   */
  private generateTimeManagementSuggestions(pattern: UserPattern): PersonalizedSuggestion[] {
    const suggestions: PersonalizedSuggestion[] = [];
    
    if (pattern.workingHours.peakHours.length > 0) {
      suggestions.push({
        type: 'time_management',
        priority: 'high',
        title: '优化高效时段利用',
        description: `根据您的工作模式，您在 ${pattern.workingHours.peakHours.join(', ')} 最为高效`,
        reasoning: '基于您的历史工作记录分析，这些时段您的工作产出最高',
        actionItems: [
          `在 ${pattern.workingHours.peakHours[0]} 安排最重要的深度工作`,
          '避免在高效时段安排例行会议',
          '为创造性工作预留峰值时间'
        ],
        expectedBenefit: '提升 25-40% 的工作效率',
        timeframe: '立即实施',
        difficulty: 'easy',
        category: ['productivity', 'time_management']
      });
    }
    
    if (pattern.productivityTrends.reportFrequency < 3) {
      suggestions.push({
        type: 'time_management',
        priority: 'medium',
        title: '增加工作记录频率',
        description: '定期记录工作进展有助于提升自我认知和效率',
        reasoning: '您目前的工作记录频率较低，增加记录有助于更好地跟踪进展',
        actionItems: [
          '设置每日工作总结提醒',
          '使用简单的任务完成记录模板',
          '每周五进行一次深度工作回顾'
        ],
        expectedBenefit: '提升工作意识和规划能力',
        timeframe: '2-3周养成习惯',
        difficulty: 'easy',
        category: ['productivity', 'habits']
      });
    }

    return suggestions;
  }

  /**
   * 生成生产力建议
   */
  private generateProductivitySuggestions(pattern: UserPattern): PersonalizedSuggestion[] {
    const suggestions: PersonalizedSuggestion[] = [];
    
    if (pattern.workStyle.focusScore < 70) {
      suggestions.push({
        type: 'productivity',
        priority: 'high',
        title: '提升专注力',
        description: '您的专注度评分较低，建议采用专注力提升技巧',
        reasoning: `当前专注度评分为 ${Math.round(pattern.workStyle.focusScore)}，有较大提升空间`,
        actionItems: [
          '尝试番茄钟工作法（25分钟专注 + 5分钟休息）',
          '创建无干扰的工作环境',
          '使用专注力应用屏蔽干扰',
          '设定明确的工作目标和优先级'
        ],
        expectedBenefit: '专注度提升 20-30%，工作质量显著改善',
        timeframe: '2-4周',
        difficulty: 'medium',
        category: ['productivity', 'focus']
      });
    }
    
    if (pattern.workStyle.multitaskingLevel === 'high') {
      suggestions.push({
        type: 'productivity',
        priority: 'medium',
        title: '减少多任务处理',
        description: '过度的多任务处理可能降低整体效率',
        reasoning: '检测到您经常进行多任务处理，这可能影响深度工作质量',
        actionItems: [
          '采用单任务专注模式',
          '将相似任务批量处理',
          '设置任务切换的最小时间间隔',
          '使用任务优先级矩阵'
        ],
        expectedBenefit: '减少认知负荷，提升工作质量',
        timeframe: '3-4周',
        difficulty: 'medium',
        category: ['productivity', 'workflow']
      });
    }

    return suggestions;
  }

  /**
   * 生成工作流程建议
   */
  private generateWorkflowSuggestions(pattern: UserPattern): PersonalizedSuggestion[] {
    const suggestions: PersonalizedSuggestion[] = [];
    
    if (pattern.workStyle.preferredTaskTypes.includes('development')) {
      suggestions.push({
        type: 'workflow',
        priority: 'medium',
        title: '优化开发工作流',
        description: '针对您的开发工作特点，建议优化技术工作流程',
        reasoning: '您的主要工作类型包含大量开发任务',
        actionItems: [
          '建立代码审查的固定时间',
          '使用自动化测试提升代码质量',
          '建立开发环境的标准化配置',
          '设置持续集成流程'
        ],
        expectedBenefit: '提升开发效率和代码质量',
        timeframe: '1-2个月',
        difficulty: 'medium',
        category: ['development', 'workflow']
      });
    }

    return suggestions;
  }

  /**
   * 生成挑战解决建议
   */
  private generateChallengeSuggestions(pattern: UserPattern): PersonalizedSuggestion[] {
    const suggestions: PersonalizedSuggestion[] = [];
    
    if (pattern.challenges.recurring.length > 0) {
      suggestions.push({
        type: 'productivity',
        priority: 'high',
        title: '解决重复性问题',
        description: '识别并系统性解决重复出现的工作挑战',
        reasoning: '检测到一些问题重复出现，需要建立系统性解决方案',
        actionItems: [
          '记录问题出现的模式和触发因素',
          '建立问题解决的标准流程',
          '创建常见问题的解决方案库',
          '定期回顾和优化解决方案'
        ],
        expectedBenefit: '减少重复问题的影响，提升工作连续性',
        timeframe: '4-6周',
        difficulty: 'medium',
        category: ['problem_solving', 'process_improvement']
      });
    }

    return suggestions;
  }

  /**
   * 生成技能发展建议
   */
  private generateSkillDevelopmentSuggestions(pattern: UserPattern): PersonalizedSuggestion[] {
    const suggestions: PersonalizedSuggestion[] = [];
    
    if (pattern.achievements.patterns.length > 0) {
      const strongestPattern = pattern.achievements.patterns[0];
      suggestions.push({
        type: 'skill_development',
        priority: 'low',
        title: '深化核心优势',
        description: `进一步发展您在${strongestPattern}方面的专长`,
        reasoning: `您在${strongestPattern}方面表现突出，值得进一步深化`,
        actionItems: [
          '寻找相关的进阶学习资源',
          '考虑成为团队在该领域的专家',
          '分享经验，建立影响力',
          '探索该领域的前沿发展'
        ],
        expectedBenefit: '建立专业优势，提升职业发展潜力',
        timeframe: '3-6个月',
        difficulty: 'medium',
        category: ['skill_development', 'career_growth']
      });
    }

    return suggestions;
  }

  /**
   * 使用AI生成额外建议
   */
  private async generateAISuggestions(pattern: UserPattern, user: User): Promise<PersonalizedSuggestion[]> {
    try {
      const prompt = `
基于以下用户工作模式分析，生成2-3个个性化的工作建议：

用户信息：
- 姓名：${user.name}
- 专注度评分：${pattern.workStyle.focusScore}
- 偏好任务类型：${pattern.workStyle.preferredTaskTypes.join(', ')}
- 多任务处理水平：${pattern.workStyle.multitaskingLevel}
- 平均报告频率：${pattern.productivityTrends.reportFrequency}次/周

常见挑战：
${pattern.challenges.common.slice(0, 3).join('\n')}

近期成就：
${pattern.achievements.recent.slice(0, 3).join('\n')}

请生成实用、具体、可操作的建议，格式为：
[建议类型] 建议标题 | 简短描述 | 具体行动项目

建议类型可以是：productivity, time_management, skill_development, wellbeing, workflow
`;

      const aiResponse = await this.aiService.generateResponse(
        '你是一个专业的工作效率顾问，擅长分析个人工作模式并提供个性化建议。',
        prompt,
        { maxTokens: 800, temperature: 0.7 }
      );

      return this.parseAISuggestions(aiResponse);
    } catch (error) {
      logger.error('Failed to generate AI suggestions:', error);
      return [];
    }
  }

  /**
   * 解析AI生成的建议
   */
  private parseAISuggestions(aiResponse: string): PersonalizedSuggestion[] {
    const suggestions: PersonalizedSuggestion[] = [];
    const lines = aiResponse.split('\n').filter(line => line.trim() && line.includes('|'));
    
    for (const line of lines.slice(0, 3)) {
      try {
        const parts = line.split('|').map(part => part.trim());
        if (parts.length >= 3) {
          const [typeAndTitle, description, actions] = parts;
          if (typeAndTitle && description && actions) {
            const titleParts = typeAndTitle.split(']').map(s => s.replace('[', '').trim());
            const [typeStr, title] = titleParts.length >= 2 ? titleParts : ['productivity', typeAndTitle];
            
            suggestions.push({
              type: (typeStr as any) || 'productivity',
              priority: 'medium',
              title: title || '个性化建议',
              description: description || '',
              reasoning: 'AI基于您的工作模式分析生成',
              actionItems: actions.split('、').map(item => item.trim()),
              expectedBenefit: '改善工作效率和体验',
              timeframe: '2-4周',
              difficulty: 'medium',
              category: ['ai_generated']
            });
          }
        }
      } catch {
        logger.debug('Failed to parse AI suggestion line:', line);
      }
    }
    
    return suggestions;
  }

  /**
   * 生成深度洞察
   */
  private async generateInsights(pattern: UserPattern, _user: User): Promise<string[]> {
    const insights: string[] = [];
    
    // 工作模式洞察
    if (pattern.workingHours.peakHours.length > 0) {
      insights.push(`您的最佳工作时段是 ${pattern.workingHours.peakHours.join(' 和 ')}，建议在这些时间安排重要任务`);
    }
    
    // 生产力洞察
    const avgReportLength = pattern.productivityTrends.averageReportLength;
    if (avgReportLength > 500) {
      insights.push('您有很好的工作记录习惯，详细的记录有助于反思和改进');
    } else if (avgReportLength < 200) {
      insights.push('建议增加工作记录的详细程度，这有助于更好地跟踪进展和发现问题');
    }
    
    // 技能洞察
    if (pattern.achievements.patterns.length > 0) {
      insights.push(`您在 ${pattern.achievements.patterns[0]} 方面表现突出，这是您的核心优势`);
    }
    
    // 挑战洞察
    if (pattern.challenges.solved.length > pattern.challenges.common.length) {
      insights.push('您很擅长解决问题，建议将成功经验系统化，帮助团队和自己');
    }
    
    // 专注度洞察
    if (pattern.workStyle.focusScore > 80) {
      insights.push('您有很好的专注能力，可以考虑承担更多需要深度思考的工作');
    } else if (pattern.workStyle.focusScore < 60) {
      insights.push('建议优化工作环境和方法来提升专注度，这将显著改善工作质量');
    }

    return insights;
  }

  /**
   * 发送建议邮件
   */
  private async sendSuggestionsEmail(result: PersonalizationResult): Promise<void> {
    const user = this.userService.getUserById(result.userId);
    const userEmail = user?.email || 'admin';
    const userName = user?.name || '用户';

    const subject = `🎯 个性化工作建议 - ${new Date().toLocaleDateString()}`;
    const content = `
您好 ${userName}，

基于您的工作模式分析，为您生成了个性化建议：

## 📊 工作模式分析
• 专注度评分：${Math.round(result.userPattern.workStyle.focusScore)}/100
• 偏好任务类型：${result.userPattern.workStyle.preferredTaskTypes.join(', ')}
• 最佳工作时段：${result.userPattern.workingHours.peakHours.join(', ')}
• 多任务处理：${result.userPattern.workStyle.multitaskingLevel} 水平

## 💡 深度洞察
${result.insights.map(insight => `• ${insight}`).join('\n')}

## 🎯 个性化建议

${result.suggestions.map((suggestion, index) => `
### ${index + 1}. ${suggestion.title} (${this.getPriorityEmoji(suggestion.priority)})
**类型：** ${this.getTypeText(suggestion.type)}
**描述：** ${suggestion.description}

**行动步骤：**
${suggestion.actionItems.map(item => `• ${item}`).join('\n')}

**预期收益：** ${suggestion.expectedBenefit}
**实施时间：** ${suggestion.timeframe}
**难度：** ${this.getDifficultyText(suggestion.difficulty)}
`).join('\n')}

## 📅 下次分析时间
${result.nextReviewDate.toLocaleDateString()}

---
这些建议基于您过去30天的工作数据分析生成。持续使用系统记录工作进展，可以获得更精准的个性化建议。

此致，
您的智能工作助手
    `.trim();

    if (user) {
      await this.emailService.sendEmailToUser(userEmail, subject, content);
    } else {
      await this.emailService.sendEmail(subject, content);
    }
  }

  /**
   * 辅助方法
   */
  private getWeekKey(date: Date): string {
    const year = date.getFullYear();
    const weekNum = Math.ceil((date.getTime() - new Date(year, 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000));
    return `${year}-W${weekNum}`;
  }

  private calculateNextReviewDate(): Date {
    const nextReview = new Date();
    nextReview.setDate(nextReview.getDate() + 14); // 两周后
    return nextReview;
  }

  private getPriorityEmoji(priority: string): string {
    switch (priority) {
      case 'high': return '🔴';
      case 'medium': return '🟡';
      case 'low': return '🟢';
      default: return '⚪';
    }
  }

  private getTypeText(type: string): string {
    const typeMap = {
      'productivity': '生产力提升',
      'time_management': '时间管理',
      'skill_development': '技能发展',
      'wellbeing': '健康福利',
      'workflow': '工作流程'
    };
    return typeMap[type as keyof typeof typeMap] || type;
  }

  private getDifficultyText(difficulty: string): string {
    const difficultyMap = {
      'easy': '简单',
      'medium': '中等',
      'hard': '困难'
    };
    return difficultyMap[difficulty as keyof typeof difficultyMap] || difficulty;
  }

  /**
   * 为所有活跃用户生成个性化建议
   */
  async generatePersonalizedSuggestionsForAllUsers(): Promise<void> {
    try {
      const users = this.userService.getAllUsers().filter(user => user.isActive);
      logger.info(`Generating personalized suggestions for ${users.length} active users`);
      
      for (const user of users) {
        try {
          await this.sendPersonalizedSuggestions(user.id);
          logger.debug(`Personalized suggestions sent to user: ${user.email}`);
        } catch (error) {
          logger.error(`Failed to generate suggestions for user ${user.email}:`, error);
        }
      }
      
      logger.info('All personalized suggestions generation completed');
    } catch (error) {
      logger.error('Failed to generate suggestions for all users:', error);
      throw error;
    }
  }
}

export default PersonalizationService;