import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Anthropic from '@anthropic-ai/sdk';
import axios from 'axios';
import config from '../config';
import logger from '../utils/logger';
import { ContextEntry } from '../models';
import SimpleFunctionCallService, { SimpleFunctionResult } from './simpleFunctionCallService';
import UserService from './userService';
import MockAIService from './mockAIService';
import EmailContentManager from './emailContentManager';
import { withTimeout, retryNetworkOperation } from '../utils/asyncUtils';

class AIService {
  private openai?: OpenAI;
  private googleAI?: GoogleGenerativeAI;
  private anthropic?: Anthropic;
  private mockAI?: MockAIService;
  private userService: UserService;
  private contentManager: EmailContentManager;
  
  // 超时配置
  private readonly DEFAULT_TIMEOUT = 30000; // 30秒
  private readonly FUNCTION_CALL_TIMEOUT = 60000; // 函数调用1分钟

  constructor(userService?: UserService) {
    this.userService = userService || new UserService();
    this.contentManager = new EmailContentManager();
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

      // 添加超时和重试机制
      return await retryNetworkOperation(() => 
        withTimeout(operation(), this.DEFAULT_TIMEOUT, `AI ${provider} request timed out`)
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
You are a personal productivity assistant. Based on the following information, provide 3-5 actionable suggestions for today.

Today's Schedule:
${todaySchedule}

Yesterday's Performance:
${yesterdayPerformance}

Historical Context:
${contextText}

Please provide specific, actionable suggestions that will help improve productivity and address any challenges from yesterday. Keep the tone encouraging and professional.
      `.trim();

      const response = await this.generateResponse(
        'You are a helpful productivity assistant that provides actionable daily suggestions.',
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
You are a professional work summary assistant. Based on the following work report, create a well-structured summary.

Work Report:
${workReport}

Historical Context:
${contextText}

Please create a summary that includes:
1. Key accomplishments
2. Challenges faced and how they were addressed
3. Time management insights
4. Progress towards goals
5. Recommendations for tomorrow

Keep the summary professional, concise, and actionable.
      `.trim();

      const response = await this.generateResponse(
        'You are a professional work summary assistant that creates structured, insightful summaries.',
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
You are a context compression assistant. Please compress the following historical context into a concise summary that preserves the most important information for future reference.

Focus on:
1. Key patterns in work habits
2. Recurring challenges and solutions
3. Important achievements and milestones
4. Productivity insights
5. Goal progress

Historical Context:
${contextText}

Please provide a compressed summary that captures the essential information while reducing the overall length by at least 50%.
      `.trim();

      const response = await this.generateResponse(
        'You are a context compression specialist that preserves important information while reducing length.',
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
      } else {
        logger.error('Function call generation failed, falling back to normal response:', error);
      }
      // 降级处理：如果函数调用失败，回退到普通响应
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
      model: config.ai.openai.model,
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
      model: config.ai.openai.model,
      messages: [
        { role: 'system', content: systemMessage },
        { role: 'user', content: userMessage },
      ],
      max_tokens: options.maxTokens,
      temperature: options.temperature,
      // 暂时禁用Function Call直到修复422错误  
      // tools: simpleFunctionTools,
      // tool_choice: 'auto',
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
        // 暂时禁用Function Call直到修复422错误
        // tools: simpleDeepSeekTools,
        // tool_choice: 'auto',
      },
      {
        headers: {
          'Authorization': `Bearer ${config.ai.deepseek.apiKey}`,
          'Content-Type': 'application/json',
        },
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
      model: config.ai.google.model,
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
      model: config.ai.anthropic.model,
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