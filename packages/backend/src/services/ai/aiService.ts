import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Anthropic from '@anthropic-ai/sdk';
import axios from 'axios';
import config from '../../config/index';
import logger from '../../utils/logger';
import { ContextEntry } from '../../models/index';
import SimpleFunctionCallService, { SimpleFunctionResult } from './functionCall/simpleFunctionCallService';
import UserService from '../user/userService';
import MockAIService from './mockAIService';
import EmailContentManager from '../email/emailContentManager';
import { withTimeout, retryNetworkOperation, PromiseQueue } from '../../utils/asyncUtils';
import { simpleFunctionTools, simpleDeepSeekTools } from '../../utils/simpleFunctionTools';

class AIService {
  private openai?: OpenAI;
  private googleAI?: GoogleGenerativeAI;
  private anthropic?: Anthropic;
  private mockAI?: MockAIService;
  private userService: UserService;
  private contentManager: EmailContentManager;
  private requestQueue: PromiseQueue;
  
  // 超时配置
  private readonly DEFAULT_TIMEOUT = 60000; // 60秒 - 增加超时时间
  private readonly FUNCTION_CALL_TIMEOUT = 90000; // 函数调用90秒
  private readonly DEEPSEEK_TIMEOUT = 45000; // DeepSeek 专用超时45秒

  constructor(userService?: UserService) {
    this.userService = userService || new UserService();
    this.contentManager = new EmailContentManager();
    this.requestQueue = new PromiseQueue(2); // 限制并发请求数为2
    this.initializeProviders();
  }

  private initializeProviders(): void {
    try {
      switch (config.ai.provider) {
        case 'openai':
          if (config.ai.openai.apiKey) {
            this.openai = new OpenAI({
              apiKey: config.ai.openai.apiKey,
              baseURL: config.ai.openai.baseURL,
            });
          }
          break;
        case 'google':
          if (config.ai.google.apiKey) {
            this.googleAI = new GoogleGenerativeAI(config.ai.google.apiKey);
          }
          break;
        case 'anthropic':
          if (config.ai.anthropic.apiKey) {
            this.anthropic = new Anthropic({
              apiKey: config.ai.anthropic.apiKey,
            });
          }
          break;
        case 'mock':
          this.mockAI = new MockAIService();
          logger.info('Mock AI service initialized for testing');
          break;
        case 'azure-openai':
          if (config.ai.azureOpenai.apiKey) {
            this.openai = new OpenAI({
              apiKey: config.ai.azureOpenai.apiKey,
              baseURL: `${config.ai.azureOpenai.endpoint}/openai/deployments/${config.ai.azureOpenai.deploymentName}`,
              defaultQuery: { 'api-version': config.ai.azureOpenai.apiVersion },
              defaultHeaders: {
                'api-key': config.ai.azureOpenai.apiKey,
              },
            });
          }
          break;
        case 'deepseek':
          // DeepSeek 使用 axios 调用
          break;
        default:
          logger.warn(`Unsupported AI provider: ${config.ai.provider}`);
      }
    } catch (error) {
      logger.error('Failed to initialize AI providers:', error);
    }
  }

  async generateResponse(
    systemMessage: string,
    userMessage: string,
    options: { maxTokens: number; temperature: number }
  ): Promise<string> {
    const provider = config.ai.provider;

    // 检查内存使用情况 - 使用更合理的指标
    const memUsage = process.memoryUsage();
    const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
    const rssMB = memUsage.rss / 1024 / 1024;
    
    // 当堆内存使用超过1GB或RSS超过2GB时记录警告
    if (heapUsedMB > 1024) {
      logger.warn(`High heap memory usage: ${heapUsedMB.toFixed(1)}MB`);
    }
    
    if (rssMB > 2048) {
      logger.warn(`High RSS memory usage: ${rssMB.toFixed(1)}MB`);
    }
    
    // 当内存使用确实过高时抛出错误而不是返回错误消息
    if (heapUsedMB > 1536) { // 1.5GB
      logger.error(`Critical memory usage: ${heapUsedMB.toFixed(1)}MB - throwing error`);
      throw new Error('System overloaded - critical memory usage detected');
    }

    try {
      const operation = async () => {
        switch (provider) {
          case 'mock':
            if (!this.mockAI) {
              throw new Error('Mock AI service not initialized');
            }
            return await this.mockAI.generateResponse(systemMessage, userMessage, options);
          case 'openai':
          case 'azure-openai':
            return await this.generateOpenAIResponse(systemMessage, userMessage, options);
          case 'deepseek':
            return await this.generateDeepSeekResponse(systemMessage, userMessage, options);
          case 'google':
            return await this.generateGoogleResponse(systemMessage, userMessage, options);
          case 'anthropic':
            return await this.generateAnthropicResponse(systemMessage, userMessage, options);
          default:
            throw new Error(`Unsupported AI provider: ${provider}`);
        }
      };

      // 添加超时和重试机制 - DeepSeek使用专门超时
      const timeout = provider === 'deepseek' ? this.DEEPSEEK_TIMEOUT : this.DEFAULT_TIMEOUT;
      
      // 使用请求队列限制并发
      return await this.requestQueue.add(() => 
        retryNetworkOperation(() => 
          withTimeout(operation(), timeout, `AI ${provider} request timed out`)
        )
      );
    } catch (error) {
      logger.error(`AI response generation failed with ${provider}:`, error);
      throw error;
    }
  }

