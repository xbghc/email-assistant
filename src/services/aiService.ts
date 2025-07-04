import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Anthropic from '@anthropic-ai/sdk';
import axios from 'axios';
import config from '../config';
import logger from '../utils/logger';
import { ContextEntry } from '../models';
import { functionTools, deepseekFunctionTools } from '../utils/functionTools';
import FunctionCallService, { FunctionCallResult } from './functionCallService';
import UserService from './userService';
import EmailContentManager from './emailContentManager';
// Commented out unused imports to fix linting
// import { UserFunctionCallService, AdminFunctionCallService } from './userFunctionCallService';
// import { createUserSpecificFunctionTools, createUserSpecificDeepSeekFunctionTools, createAdminFunctionTools } from '../utils/userFunctionFactory';

class AIService {
  private openai?: OpenAI;
  private googleAI?: GoogleGenerativeAI;
  private anthropic?: Anthropic;
  private userService: UserService;
  private contentManager: EmailContentManager;

  constructor(userService?: UserService) {
    this.userService = userService || new UserService();
    this.contentManager = new EmailContentManager();
    this.initializeProviders();
  }

  private initializeProviders(): void {
    const provider = config.ai.provider;
    
    switch (provider) {
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
    }
  }

  async generateMorningSuggestions(
    todaySchedule: string,
    yesterdayPerformance: string,
    context: ContextEntry[]
  ): Promise<string> {
    try {
      const contextText = this.formatContext(context);
      
      const prompt = `
你是一个贴心的个人效率助手。请根据以下信息，为今天提供3-5个具体可行的建议。

今日日程：
${todaySchedule}

昨日表现：
${yesterdayPerformance}

历史记录：
${contextText}

请提供具体、可操作的建议，帮助提高效率并解决昨天遇到的任何挑战。保持鼓励和专业的语调。请用中文回复。
      `.trim();

      const response = await this.generateResponse(
        '你是一个贴心的效率助手，为用户提供具体可行的日常建议。请始终用中文回复。',
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
      const contextText = this.formatContext(context);
      
      const prompt = `
你是一个专业的工作总结助手。请根据以下工作报告，创建一个结构清晰的总结。

工作报告：
${workReport}

历史记录：
${contextText}

请创建一个包含以下内容的总结：
1. 主要成就
2. 遇到的挑战及解决方法
3. 时间管理洞察
4. 目标进展情况
5. 明日建议

保持总结专业、简洁且具有可操作性。请用中文回复。
      `.trim();

      const response = await this.generateResponse(
        '你是一个专业的工作总结助手，创建结构化、有洞察力的总结。请始终用中文回复。',
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
      const contextText = this.formatContext(context);
      
      const prompt = `
你是一个上下文压缩助手。请将以下历史记录压缩成简洁的摘要，保留最重要的信息以供将来参考。

重点关注：
1. 工作习惯的关键模式
2. 反复出现的挑战和解决方案
3. 重要成就和里程碑
4. 效率洞察
5. 目标进展

历史记录：
${contextText}

请提供一个压缩摘要，保留关键信息的同时将整体长度减少至少50%。请用中文回复。
      `.trim();

      const response = await this.generateResponse(
        '你是一个上下文压缩专家，在保留重要信息的同时减少长度。请始终用中文回复。',
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

  private async generateResponse(
    systemMessage: string,
    userMessage: string,
    options: { maxTokens: number; temperature: number }
  ): Promise<string> {
    const provider = config.ai.provider;

    switch (provider) {
      case 'openai':
        return this.generateOpenAIResponse(systemMessage, userMessage, options);
      case 'deepseek':
        return this.generateDeepSeekResponse(systemMessage, userMessage, options);
      case 'google':
        return this.generateGoogleResponse(systemMessage, userMessage, options);
      case 'anthropic':
        return this.generateAnthropicResponse(systemMessage, userMessage, options);
      case 'azure-openai':
        return this.generateAzureOpenAIResponse(systemMessage, userMessage, options);
      default:
        throw new Error(`Unsupported AI provider: ${provider}`);
    }
  }

  async generateResponseWithFunctionCalls(
    systemMessage: string,
    userMessage: string,
    options: { maxTokens: number; temperature: number },
    _userId?: string
  ): Promise<string> {
    const provider = config.ai.provider;
    const functionCallService = new FunctionCallService();

    try {
      switch (provider) {
        case 'openai':
          return await this.generateOpenAIResponseWithFunctions(systemMessage, userMessage, options, functionCallService);
        case 'deepseek':
          return await this.generateDeepSeekResponseWithFunctions(systemMessage, userMessage, options, functionCallService);
        default:
          // 其他提供商暂不支持Function Call，回退到普通响应
          return await this.generateResponse(systemMessage, userMessage, options);
      }
    } catch (error) {
      if (error instanceof Error) {
        logger.error(`Function call failed (${provider}): ${error.message}`);
        if (error.message.includes('422')) {
          logger.error('422 error suggests invalid function call parameters');
        }
      } else {
        logger.error('Function call generation failed, falling back to normal response:', error);
      }
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
    functionCallService: FunctionCallService
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
      // 暂时禁用Function Call以解决422错误
      // tools: functionTools,
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
          
          let result: FunctionCallResult;
          switch (functionName) {
            case 'update_schedule_times':
              result = await functionCallService.updateScheduleTimes(functionArgs);
              break;
            case 'mark_emails_as_read':
              result = await functionCallService.markEmailsAsRead(functionArgs);
              break;
            case 'get_current_config':
              result = await functionCallService.getCurrentConfig();
              break;
            default:
              result = { success: false, message: `未知的函数：${functionName}` };
          }
          
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
    functionCallService: FunctionCallService
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
        // 暂时禁用DeepSeek Function Call以解决422错误
        // tools: deepseekFunctionTools,
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
          
          let result: FunctionCallResult;
          switch (functionName) {
            case 'update_schedule_times':
              result = await functionCallService.updateScheduleTimes(functionArgs);
              break;
            case 'mark_emails_as_read':
              result = await functionCallService.markEmailsAsRead(functionArgs);
              break;
            case 'get_current_config':
              result = await functionCallService.getCurrentConfig();
              break;
            default:
              result = { success: false, message: `未知的函数：${functionName}` };
          }
          
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
    _options: { maxTokens: number; temperature: number }
  ): Promise<string> {
    if (!this.googleAI) {
      throw new Error('Google AI client not initialized');
    }

    const model = this.googleAI.getGenerativeModel({ model: config.ai.google.model });
    const prompt = `${systemMessage}\n\n${userMessage}`;
    
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
        { role: 'user', content: userMessage },
      ],
    });

    return response.content[0]?.type === 'text' ? response.content[0].text : '';
  }

  private async generateAzureOpenAIResponse(
    systemMessage: string,
    userMessage: string,
    options: { maxTokens: number; temperature: number }
  ): Promise<string> {
    const response = await axios.post(
      `${config.ai.azureOpenai.endpoint}/openai/deployments/${config.ai.azureOpenai.deploymentName}/chat/completions?api-version=${config.ai.azureOpenai.apiVersion}`,
      {
        messages: [
          { role: 'system', content: systemMessage },
          { role: 'user', content: userMessage },
        ],
        max_tokens: options.maxTokens,
        temperature: options.temperature,
      },
      {
        headers: {
          'api-key': config.ai.azureOpenai.apiKey,
          'Content-Type': 'application/json',
        },
      }
    );

    return response.data.choices[0]?.message?.content || '';
  }

  private formatContext(context: ContextEntry[]): string {
    // 使用内容管理器优化上下文显示
    return this.contentManager.optimizeContextForEmail(context);
  }
}

export default AIService;