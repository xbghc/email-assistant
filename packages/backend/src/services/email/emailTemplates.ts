import config from '../../config/index';
import logger from '../../utils/logger';
import AIService from '../ai/aiService';
import { AIGenerationOptions } from './emailTypes';

/**
 * 邮件模板生成器
 * 负责生成各种类型的邮件内容，包括AI增强的个性化内容
 */
export class EmailTemplateGenerator {
  private aiService: AIService;

  constructor() {
    this.aiService = new AIService();
  }

  /**
   * 生成时间相关的问候语
   * @todo 是否可以去掉，把时间传给AI
   */
  private getTimeBasedGreeting(): string {
    const timeOfDay = new Date().getHours();
    return timeOfDay < 6 ? '早安' : 
           timeOfDay < 12 ? '早上好' : 
           timeOfDay < 14 ? '上午好' :
           timeOfDay < 18 ? '下午好' :
           timeOfDay < 21 ? '晚上好' : '深夜好';
  }

  /**
   * 获取格式化的日期字符串
   */
  private getFormattedDate(): string {
    return new Date().toLocaleDateString('zh-CN', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      weekday: 'long' 
    });
  }

  /**
   * 生成AI增强的内容，带有回退机制
   * @todo 当出错后，向管理员发送邮件
   */
  private async generateAIContent(
    prompt: string, 
    options: AIGenerationOptions,
    fallbackContent: string
  ): Promise<string> {
    try {
      const aiContent = await this.aiService.generateResponse(
        prompt,
        '',
        options
      );
      
      // 检查是否返回了错误消息而不是实际内容
      if (!aiContent || 
          aiContent.includes('系统当前负载较高') || 
          aiContent.includes('请稍后重试') ||
          aiContent.includes('not initialized') ||
          aiContent.length < 10) {
        logger.warn('AI returned error or insufficient content, using fallback');
        return fallbackContent;
      }
      
      return aiContent;
    } catch (error) {
      logger.warn('AI content generation failed, using fallback:', error);
      return fallbackContent;
    }
  }

  /**
   * 生成晨间提醒邮件
   */
  async generateMorningReminder(scheduleContent: string, suggestions: string): Promise<{
    subject: string;
    content: string;
    isAIGenerated: boolean;
  }> {
    const today = new Date();
    const dateStr = this.getFormattedDate();
    const greeting = this.getTimeBasedGreeting();
    
    const aiPrompt = `请为用户生成一份个性化的晨间提醒邮件内容。

用户信息：
- 姓名：${config.email.name || '朋友'}
- 日期：${dateStr}
- 时间：${greeting}

今日日程：
${scheduleContent}

昨日表现建议：
${suggestions}

请生成一份温暖、专业且富有激励性的晨间提醒邮件，包含：
1. 个性化的问候语
2. 对今日日程的精炼总结和重点提醒
3. 基于昨日表现的鼓励性建议
4. 积极正面的祝福和激励

语言要求：中文，语气友好专业，长度控制在300字以内。`;

    const fallbackContent = `
${greeting}，${config.email.name}！

这是您今天的日程安排：

${scheduleContent}

基于昨天的表现，这里有一些建议：

${suggestions}

祝您今天工作愉快！

此致，
您的邮件助手
    `.trim();

    const content = await this.generateAIContent(
      aiPrompt,
      { maxTokens: 500, temperature: 0.7 },
      fallbackContent
    );

    return {
      subject: `📅 ${greeting}！今日日程提醒 - ${today.toLocaleDateString()}`,
      content,
      isAIGenerated: content !== fallbackContent
    };
  }

  /**
   * 生成晚间提醒邮件
   */
  async generateEveningReminder(): Promise<{
    subject: string;
    content: string;
    isAIGenerated: boolean;
  }> {
    const today = new Date();
    const dateStr = this.getFormattedDate();
    const greeting = this.getTimeBasedGreeting();
    
    const aiPrompt = `请为用户生成一份个性化的晚间工作总结请求邮件。

用户信息：
- 姓名：${config.email.name || '朋友'}
- 日期：${dateStr}
- 时间：${greeting}

请生成一份温暖、鼓励且专业的晚间邮件，包含：
1. 个性化的问候语和对一天辛苦工作的认可
2. 引导用户进行自我反思的问题（包括成就、挑战、学习等）
3. 鼓励用户分享明天的计划和目标
4. 温暖的结尾和对用户的支持

要求：
- 语言：中文，语气友好温暖
- 长度：300字以内
- 包含具体的引导性问题
- 体现对用户工作的关心和支持`;

    const fallbackContent = `
${greeting}，${config.email.name}！

现在是时候回顾您的一天了。请回复此邮件并告诉我：

1. 您今天完成了哪些任务？
2. 您的主要成就是什么？
3. 您遇到了什么挑战？
4. 您明天的计划是什么？

您的回复将帮助我提供更好的建议并跟踪您的进展。

此致，
您的邮件助手
    `.trim();

    const content = await this.generateAIContent(
      aiPrompt,
      { maxTokens: 500, temperature: 0.7 },
      fallbackContent
    );

    return {
      subject: `📝 ${greeting}！工作总结时间 - ${today.toLocaleDateString()}`,
      content,
      isAIGenerated: content !== fallbackContent
    };
  }

  /**
   * 生成工作总结邮件
   */
  async generateWorkSummary(summary: string): Promise<{
    subject: string;
    content: string;
    isAIGenerated: boolean;
  }> {
    const today = new Date();
    const dateStr = this.getFormattedDate();
    const greeting = this.getTimeBasedGreeting();
    
    const aiPrompt = `请为用户生成一份个性化的工作总结报告邮件。

用户信息：
- 姓名：${config.email.name || '朋友'}
- 日期：${dateStr}
- 时间：${greeting}

工作总结内容：
${summary}

请生成一份专业、鼓励且具有洞察力的工作总结邮件，包含：
1. 对用户工作成果的认可和赞扬
2. 对总结内容的专业分析和提炼
3. 基于总结的积极反馈和建议
4. 对用户未来工作的鼓励和期待

要求：
- 语言：中文，语气专业且鼓励
- 长度：400字以内
- 体现对用户工作的深度理解
- 提供建设性的反馈和建议`;

    const fallbackContent = `
您好 ${config.email.name}，

这是您今天的工作总结报告：

${summary}

继续保持出色的工作！

此致，
您的邮件助手
    `.trim();

    const content = await this.generateAIContent(
      aiPrompt,
      { maxTokens: 600, temperature: 0.6 },
      fallbackContent
    );

    return {
      subject: `📊 ${greeting}！您的工作总结报告 - ${today.toLocaleDateString()}`,
      content,
      isAIGenerated: content !== fallbackContent
    };
  }

  /**
   * 生成新用户欢迎邮件
   */
  async generateNewUserWelcome(
    userName: string, 
    userEmail: string, 
    morningTime: string, 
    eveningTime: string
  ): Promise<{
    subject: string;
    content: string;
    isAIGenerated: boolean;
  }> {
    const greeting = this.getTimeBasedGreeting();
    
    const aiPrompt = `请为新用户生成一份个性化的智能邮件助手欢迎邮件。

用户信息：
- 姓名：${userName}
- 邮箱：${userEmail}
- 早晨提醒时间：${morningTime}
- 晚间提醒时间：${eveningTime}
- 注册时间：${greeting}

请生成一份热情、专业且信息全面的欢迎邮件，包含：
1. 个性化的欢迎问候
2. 对用户加入的欢迎和感谢
3. 清晰的服务功能介绍
4. 实用的使用指南和技巧
5. 鼓励性的结尾和支持信息

要求：
- 语言：中文，语气热情友好
- 长度：500字以内
- 包含具体的功能说明
- 体现专业性和可信度
- 让用户感受到被重视和支持`;

    const fallbackContent = `
亲爱的 ${userName}，

欢迎使用智能邮件助手服务！🎊

📋 您的账户信息：
• 姓名：${userName}
• 邮箱：${userEmail}
• 早晨提醒时间：${morningTime}
• 晚间提醒时间：${eveningTime}

🤖 您现在可以享受以下服务：
• 每日早晨日程提醒和建议
• 每日晚间工作报告收集和总结
• 智能邮件对话和任务管理
• 个性化提醒时间设置

💡 使用小贴士：
1. 直接回复邮件与AI助手对话
2. 说"请把我的早晨提醒改到8点"来调整时间
3. 说"标记所有邮件为已读"来管理邮件
4. 说"显示我的配置"来查看当前设置

如有任何问题，请随时回复此邮件咨询。

祝您使用愉快！

此致，
智能邮件助手团队
    `.trim();

    const content = await this.generateAIContent(
      aiPrompt,
      { maxTokens: 700, temperature: 0.8 },
      fallbackContent
    );

    return {
      subject: `🎉 ${greeting}！欢迎加入智能邮件助手服务！`,
      content,
      isAIGenerated: content !== fallbackContent
    };
  }

  /**
   * 生成系统启动通知邮件（不使用AI）
   */
  generateSystemStartupNotification(userCount: number): {
    subject: string;
    content: string;
    isAIGenerated: boolean;
  } {
    const content = `
亲爱的管理员，

邮件助手系统已成功启动！🎯

📊 系统状态：
• 启动时间：${new Date().toLocaleString()}
• 注册用户数：${userCount} 人
• AI服务商：${config.ai.provider.toUpperCase()}
• 邮件服务：已连接
• 定时任务：已启动

🔧 管理员功能：
• /adduser <email> <name> [早晨时间] [晚间时间] - 添加用户
• /listusers - 查看所有用户
• /deleteuser <email> - 删除用户
• /updateuser <email> <字段> <值> - 更新用户
• /stats - 查看统计信息
• /help - 查看帮助

💡 提示：发送邮件标题以 / 开头即可执行管理员命令。

系统正在监控邮件并为用户提供服务...

此致，
邮件助手系统
    `.trim();

    return {
      subject: `🚀 邮件助手系统启动通知`,
      content,
      isAIGenerated: false
    };
  }

  /**
   * 生成用户添加通知邮件（不使用AI）
   */
  generateUserAddedNotification(
    adminName: string, 
    newUserName: string, 
    newUserEmail: string
  ): {
    subject: string;
    content: string;
    isAIGenerated: boolean;
  } {
    const content = `
管理员 ${adminName}，

新用户添加成功！🎉

👤 新用户信息：
• 姓名：${newUserName}
• 邮箱：${newUserEmail}
• 添加时间：${new Date().toLocaleString()}
• 状态：已启用

📧 系统已自动向新用户发送欢迎邮件，包含：
• 服务介绍和使用指南
• 账户配置信息
• 常用功能说明

新用户现在可以开始使用邮件助手服务了！

此致，
邮件助手管理系统
    `.trim();

    return {
      subject: `✅ 用户添加成功通知`,
      content,
      isAIGenerated: false
    };
  }

  /**
   * 生成验证码邮件
   */
  generateVerificationCode(email: string, code: string): {
    subject: string;
    content: string;
    isAIGenerated: boolean;
  } {
    const greeting = this.getTimeBasedGreeting();
    
    const content = `
您好，

您的登录验证码是：

${code}

🕒 验证码有效期：30分钟
🔒 为了保障您的账户安全，请勿将验证码泄露给他人

如果这不是您本人的操作，请忽略此邮件。

此致，
邮件助手安全团队
    `.trim();

    return {
      subject: `🔐 ${greeting}！您的登录验证码`,
      content,
      isAIGenerated: false
    };
  }

  /**
   * 生成邮件转发内容
   */
  generateForwardEmail(
    originalFrom: string,
    originalSubject: string,
    originalContent: string,
    originalDate: Date,
    originalTo?: string[]
  ): {
    subject: string;
    content: string;
    isAIGenerated: boolean;
  } {
    const content = `
📧 转发邮件

发件人: ${originalFrom}
收件人: ${originalTo?.join(', ') || '无'}
日期: ${originalDate.toLocaleString()}
主题: ${originalSubject}

──────────────────────

${originalContent}

──────────────────────

此邮件由您的邮件助手自动转发。
    `.trim();

    return {
      subject: `📧 转发邮件: ${originalSubject}`,
      content,
      isAIGenerated: false
    };
  }
}

export default EmailTemplateGenerator;