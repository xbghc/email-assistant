import logger from '../utils/logger';
import { ContextEntry } from '../models';

export interface MockAIResponse {
  content: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

class MockAIService {
  async generateResponse(systemPrompt: string, userPrompt: string, options?: any): Promise<string> {
    logger.debug('Mock AI generating response for prompt:', userPrompt.substring(0, 100) + '...');
    
    // 根据提示内容返回相应的模拟响应
    if (userPrompt.includes('周报') || userPrompt.includes('weekly')) {
      return this.generateMockWeeklyReport();
    }
    
    if (userPrompt.includes('morning') || userPrompt.includes('日程')) {
      return this.generateMockMorningReminder();
    }
    
    if (userPrompt.includes('summary') || userPrompt.includes('总结')) {
      return this.generateMockSummary();
    }
    
    return '这是一个模拟的AI响应。在测试模式下，所有AI请求都会返回预设的响应内容。';
  }

  async generateMorningSuggestions(type: string, content: string, context: ContextEntry[]): Promise<string> {
    logger.debug('Mock AI generating morning suggestions');
    return `
基于您的日程安排，这里有一些建议：

🎯 今日重点任务：
• 优先处理紧急且重要的工作事项
• 安排30分钟用于团队沟通
• 预留时间处理突发事务

💡 效率提升建议：
• 使用番茄钟工作法提高专注度
• 定期休息，保持良好的工作状态
• 及时记录工作进展和想法

⚡ 注意事项：
• 确保重要会议前做好充分准备
• 保持工作与生活的平衡
• 记得按时用餐和适当运动
    `.trim();
  }

  async summarizeWorkReport(report: string, context: ContextEntry[]): Promise<string> {
    logger.debug('Mock AI summarizing work report');
    return this.generateMockSummary();
  }

  async compressContext(context: ContextEntry[]): Promise<string> {
    logger.debug('Mock AI compressing context');
    return `压缩的上下文摘要（${context.length}条记录）：本周主要完成了多项重要工作任务，包括项目开发、会议沟通、文档整理等。工作进展顺利，团队协作良好。`;
  }

  async generateResponseWithFunctionCalls(systemPrompt: string, userPrompt: string, options?: any, userId?: string): Promise<string> {
    logger.debug('Mock AI generating response with function calls');
    return '感谢您的询问！我已经处理了您的请求。这是一个模拟响应，在实际环境中将通过AI服务提供更智能的回复。';
  }

  private generateMockWeeklyReport(): string {
    return `
## 📈 本周工作概述
本周工作进展顺利，完成了既定目标的85%，团队协作效率良好。

## 🎯 主要成就
• 完成了核心功能模块的开发工作
• 优化了系统性能，响应速度提升30%
• 成功解决了2个关键技术难题
• 完善了项目文档和用户手册

## 🚧 遇到的挑战
• 第三方API集成遇到兼容性问题，已找到解决方案
• 团队成员时间协调有待优化

## 💡 深度洞察
• 工作效率在周三和周四达到峰值
• 早上时段的专注度最高，适合处理复杂任务
• 团队沟通频率合理，但可以更加聚焦

## 🔧 改进建议
• 建议引入更好的项目管理工具
• 增加技术分享会，提升团队整体技能
• 优化工作流程，减少重复性工作

## 🎯 下周目标
• 完成剩余功能模块的开发
• 开始系统测试和优化工作
• 准备项目演示和用户培训材料
    `.trim();
  }

  private generateMockMorningReminder(): string {
    return `
☀️ 早上好！新的一天开始了，让我们一起规划今天的工作：

📅 今日重要事项：
• 09:00 - 团队晨会
• 10:30 - 项目评审会议
• 14:00 - 客户需求讨论
• 16:00 - 代码review

🎯 建议优先级：
1. 高优先级：完成紧急功能开发
2. 中优先级：更新项目文档
3. 低优先级：整理工作笔记

💡 今日小贴士：
保持专注，定期休息，记录工作进展。祝您今天工作顺利！
    `.trim();
  }

  private generateMockSummary(): string {
    return `
📊 工作总结

✅ 已完成任务：
• 核心功能开发进度达到90%
• 完成了3个重要模块的测试
• 解决了2个关键bug
• 更新了相关文档

🎯 工作亮点：
• 代码质量显著提升
• 团队协作效率良好
• 按时完成了里程碑目标

📈 数据指标：
• 代码提交：15次
• 测试覆盖率：85%
• Bug修复：3个
• 文档更新：5篇

💡 经验收获：
通过本次工作，进一步提升了技术能力和项目管理经验。
    `.trim();
  }
}

export default MockAIService;