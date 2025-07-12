import logger from '../../utils/logger';
import AIService from '../ai/aiService';
import ContextService from './contextService';
import EmailService from '../email/emailService';
import UserService from '../user/userService';
import { ContextEntry } from '../../models/index';

export interface WeeklyReportData {
  userId: string;
  weekStart: Date;
  weekEnd: Date;
  workSummaries: ContextEntry[];
  totalEntries: number;
  achievements: string[];
  challenges: string[];
  productivity: {
    activeDays: number;
    totalReports: number;
    averageReportLength: number;
  };
}

export interface GeneratedWeeklyReport {
  title: string;
  summary: string;
  achievements: string[];
  challenges: string[];
  insights: string[];
  recommendations: string[];
  metrics: {
    activeDays: number;
    totalReports: number;
    productivityTrend: 'improving' | 'stable' | 'declining';
  };
  nextWeekGoals: string[];
}

class WeeklyReportService {
  private aiService: AIService;
  private contextService: ContextService;
  private emailService: EmailService;
  private userService: UserService;

  constructor() {
    this.aiService = new AIService();
    this.contextService = new ContextService();
    this.emailService = new EmailService();
    this.userService = new UserService();
  }

  async initialize(): Promise<void> {
    await this.contextService.initialize();
    await this.userService.initialize();
    logger.info('Weekly report service initialized');
  }

  /**
   * 生成指定用户的周报
   */
  async generateWeeklyReport(userId: string = 'admin', weekOffset: number = 0): Promise<GeneratedWeeklyReport> {
    try {
      logger.info(`Generating weekly report for user ${userId}, week offset: ${weekOffset}`);
      
      const weekData = await this.collectWeekData(userId, weekOffset);
      const report = await this.generateReport(weekData);
      
      logger.info(`Weekly report generated for user ${userId}: ${report.title}`);
      return report;
    } catch (error) {
      logger.error('Failed to generate weekly report:', error);
      throw error;
    }
  }

  /**
   * 生成并发送周报邮件
   */
  async generateAndSendWeeklyReport(userId: string = 'admin', weekOffset: number = 0): Promise<void> {
    try {
      const report = await this.generateWeeklyReport(userId, weekOffset);
      await this.sendWeeklyReportEmail(report, userId);
      logger.info(`Weekly report sent to user ${userId}`);
    } catch (error) {
      logger.error('Failed to generate and send weekly report:', error);
      throw error;
    }
  }

  /**
   * 收集一周的工作数据
   */
  private async collectWeekData(userId: string, weekOffset: number): Promise<WeeklyReportData> {
    const weekStart = this.getWeekStart(weekOffset);
    const weekEnd = this.getWeekEnd(weekStart);
    
    logger.debug(`Collecting data from ${weekStart.toISOString()} to ${weekEnd.toISOString()}`);

    // 获取指定时间范围内的工作报告
    const allEntries = await this.contextService.getContext(undefined, userId);
    const weekEntries = allEntries.filter(entry => 
      entry.timestamp >= weekStart && 
      entry.timestamp <= weekEnd &&
      (entry.type === 'work_summary' || entry.type === 'conversation')
    );

    const workSummaries = weekEntries.filter(entry => entry.type === 'work_summary');
    
    // 分析成就和挑战
    const achievements = this.extractAchievements(weekEntries);
    const challenges = this.extractChallenges(weekEntries);

    // 计算生产力指标
    const activeDays = this.calculateActiveDays(workSummaries);
    const totalReports = workSummaries.length;
    const averageReportLength = workSummaries.length > 0 
      ? workSummaries.reduce((sum, entry) => sum + entry.content.length, 0) / workSummaries.length
      : 0;

    return {
      userId,
      weekStart,
      weekEnd,
      workSummaries,
      totalEntries: weekEntries.length,
      achievements,
      challenges,
      productivity: {
        activeDays,
        totalReports,
        averageReportLength
      }
    };
  }

  /**
   * 使用AI生成周报内容
   */
  private async generateReport(weekData: WeeklyReportData): Promise<GeneratedWeeklyReport> {
    const workContent = weekData.workSummaries
      .map(entry => `[${entry.timestamp.toLocaleDateString()}] ${entry.content}`)
      .join('\n\n');

    const prompt = `
基于以下一周的工作记录，生成一份专业的周报。请分析工作内容、识别关键成就、发现挑战并提供建设性建议。

时间范围：${weekData.weekStart.toLocaleDateString()} - ${weekData.weekEnd.toLocaleDateString()}
工作记录条数：${weekData.workSummaries.length}
活跃工作天数：${weekData.productivity.activeDays}

工作记录内容：
${workContent}

请生成包含以下部分的周报：
1. 工作总体概述
2. 主要成就亮点
3. 遇到的挑战
4. 深度洞察分析
5. 改进建议
6. 下周目标建议

请用中文回复，保持专业和建设性的语调。`;

    try {
      const aiResponse = await this.aiService.generateResponse(
        '你是一个专业的工作效率分析师，擅长从工作记录中提取关键信息并生成有价值的周报。',
        prompt,
        { maxTokens: 1500, temperature: 0.7 }
      );

      return this.parseAIResponse(aiResponse, weekData);
    } catch (error) {
      logger.error('Failed to generate AI report:', error);
      // 如果AI生成失败，返回基础版本
      return this.generateBasicReport(weekData);
    }
  }

