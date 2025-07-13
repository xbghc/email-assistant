import { BaseAIProvider } from '../../core/base/BaseAIProvider';
import { AIGenerationOptions, FunctionCallResponse } from '../../core/interfaces/IAIProvider';
import { ContextEntry } from '../../../../models/index';
import logger from '../../../../utils/logger';

export class MockProvider extends BaseAIProvider {
  readonly name = 'mock';

  async initialize(): Promise<void> {
    this._isInitialized = true;
    logger.info('Mock provider initialized successfully');
  }

  async generateResponse(
    systemPrompt: string,
    userPrompt: string,
    _options?: AIGenerationOptions
  ): Promise<string> {
    logger.debug('Mock AI generating response for prompt:', userPrompt.substring(0, 100) + '...');
    
    // 根据提示内容返回相应的模拟响应
    if (userPrompt.includes('周报') || userPrompt.includes('weekly')) {
      return this.generateMockWeeklyReport();
    }
    
    if (userPrompt.includes('个性化') || userPrompt.includes('建议') || userPrompt.includes('工作模式')) {
      return this.generateMockPersonalizedSuggestions();
    }
    
    if (userPrompt.includes('morning') || userPrompt.includes('日程')) {
      return this.generateMockMorningReminder();
    }
    
    if (userPrompt.includes('summary') || userPrompt.includes('总结')) {
      return this.generateMockSummary();
    }
    
    return '这是一个模拟的AI响应。在测试模式下，所有AI请求都会返回预设的响应内容。';
  }

  async generateResponseWithFunctions(
    _systemMessage: string,
    userMessage: string,
    _options: AIGenerationOptions,
    _availableFunctions: Array<{
      name: string;
      description: string;
      parameters: Record<string, unknown>;
    }>
  ): Promise<FunctionCallResponse> {
    logger.debug('Mock AI generating response with functions');

    // 模拟智能函数调用判断
    if (userMessage.includes('修改时间') || userMessage.includes('更新提醒')) {
      return {
        functionCalls: [{
          name: 'update_reminder_times',
          arguments: {
            morningTime: '09:00',
            eveningTime: '18:00'
          }
        }]
      };
    }

    if (userMessage.includes('标记') && userMessage.includes('已读')) {
      return {
        functionCalls: [{
          name: 'mark_emails_read',
          arguments: {
            markAll: true
          }
        }]
      };
    }

    if (userMessage.includes('配置') || userMessage.includes('设置')) {
      return {
        functionCalls: [{
          name: 'get_user_config',
          arguments: {}
        }]
      };
    }

    // 默认返回文本响应
    return {
      content: await this.generateResponse('', userMessage, _options)
    };
  }

  async generateMorningSuggestions(_type: string, _content: string, _context: ContextEntry[]): Promise<string> {
    logger.debug('Mock AI generating morning suggestions');
    return this.generateMockMorningReminder();
  }

  async summarizeWorkReport(_workReport: string, _context: ContextEntry[]): Promise<string> {
    logger.debug('Mock AI generating work summary');
    return this.generateMockSummary();
  }

  async compressContext(_context: ContextEntry[]): Promise<string> {
    logger.debug('Mock AI compressing context');
    return `
## 压缩的上下文摘要

**工作模式分析**：
- 主要工作时间：上午9点-下午6点
- 高效时段：上午10-12点，下午2-4点
- 常见挑战：会议过多，深度工作时间不足

**关键成就**：
- 完成了3个重要项目里程碑
- 团队协作效率提升20%
- 建立了新的工作流程

**改进建议**：
- 继续保持早晨规划习惯
- 增加深度工作时间块
- 定期回顾和调整工作方法

*（此摘要由Mock AI服务生成，已压缩75%的原始内容）*
    `.trim();
  }

  private generateMockWeeklyReport(): string {
    return `
## 本周工作总结

### 📈 主要成就
- 完成了项目A的关键功能开发
- 参与了3次重要的团队会议
- 解决了2个技术难题

### 🎯 目标完成情况
- ✅ 功能开发进度：90%
- ✅ 代码质量评审：已完成
- ⏳ 文档整理：进行中

### 💡 经验总结
本周在时间管理和技术攻关方面都有不错的表现，建议继续保持这种节奏。

*（模拟AI生成的周报内容）*
    `.trim();
  }

  private generateMockPersonalizedSuggestions(): string {
    return `
## 个性化工作建议

### 🚀 效率优化
- 建议在上午10-12点安排最重要的工作
- 使用番茄钟技术保持专注
- 每2小时休息15分钟

### 📅 日程安排
- 预留缓冲时间处理突发事务
- 批量处理类似任务
- 避免在疲劳时段安排重要会议

### 🎯 目标管理
- 设定每日最多3个核心目标
- 定期回顾和调整优先级
- 庆祝小的成就和进步

*（基于您的工作模式生成的个性化建议）*
    `.trim();
  }

  private generateMockMorningReminder(): string {
    return `
## 今日工作指引

### 🎯 今日重点任务
- 优先处理紧急且重要的工作事项
- 安排30分钟用于团队沟通
- 预留时间处理突发事务

### 💡 效率提升建议
- 使用番茄钟工作法提高专注度
- 定期休息，保持良好的工作状态
- 及时记录工作进展和想法

### ⚡ 能量管理
- 在高效时段处理复杂任务
- 适当安排轻松的工作调节节奏
- 保持积极的工作心态

祝您今天工作顺利！💪

*（模拟AI生成的晨间提醒）*
    `.trim();
  }

  private generateMockSummary(): string {
    return `
## 工作总结

### ✅ 今日完成
- 处理了15封重要邮件
- 完成了2个关键任务
- 参与了1次团队会议

### 📊 效率分析
- 专注时间：4小时30分钟
- 沟通时间：1小时45分钟
- 学习时间：30分钟

### 🎯 明日重点
- 继续推进项目B的开发
- 准备下周的团队汇报
- 完成待处理的代码评审

### 💭 反思与改进
今天的工作节奏比较理想，建议明天继续保持这种高效的工作模式。

*（模拟AI生成的工作总结）*
    `.trim();
  }
}