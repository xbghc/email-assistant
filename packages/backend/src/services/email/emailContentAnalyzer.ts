import logger from '../../utils/logger';
import AIService from '../ai/aiService';
import { ParsedEmail } from './emailReceiveService';

export interface ContentAnalysisResult {
  isWorkReport: boolean;
  isScheduleRequest: boolean;
  isGeneralInquiry: boolean;
  confidence: number;
  keywords: string[];
  summary: string;
  urgency: 'low' | 'medium' | 'high';
  category: 'work_report' | 'schedule_planning' | 'general_inquiry' | 'admin_command' | 'other';
}

export interface ReminderSkipRecommendation {
  shouldSkipMorningReminder: boolean;
  shouldSkipEveningReminder: boolean;
  reason: string;
  confidence: number;
}

/**
 * 邮件内容智能分析服务
 * 负责分析邮件内容，识别工作报告、日程安排等类型
 */
class EmailContentAnalyzer {
  private aiService: AIService;

  constructor() {
    this.aiService = new AIService();
  }

  /**
   * 分析邮件内容
   */
  async analyzeContent(email: ParsedEmail): Promise<ContentAnalysisResult> {
    try {
      const content = email.textContent || '';
      const subject = email.subject || '';
      
      // 使用AI分析邮件内容
      const analysisPrompt = `
你是一个专业的邮件内容分析助手。请分析以下邮件内容，识别其类型和特征：

邮件主题：${subject}
邮件正文：${content}

请分析并返回JSON格式的结果：
{
  "isWorkReport": boolean, // 是否为工作报告/总结
  "isScheduleRequest": boolean, // 是否为日程安排请求
  "isGeneralInquiry": boolean, // 是否为一般咨询
  "confidence": number, // 置信度 (0-1)
  "keywords": ["关键词1", "关键词2"], // 提取的关键词
  "summary": "内容摘要", // 50字以内的内容摘要
  "urgency": "low|medium|high", // 紧急程度
  "category": "work_report|schedule_planning|general_inquiry|admin_command|other" // 主要类别
}

工作报告特征：
- 包含完成的任务、项目进展、工作成果
- 描述今天/昨天的工作情况
- 包含时间管理、效率反思
- 包含数据、指标、结果等具体信息

日程安排特征：
- 询问或要求安排会议、活动
- 涉及时间规划、提醒设置
- 包含日历、时间表相关内容

一般咨询特征：
- 询问问题、寻求建议
- 日常沟通、闲聊
- 反馈意见、建议

请确保返回有效的JSON格式。
      `;

      const result = await this.aiService.generateResponse(
        '你是一个专业的邮件内容分析助手，擅长识别邮件类型和提取关键信息。',
        analysisPrompt,
        { maxTokens: 800, temperature: 0.3 }
      );

      // 解析AI返回的结果
      const analysis = this.parseAnalysisResult(result, email);
      
      logger.info(`Email content analyzed: ${email.subject} -> ${analysis.category} (confidence: ${analysis.confidence})`);
      
      return analysis;
    } catch (error) {
      logger.error('Failed to analyze email content:', error);
      
      // 返回基于规则的分析结果作为fallback
      return this.fallbackAnalysis(email);
    }
  }

  /**
   * 基于内容分析，推荐是否跳过提醒
   */
  async analyzeForReminderSkip(email: ParsedEmail): Promise<ReminderSkipRecommendation> {
    try {
      const contentAnalysis = await this.analyzeContent(email);
      
      // 如果是工作报告，可能需要跳过晚间提醒
      if (contentAnalysis.isWorkReport && contentAnalysis.confidence > 0.7) {
        return {
          shouldSkipMorningReminder: false,
          shouldSkipEveningReminder: true,
          reason: '用户已发送工作报告，无需晚间提醒',
          confidence: contentAnalysis.confidence
        };
      }

      // 如果是日程安排，可能需要跳过晨间提醒
      if (contentAnalysis.isScheduleRequest && contentAnalysis.confidence > 0.7) {
        return {
          shouldSkipMorningReminder: true,
          shouldSkipEveningReminder: false,
          reason: '用户已进行日程安排，无需晨间提醒',
          confidence: contentAnalysis.confidence
        };
      }

      // 使用AI进行更详细的分析
      const skipAnalysisPrompt = `
根据以下邮件内容，判断是否应该跳过今天的提醒：

邮件主题：${email.subject}
邮件正文：${email.textContent || ''}
内容类型：${contentAnalysis.category}
置信度：${contentAnalysis.confidence}

请分析并返回JSON格式的建议：
{
  "shouldSkipMorningReminder": boolean, // 是否应该跳过晨间提醒
  "shouldSkipEveningReminder": boolean, // 是否应该跳过晚间提醒
  "reason": "跳过原因", // 详细说明为什么跳过
  "confidence": number // 置信度 (0-1)
}

跳过规则：
1. 如果用户发送了详细的工作报告/总结，可以跳过晚间提醒
2. 如果用户主动安排了今天的日程，可以跳过晨间提醒
3. 如果用户表达了暂停提醒的意愿，应该跳过相应提醒
4. 如果邮件内容表明用户已经完成了提醒的目标，可以跳过

请确保返回有效的JSON格式。
      `;

      const result = await this.aiService.generateResponse(
        '你是一个智能提醒管理助手，能够根据用户行为智能决定是否跳过提醒。',
        skipAnalysisPrompt,
        { maxTokens: 400, temperature: 0.2 }
      );

      const skipRecommendation = this.parseSkipRecommendation(result);
      
      logger.info(`Reminder skip analysis: ${email.subject} -> skip morning: ${skipRecommendation.shouldSkipMorningReminder}, skip evening: ${skipRecommendation.shouldSkipEveningReminder}`);
      
      return skipRecommendation;
    } catch (error) {
      logger.error('Failed to analyze for reminder skip:', error);
      
      // 返回保守的默认建议
      return {
        shouldSkipMorningReminder: false,
        shouldSkipEveningReminder: false,
        reason: '分析失败，保持正常提醒',
        confidence: 0.1
      };
    }
  }