  async generateMorningSuggestions(
    todaySchedule: string,
    yesterdayPerformance: string,
    context: ContextEntry[]
  ): Promise<string> {
    try {
      if (config.ai.provider === 'mock' && this.mockAI) {
        return await this.mockAI.generateMorningSuggestions(todaySchedule, yesterdayPerformance, context);
      }
      
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

      logger.info('Morning suggestions generated successfully');
      return response;
    } catch (error) {
      logger.error('Failed to generate morning suggestions:', error);
      throw error;
    }
  }

  async summarizeWorkReport(workReport: string, context: ContextEntry[]): Promise<string> {
    try {
      if (config.ai.provider === 'mock' && this.mockAI) {
        return await this.mockAI.summarizeWorkReport(workReport, context);
      }
      
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

      logger.info('Work summary generated successfully');
      return response;
    } catch (error) {
      logger.error('Failed to generate work summary:', error);
      throw error;
    }
  }

  async compressContext(context: ContextEntry[]): Promise<string> {
    try {
      if (config.ai.provider === 'mock' && this.mockAI) {
        return await this.mockAI.compressContext(context);
      }
      
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

      logger.info('Context compressed successfully');
      return response;
    } catch (error) {
      logger.error('Failed to compress context:', error);
      throw error;
    }
  }

  async generateResponseWithFunctionCalls(
    systemMessage: string,
    userMessage: string,
    options: { maxTokens: number; temperature: number },
    userId?: string
  ): Promise<string> {
    const provider = config.ai.provider;
    const functionCallService = new SimpleFunctionCallService();
    await functionCallService.initialize();

    try {
      const operation = async () => {
        switch (provider) {
          case 'mock':
            if (!this.mockAI) {
              throw new Error('Mock AI service not initialized');
            }
            return await this.mockAI.generateResponseWithFunctionCalls(systemMessage, userMessage, options, userId);
          case 'openai':
          case 'azure-openai':
            return await this.generateOpenAIResponseWithFunctions(systemMessage, userMessage, options, functionCallService, userId);
          case 'deepseek':
            return await this.generateDeepSeekResponseWithFunctions(systemMessage, userMessage, options, functionCallService, userId);
          default:
            // 其他提供商暂不支持Function Call，回退到普通响应
            return await this.generateResponse(systemMessage, userMessage, options);
        }
      };

      // 使用更长的超时时间处理函数调用
      return await retryNetworkOperation(() => 
        withTimeout(operation(), this.FUNCTION_CALL_TIMEOUT, `AI ${provider} function call timed out`)
      );
    } catch (error) {
      if (error instanceof Error) {
        logger.error(`Function call failed (${provider}): ${error.message}`);
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

  private async generateOpenAIResponse(
    systemMessage: string,
    userMessage: string,
    options: { maxTokens: number; temperature: number }
  ): Promise<string> {
    if (!this.openai) {
      throw new Error('OpenAI client not initialized');
    }

    const response = await this.openai.chat.completions.create({
      model: config.ai.openai?.model || 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: systemMessage },
        { role: 'user', content: userMessage },
      ],
      max_tokens: options.maxTokens,
      temperature: options.temperature,
    });

    return response.choices[0]?.message?.content || '';
  }

  private async generateOpenAIResponseWithFunctions(
    systemMessage: string,
    userMessage: string,
    options: { maxTokens: number; temperature: number },
    functionCallService: SimpleFunctionCallService,
    userId?: string
  ): Promise<string> {
    if (!this.openai) {
      throw new Error('OpenAI client not initialized');
    }

    const response = await this.openai.chat.completions.create({
      model: config.ai.openai?.model || 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: systemMessage },
        { role: 'user', content: userMessage },
      ],
      max_tokens: options.maxTokens,
      temperature: options.temperature,
      tools: simpleFunctionTools,
      tool_choice: 'auto',
    });

    const message = response.choices[0]?.message;
    if (!message) {
      throw new Error('No response from OpenAI');
    }