  /**
   * 解析AI生成的周报内容
   */
  private parseAIResponse(aiResponse: string, weekData: WeeklyReportData): GeneratedWeeklyReport {
    // 尝试解析AI响应，提取关键部分
    const lines = aiResponse.split('\n').filter(line => line.trim());
    
    let achievements: string[] = [];
    let challenges: string[] = [];
    let insights: string[] = [];
    let recommendations: string[] = [];
    let nextWeekGoals: string[] = [];

    let currentSection = '';
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.includes('成就') || trimmed.includes('亮点')) {
        currentSection = 'achievements';
      } else if (trimmed.includes('挑战') || trimmed.includes('困难')) {
        currentSection = 'challenges';
      } else if (trimmed.includes('洞察') || trimmed.includes('分析')) {
        currentSection = 'insights';
      } else if (trimmed.includes('建议') || trimmed.includes('改进')) {
        currentSection = 'recommendations';
      } else if (trimmed.includes('下周') || trimmed.includes('目标')) {
        currentSection = 'nextWeek';
      } else if (trimmed.startsWith('- ') || trimmed.startsWith('• ')) {
        const content = trimmed.substring(2);
        switch (currentSection) {
          case 'achievements':
            achievements.push(content);
            break;
          case 'challenges':
            challenges.push(content);
            break;
          case 'insights':
            insights.push(content);
            break;
          case 'recommendations':
            recommendations.push(content);
            break;
          case 'nextWeek':
            nextWeekGoals.push(content);
            break;
        }
      }
    }

    // 计算生产力趋势
    const productivityTrend = this.calculateProductivityTrend(weekData);

    return {
      title: `工作周报 - ${weekData.weekStart.toLocaleDateString()} 至 ${weekData.weekEnd.toLocaleDateString()}`,
      summary: aiResponse.split('\n').slice(0, 3).join(' '),
      achievements: achievements.length > 0 ? achievements : ['完成了本周的常规工作任务'],
      challenges: challenges.length > 0 ? challenges : ['暂无特别挑战'],
      insights: insights.length > 0 ? insights : ['保持了稳定的工作节奏'],
      recommendations: recommendations.length > 0 ? recommendations : ['继续保持当前工作状态'],
      metrics: {
        activeDays: weekData.productivity.activeDays,
        totalReports: weekData.productivity.totalReports,
        productivityTrend
      },
      nextWeekGoals: nextWeekGoals.length > 0 ? nextWeekGoals : ['继续高效完成工作任务']
    };
  }

  /**
   * 生成基础版周报（AI失败时的备选方案）
   */
  private generateBasicReport(weekData: WeeklyReportData): GeneratedWeeklyReport {
    const activeDays = weekData.productivity.activeDays;
    const totalReports = weekData.productivity.totalReports;
    
    return {
      title: `工作周报 - ${weekData.weekStart.toLocaleDateString()} 至 ${weekData.weekEnd.toLocaleDateString()}`,
      summary: `本周共记录了 ${totalReports} 条工作报告，活跃工作天数 ${activeDays} 天。`,
      achievements: weekData.achievements.length > 0 ? weekData.achievements : ['完成了本周的常规工作任务'],
      challenges: weekData.challenges.length > 0 ? weekData.challenges : ['暂无特别挑战'],
      insights: [
        `本周工作活跃度：${activeDays}/7 天`,
        `平均每日工作记录长度：${Math.round(weekData.productivity.averageReportLength)} 字符`
      ],
      recommendations: [
        activeDays < 5 ? '建议增加工作记录频率，更好地跟踪工作进展' : '保持良好的工作记录习惯',
        '继续关注工作质量和效率的平衡'
      ],
      metrics: {
        activeDays,
        totalReports,
        productivityTrend: this.calculateProductivityTrend(weekData)
      },
      nextWeekGoals: ['继续保持高效的工作状态', '完善工作流程和方法']
    };
  }

  /**
   * 发送周报邮件
   */
  private async sendWeeklyReportEmail(report: GeneratedWeeklyReport, userId: string): Promise<void> {
    const user = this.userService.getUserById(userId);
    const userEmail = user?.email || 'admin';
    const userName = user?.name || '用户';

    const subject = `📊 ${report.title}`;
    const content = `
您好 ${userName}，

以下是您的工作周报：

## 📈 本周概述
${report.summary}

## 🎯 主要成就
${report.achievements.map(item => `• ${item}`).join('\n')}

## 🚧 遇到的挑战
${report.challenges.map(item => `• ${item}`).join('\n')}

## 💡 深度洞察
${report.insights.map(item => `• ${item}`).join('\n')}

## 🔧 改进建议
${report.recommendations.map(item => `• ${item}`).join('\n')}

## 📊 工作指标
• 活跃工作天数：${report.metrics.activeDays}/7 天
• 工作记录总数：${report.metrics.totalReports} 条
• 生产力趋势：${this.getTrendEmoji(report.metrics.productivityTrend)} ${this.getTrendText(report.metrics.productivityTrend)}

## 🎯 下周目标
${report.nextWeekGoals.map(item => `• ${item}`).join('\n')}

---
祝您下周工作顺利！

此致，
您的邮件助手
    `.trim();

    if (user) {
      await this.emailService.sendEmailToUser(userEmail, subject, content);
    } else {
      await this.emailService.sendEmail(subject, content);
    }
  }

  /**
   * 获取周的开始时间（周一 00:00）
   */
  private getWeekStart(weekOffset: number = 0): Date {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // 将周日转换为6，其他减1
    
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - daysToMonday - (weekOffset * 7));
    weekStart.setHours(0, 0, 0, 0);
    
    return weekStart;
  }

  /**
   * 获取周的结束时间（周日 23:59）
   */
  private getWeekEnd(weekStart: Date): Date {
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);
    return weekEnd;
  }

  /**
   * 提取成就关键词
   */
  private extractAchievements(entries: ContextEntry[]): string[] {
    const achievements: string[] = [];
    const achievementKeywords = ['完成', '成功', '实现', '达成', '突破', '优化', '改进', '解决'];
    
    for (const entry of entries) {
      for (const keyword of achievementKeywords) {
        if (entry.content.includes(keyword)) {
          // 提取包含关键词的句子
          const sentences = entry.content.split(/[。！？\n]/).filter(s => s.includes(keyword));
          achievements.push(...sentences.slice(0, 2)); // 最多取2个句子
          break;
        }
      }
    }
    
    return [...new Set(achievements)].slice(0, 5); // 去重并限制数量
  }

  /**
   * 提取挑战关键词
   */
  private extractChallenges(entries: ContextEntry[]): string[] {
    const challenges: string[] = [];
    const challengeKeywords = ['困难', '问题', '挑战', '阻碍', '延迟', '错误', '失败', '需要改进'];
    
    for (const entry of entries) {
      for (const keyword of challengeKeywords) {
        if (entry.content.includes(keyword)) {
          const sentences = entry.content.split(/[。！？\n]/).filter(s => s.includes(keyword));
          challenges.push(...sentences.slice(0, 2));
          break;
        }
      }
    }
    
    return [...new Set(challenges)].slice(0, 5);
  }

  /**
   * 计算活跃工作天数
   */
  private calculateActiveDays(workSummaries: ContextEntry[]): number {
    const uniqueDays = new Set(
      workSummaries.map(entry => entry.timestamp.toDateString())
    );
    return uniqueDays.size;
  }

  /**
   * 计算生产力趋势
   */
  private calculateProductivityTrend(weekData: WeeklyReportData): 'improving' | 'stable' | 'declining' {
    const { activeDays, totalReports } = weekData.productivity;
    
    if (activeDays >= 5 && totalReports >= 7) {
      return 'improving';
    } else if (activeDays >= 3 && totalReports >= 4) {
      return 'stable';
    } else {
      return 'declining';
    }
  }

  /**
   * 获取趋势表情符号
   */
  private getTrendEmoji(trend: string): string {
    switch (trend) {
      case 'improving': return '📈';
      case 'stable': return '➡️';
      case 'declining': return '📉';
      default: return '➡️';
    }
  }

  /**
   * 获取趋势文本
   */
  private getTrendText(trend: string): string {
    switch (trend) {
      case 'improving': return '上升趋势，表现优秀';
      case 'stable': return '保持稳定，继续努力';
      case 'declining': return '有待提升，需要关注';
      default: return '保持稳定';
    }
  }

  /**
   * 生成所有活跃用户的周报
   */
  async generateAllUsersWeeklyReports(weekOffset: number = 0): Promise<void> {
    try {
      const users = this.userService.getAllUsers().filter(user => user.isActive);
      logger.info(`Generating weekly reports for ${users.length} active users`);
      
      for (const user of users) {
        try {
          await this.generateAndSendWeeklyReport(user.id, weekOffset);
          logger.debug(`Weekly report sent to user: ${user.email}`);
        } catch (error) {
          logger.error(`Failed to generate weekly report for user ${user.email}:`, error);
        }
      }
      
      logger.info('All weekly reports generation completed');
    } catch (error) {
      logger.error('Failed to generate weekly reports for all users:', error);
      throw error;
    }
  }
}

export default WeeklyReportService;