  /**
   * 解析AI返回的分析结果
   */
  private parseAnalysisResult(result: string, email: ParsedEmail): ContentAnalysisResult {
    try {
      // 提取JSON部分
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          isWorkReport: parsed.isWorkReport || false,
          isScheduleRequest: parsed.isScheduleRequest || false,
          isGeneralInquiry: parsed.isGeneralInquiry || false,
          confidence: parsed.confidence || 0.5,
          keywords: parsed.keywords || [],
          summary: parsed.summary || '',
          urgency: parsed.urgency || 'medium',
          category: parsed.category || 'other'
        };
      }
    } catch (error) {
      logger.warn('Failed to parse AI analysis result, using fallback:', error);
    }
    
    return this.fallbackAnalysis(email);
  }

  /**
   * 解析跳过提醒的建议
   */
  private parseSkipRecommendation(result: string): ReminderSkipRecommendation {
    try {
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          shouldSkipMorningReminder: parsed.shouldSkipMorningReminder || false,
          shouldSkipEveningReminder: parsed.shouldSkipEveningReminder || false,
          reason: parsed.reason || '无特殊建议',
          confidence: parsed.confidence || 0.5
        };
      }
    } catch (error) {
      logger.warn('Failed to parse skip recommendation, using default:', error);
    }
    
    return {
      shouldSkipMorningReminder: false,
      shouldSkipEveningReminder: false,
      reason: '解析失败，保持正常提醒',
      confidence: 0.1
    };
  }

  /**
   * 基于规则的fallback分析
   */
  private fallbackAnalysis(email: ParsedEmail): ContentAnalysisResult {
    const subject = email.subject?.toLowerCase() || '';
    const content = email.textContent?.toLowerCase() || '';
    const text = `${subject} ${content}`;
    
    // 工作报告关键词
    const workReportKeywords = [
      '工作报告', '工作总结', '今天完成', '项目进展', '任务完成',
      '工作成果', '完成了', '处理了', '解决了', '进展', '成果',
      'work report', 'summary', 'completed', 'finished', 'progress'
    ];
    
    // 日程安排关键词
    const scheduleKeywords = [
      '日程', '安排', '会议', '时间', '提醒', '计划', '明天',
      '下周', '月度', '预约', '约定', '日历',
      'schedule', 'meeting', 'appointment', 'calendar', 'remind'
    ];
    
    // 管理员命令关键词
    const adminKeywords = [
      '/', '/help', '/status', '/user', '/admin', '/system'
    ];
    
    let isWorkReport = false;
    let isScheduleRequest = false;
    let isGeneralInquiry = true;
    let category: ContentAnalysisResult['category'] = 'other';
    let confidence = 0.6;
    let urgency: ContentAnalysisResult['urgency'] = 'medium';
    const keywords: string[] = [];
    
    // 检查工作报告
    const workMatches = workReportKeywords.filter(keyword => text.includes(keyword));
    if (workMatches.length > 0) {
      isWorkReport = true;
      isGeneralInquiry = false;
      category = 'work_report';
      confidence = Math.min(0.8, 0.3 + workMatches.length * 0.1);
      keywords.push(...workMatches);
    }
    
    // 检查日程安排
    const scheduleMatches = scheduleKeywords.filter(keyword => text.includes(keyword));
    if (scheduleMatches.length > 0) {
      isScheduleRequest = true;
      if (!isWorkReport) {
        isGeneralInquiry = false;
        category = 'schedule_planning';
        confidence = Math.min(0.8, 0.3 + scheduleMatches.length * 0.1);
      }
      keywords.push(...scheduleMatches);
    }
    
    // 检查管理员命令
    const adminMatches = adminKeywords.filter(keyword => text.includes(keyword));
    if (adminMatches.length > 0) {
      category = 'admin_command';
      confidence = 0.9;
      urgency = 'high';
      keywords.push(...adminMatches);
    }
    
    if (isGeneralInquiry && !isWorkReport && !isScheduleRequest) {
      category = 'general_inquiry';
      confidence = 0.7;
    }
    
    return {
      isWorkReport,
      isScheduleRequest,
      isGeneralInquiry,
      confidence,
      keywords,
      summary: content.substring(0, 50) + (content.length > 50 ? '...' : ''),
      urgency,
      category
    };
  }
}

export default EmailContentAnalyzer;