    // 如果有function call，处理它们
    if (message.tool_calls && message.tool_calls.length > 0) {
      const functionResults: string[] = [];
      
      for (const toolCall of message.tool_calls) {
        if (toolCall.type === 'function') {
          const functionName = toolCall.function.name;
          const functionArgs = JSON.parse(toolCall.function.arguments);
          
          const result: SimpleFunctionResult = await functionCallService.handleFunctionCall(
            functionName,
            functionArgs,
            userId
          );
          
          functionResults.push(result.message);
        }
      }
      
      return functionResults.join('\n\n');
    }

    return message.content || '';
  }

  private async generateDeepSeekResponse(
    systemMessage: string,
    userMessage: string,
    options: { maxTokens: number; temperature: number }
  ): Promise<string> {
    if (!config.ai.deepseek?.apiKey) {
      throw new Error('DeepSeek API key not configured');
    }
    
    const response = await axios.post(
      `${config.ai.deepseek.baseURL}/chat/completions`,
      {
        model: config.ai.deepseek.model,
        messages: [
          { role: 'system', content: systemMessage },
          { role: 'user', content: userMessage },
        ],
        max_tokens: options.maxTokens,
        temperature: options.temperature,
      },
      {
        headers: {
          'Authorization': `Bearer ${config.ai.deepseek.apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: this.DEEPSEEK_TIMEOUT, // 添加axios级别超时
      }
    );

    return response.data.choices[0]?.message?.content || '';
  }

  private async generateDeepSeekResponseWithFunctions(
    systemMessage: string,
    userMessage: string,
    options: { maxTokens: number; temperature: number },
    functionCallService: SimpleFunctionCallService,
    userId?: string
  ): Promise<string> {
    if (!config.ai.deepseek?.apiKey) {
      throw new Error('DeepSeek API key not configured');
    }
    
    const response = await axios.post(
      `${config.ai.deepseek.baseURL}/chat/completions`,
      {
        model: config.ai.deepseek.model,
        messages: [
          { role: 'system', content: systemMessage },
          { role: 'user', content: userMessage },
        ],
        max_tokens: options.maxTokens,
        temperature: options.temperature,
        tools: simpleDeepSeekTools,
        tool_choice: 'auto',
      },
      {
        headers: {
          'Authorization': `Bearer ${config.ai.deepseek.apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: this.DEEPSEEK_TIMEOUT, // 添加axios级别超时
      }
    );

    const message = response.data.choices[0]?.message;
    if (!message) {
      throw new Error('No response from DeepSeek');
    }

    // 如果有function call，处理它们
    if (message.tool_calls && message.tool_calls.length > 0) {
      const functionResults: string[] = [];
      
      for (const toolCall of message.tool_calls) {
        if (toolCall.type === 'function') {
          const functionName = toolCall.function.name;
          const functionArgs = JSON.parse(toolCall.function.arguments);
          
          const result: SimpleFunctionResult = await functionCallService.handleFunctionCall(
            functionName,
            functionArgs,
            userId
          );
          
          functionResults.push(result.message);
        }
      }
      
      return functionResults.join('\n\n');
    }

    return message.content || '';
  }

  private async generateGoogleResponse(
    systemMessage: string,
    userMessage: string,
    options: { maxTokens: number; temperature: number }
  ): Promise<string> {
    if (!this.googleAI) {
      throw new Error('Google AI not initialized');
    }

    const model = this.googleAI.getGenerativeModel({ 
      model: config.ai.google?.model || 'gemini-2.5-flash',
      generationConfig: {
        maxOutputTokens: options.maxTokens,
        temperature: options.temperature,
      },
    });

    const prompt = `${systemMessage}\n\nUser: ${userMessage}`;
    const result = await model.generateContent(prompt);
    const response = await result.response;
    
    return response.text();
  }

  private async generateAnthropicResponse(
    systemMessage: string,
    userMessage: string,
    options: { maxTokens: number; temperature: number }
  ): Promise<string> {
    if (!this.anthropic) {
      throw new Error('Anthropic client not initialized');
    }

    const response = await this.anthropic.messages.create({
      model: config.ai.anthropic?.model || 'claude-3-sonnet-20240229',
      max_tokens: options.maxTokens,
      temperature: options.temperature,
      system: systemMessage,
      messages: [
        { role: 'user', content: userMessage }
      ]
    });

    if (response.content[0] && response.content[0].type === 'text') {
      return response.content[0].text;
    }
    
    return '';
  }

  private formatContext(context: ContextEntry[]): string {
    // 使用内容管理器优化上下文显示
    return this.contentManager.optimizeContextForEmail(context);
  }
}

export default AIService;