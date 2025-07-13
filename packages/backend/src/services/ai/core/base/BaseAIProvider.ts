import { IAIProvider, AIGenerationOptions, FunctionCallResponse } from '../interfaces/IAIProvider';
import { ContextEntry } from '../../../../models/index';
import EmailContentManager from '../../../email/emailContentManager';
import logger from '../../../../utils/logger';

export abstract class BaseAIProvider implements IAIProvider {
  protected contentManager: EmailContentManager;
  protected _isInitialized: boolean = false;

  constructor() {
    this.contentManager = new EmailContentManager();
  }

  abstract readonly name: string;

  get isInitialized(): boolean {
    return this._isInitialized;
  }

  abstract initialize(): Promise<void>;

  abstract generateResponse(
    systemMessage: string,
    userMessage: string,
    options: AIGenerationOptions
  ): Promise<string>;

  abstract generateResponseWithFunctions(
    systemMessage: string,
    userMessage: string,
    options: AIGenerationOptions,
    availableFunctions: Array<{
      name: string;
      description: string;
      parameters: Record<string, unknown>;
    }>
  ): Promise<FunctionCallResponse>;

  async generateMorningSuggestions(
    todaySchedule: string,
    yesterdayPerformance: string,
    context: ContextEntry[]
  ): Promise<string> {
    try {
      const contextText = this.formatContext(context);
      
      const prompt = `
您是一位个人效率助手。根据以下信息，为今天提供3-5条可行的建议。

今日日程：
${todaySchedule}

昨日表现：
${yesterdayPerformance}

历史背景：
${contextText}

请提供具体、可行的建议，帮助提高工作效率并解决昨日遇到的挑战。保持鼓励和专业的语调。
      `.trim();

      const response = await this.generateResponse(
        '您是一位乐于助人的效率助手，提供可行的日常建议。',
        prompt,
        { maxTokens: 500, temperature: 0.7 }
      );

      logger.info(`${this.name}: Morning suggestions generated successfully`);
      return response;
    } catch (error) {
      logger.error(`${this.name}: Failed to generate morning suggestions:`, error);
      throw error;
    }
  }

  async summarizeWorkReport(workReport: string, context: ContextEntry[]): Promise<string> {
    try {
      const contextText = this.formatContext(context);
      
      const prompt = `
您是一位专业的工作总结助手。根据以下工作报告，创建一个结构良好的总结。

工作报告：
${workReport}

历史背景：
${contextText}

请创建一个包含以下内容的总结：
1. 主要成就
2. 面临的挑战及其解决方式
3. 时间管理洞察
4. 目标进展情况
5. 明日建议

保持总结专业、简洁、具有可操作性。
      `.trim();

      const response = await this.generateResponse(
        '您是一位专业的工作总结助手，能够创建结构化、富有洞察力的总结。',
        prompt,
        { maxTokens: 600, temperature: 0.5 }
      );

      logger.info(`${this.name}: Work summary generated successfully`);
      return response;
    } catch (error) {
      logger.error(`${this.name}: Failed to generate work summary:`, error);
      throw error;
    }
  }

  async compressContext(context: ContextEntry[]): Promise<string> {
    try {
      const contextText = this.formatContext(context);
      
      const prompt = `
您是一位上下文压缩助手。请将以下历史上下文压缩为简洁的摘要，保留最重要的信息以供将来参考。

重点关注：
1. 工作习惯中的关键模式
2. 反复出现的挑战和解决方案
3. 重要成就和里程碑
4. 效率洞察
5. 目标进展

历史上下文：
${contextText}

请提供一个压缩摘要，既要捕获关键信息，又要将总体长度减少至少50%。
      `.trim();

      const response = await this.generateResponse(
        '您是一位上下文压缩专家，能够在减少长度的同时保留重要信息。',
        prompt,
        { maxTokens: 800, temperature: 0.3 }
      );

      logger.info(`${this.name}: Context compressed successfully`);
      return response;
    } catch (error) {
      logger.error(`${this.name}: Failed to compress context:`, error);
      throw error;
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const testResponse = await this.generateResponse(
        '你是一个测试助手。',
        '请回复"健康"',
        { maxTokens: 10, temperature: 0 }
      );
      return testResponse.length > 0;
    } catch (error) {
      logger.error(`${this.name}: Health check failed:`, error);
      return false;
    }
  }

  protected formatContext(context: ContextEntry[]): string {
    return this.contentManager.optimizeContextForEmail(context);
  }
}