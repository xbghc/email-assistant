import { IAIProvider, AIGenerationOptions } from '../core/interfaces/IAIProvider';
import { FunctionResult } from '../core/interfaces/IFunctionHandler';
import { ProviderFactory, SupportedProvider } from '../providers/ProviderFactory';
import { FunctionRegistry } from '../functions/registry/FunctionRegistry';
import { ContextEntry } from '../../../models/index';
import { withTimeout, retryNetworkOperation, PromiseQueue } from '../../../utils/asyncUtils';
import UserService from '../../user/userService';
import logger from '../../../utils/logger';

export class AIOrchestrator {
  private provider?: IAIProvider;
  private functionRegistry: FunctionRegistry;
  private requestQueue: PromiseQueue;
  
  // 超时配置
  private readonly DEFAULT_TIMEOUT = 60000; // 60秒
  private readonly FUNCTION_CALL_TIMEOUT = 90000; // 函数调用90秒
  private readonly DEEPSEEK_TIMEOUT = 45000; // DeepSeek 专用超时45秒

  constructor(userService?: UserService) {
    this.functionRegistry = new FunctionRegistry(userService);
    this.requestQueue = new PromiseQueue(2); // 限制并发请求数为2
  }

  async initialize(providerName?: SupportedProvider): Promise<void> {
    try {
      this.provider = await ProviderFactory.getProvider(providerName);
      await this.functionRegistry.initialize();
      logger.info('AI Orchestrator initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize AI Orchestrator:', error);
      throw error;
    }
  }

  async generateResponse(
    systemMessage: string,
    userMessage: string,
    options: AIGenerationOptions
  ): Promise<string> {
    if (!this.provider) {
      throw new Error('AI Orchestrator not initialized');
    }

    // 检查内存使用情况
    this.checkMemoryUsage();

    try {
      const operation = async () => {
        if (!this.provider) {
          throw new Error('AI provider not available');
        }
        return await this.provider.generateResponse(systemMessage, userMessage, options);
      };

      // 添加超时和重试机制
      const timeout = this.provider.name === 'deepseek' ? this.DEEPSEEK_TIMEOUT : this.DEFAULT_TIMEOUT;
      
      // 使用请求队列限制并发
      return await this.requestQueue.add(() => 
        retryNetworkOperation(() => 
          withTimeout(operation(), timeout, `AI ${this.provider!.name} request timed out`)
        )
      );
    } catch (error) {
      logger.error(`AI response generation failed with ${this.provider.name}:`, error);
      throw error;
    }
  }

  async generateResponseWithFunctionCalls(
    systemMessage: string,
    userMessage: string,
    options: AIGenerationOptions,
    userId?: string
  ): Promise<string> {
    if (!this.provider) {
      throw new Error('AI Orchestrator not initialized');
    }

    try {
      const operation = async () => {
        // 获取可用的功能定义
        const availableFunctions = this.functionRegistry.getFunctionDefinitions().map(def => ({
          name: def.name,
          description: def.description,
          parameters: def.parameters,
        }));

        // 调用AI生成响应
        const response = await this.provider!.generateResponseWithFunctions(
          systemMessage,
          userMessage,
          options,
          availableFunctions
        );

        // 处理函数调用
        if (response.functionCalls && response.functionCalls.length > 0) {
          const functionResults: string[] = [];
          
          for (const functionCall of response.functionCalls) {
            const result: FunctionResult = await this.functionRegistry.handleFunctionCall(
              functionCall.name,
              functionCall.arguments,
              userId
            );
            
            functionResults.push(result.message);
          }
          
          return functionResults.join('\n\n');
        }

        // 返回文本响应
        return response.content || '';
      };

      // 使用更长的超时时间处理函数调用
      return await retryNetworkOperation(() => 
        withTimeout(operation(), this.FUNCTION_CALL_TIMEOUT, `AI ${this.provider?.name || 'unknown'} function call timed out`)
      );
    } catch (error) {
      if (error instanceof Error) {
        logger.error(`Function call failed (${this.provider?.name || 'unknown'}): ${error.message}`);
        if (error.message.includes('422')) {
          logger.error('422 error suggests invalid function call parameters');
        }
        if (error.message.includes('400')) {
          logger.error('400 error suggests malformed request');
        }
      } else {
        logger.error('Function call generation failed, falling back to normal response:', error);
      }
      
      // 降级处理：如果函数调用失败，回退到普通响应
      logger.info('Falling back to normal response due to function call failure');
      return await this.generateResponse(systemMessage, userMessage, options);
    }
  }

  async generateMorningSuggestions(
    todaySchedule: string,
    yesterdayPerformance: string,
    context: ContextEntry[]
  ): Promise<string> {
    if (!this.provider) {
      throw new Error('AI Orchestrator not initialized');
    }

    try {
      const response = await this.provider.generateMorningSuggestions(
        todaySchedule,
        yesterdayPerformance,
        context
      );
      
      logger.info('Morning suggestions generated successfully');
      return response;
    } catch (error) {
      logger.error('Failed to generate morning suggestions:', error);
      throw error;
    }
  }

  async summarizeWorkReport(workReport: string, context: ContextEntry[]): Promise<string> {
    if (!this.provider) {
      throw new Error('AI Orchestrator not initialized');
    }

    try {
      const response = await this.provider.summarizeWorkReport(workReport, context);
      
      logger.info('Work summary generated successfully');
      return response;
    } catch (error) {
      logger.error('Failed to generate work summary:', error);
      throw error;
    }
  }

  async compressContext(context: ContextEntry[]): Promise<string> {
    if (!this.provider) {
      throw new Error('AI Orchestrator not initialized');
    }

    try {
      const response = await this.provider.compressContext(context);
      
      logger.info('Context compressed successfully');
      return response;
    } catch (error) {
      logger.error('Failed to compress context:', error);
      throw error;
    }
  }

  async healthCheck(): Promise<boolean> {
    if (!this.provider) {
      return false;
    }

    return await this.provider.healthCheck();
  }

  getProviderName(): string {
    return this.provider?.name || 'not-initialized';
  }

  isInitialized(): boolean {
    return this.provider?.isInitialized || false;
  }

  getAvailableFunctions(): string[] {
    return this.functionRegistry.getRegisteredFunctions();
  }

  private checkMemoryUsage(): void {
    const memUsage = process.memoryUsage();
    const heapUsedPercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
    
    if (heapUsedPercent > 85) {
      logger.warn(`High memory usage detected: ${heapUsedPercent.toFixed(1)}%. Consider using simpler responses.`);
      
      // 强制垃圾回收（如果可用）
      if (global.gc) {
        global.gc();
        logger.info('Forced garbage collection completed');
      }
      
      // 在极高内存使用时抛出错误
      if (heapUsedPercent > 90) {
        throw new Error('系统当前负载较高，请稍后重试。如需帮助，请直接联系管理员。');
      }
    }
  }
}