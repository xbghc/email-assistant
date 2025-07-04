import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Anthropic from '@anthropic-ai/sdk';
import axios from 'axios';
import config from '../config';
import logger from '../utils/logger';
import { ContextEntry } from '../models';

class AIService {
  private openai?: OpenAI;
  private googleAI?: GoogleGenerativeAI;
  private anthropic?: Anthropic;

  constructor() {
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
    return context
      .slice(-10)
      .map(entry => `[${entry.timestamp.toISOString()}] ${entry.type}: ${entry.content}`)
      .join('\n\n');
  }
}

export default AIService;