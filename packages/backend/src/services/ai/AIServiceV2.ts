import { AIOrchestrator } from './services/AIOrchestrator';
import { ContextEntry } from '../../models/index';
import UserService from '../user/userService';
import logger from '../../utils/logger';

export interface AIGenerationOptions {
  maxTokens: number;
  temperature: number;
}

/**
 * 新版AI服务 - 使用分层架构
 * 
 * 这是对原AIService的重构版本，采用了更清晰的分层架构：
 * - 核心抽象层：定义接口和基础类
 * - 提供商实现层：各AI提供商的具体实现
 * - 功能调用层：处理AI功能调用
 * - 服务编排层：协调各个组件
 */
class AIServiceV2 {
  private orchestrator: AIOrchestrator;

  constructor(userService?: UserService) {
    this.orchestrator = new AIOrchestrator(userService);
  }

  async initialize(): Promise<void> {
    try {
      await this.orchestrator.initialize();
      logger.info('AIServiceV2 initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize AIServiceV2:', error);
      throw error;
    }
  }

  async generateResponse(
    systemMessage: string,
    userMessage: string,
    options: AIGenerationOptions
  ): Promise<string> {
    return await this.orchestrator.generateResponse(systemMessage, userMessage, options);
  }

  async generateResponseWithFunctionCalls(
    systemMessage: string,
    userMessage: string,
    options: AIGenerationOptions,
    userId?: string
  ): Promise<string> {
    return await this.orchestrator.generateResponseWithFunctionCalls(
      systemMessage,
      userMessage,
      options,
      userId
    );
  }

  async generateMorningSuggestions(
    todaySchedule: string,
    yesterdayPerformance: string,
    context: ContextEntry[]
  ): Promise<string> {
    return await this.orchestrator.generateMorningSuggestions(
      todaySchedule,
      yesterdayPerformance,
      context
    );
  }

  async summarizeWorkReport(workReport: string, context: ContextEntry[]): Promise<string> {
    return await this.orchestrator.summarizeWorkReport(workReport, context);
  }

  async compressContext(context: ContextEntry[]): Promise<string> {
    return await this.orchestrator.compressContext(context);
  }

  async healthCheck(): Promise<boolean> {
    return await this.orchestrator.healthCheck();
  }

  getProviderName(): string {
    return this.orchestrator.getProviderName();
  }

  isInitialized(): boolean {
    return this.orchestrator.isInitialized();
  }

  getAvailableFunctions(): string[] {
    return this.orchestrator.getAvailableFunctions();
  }
}

export default AIServiceV2;