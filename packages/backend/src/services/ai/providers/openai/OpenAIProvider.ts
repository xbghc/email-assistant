import OpenAI from 'openai';
import { BaseAIProvider } from '../../core/base/BaseAIProvider';
import { AIGenerationOptions, FunctionCallResponse } from '../../core/interfaces/IAIProvider';
import config from '../../../../config/index';
import logger from '../../../../utils/logger';

export class OpenAIProvider extends BaseAIProvider {
  readonly name = 'openai';
  private client?: OpenAI;

  async initialize(): Promise<void> {
    try {
      if (!config.ai.openai.apiKey) {
        throw new Error('OpenAI API key not configured');
      }

      this.client = new OpenAI({
        apiKey: config.ai.openai.apiKey,
        baseURL: config.ai.openai.baseURL,
      });

      this._isInitialized = true;
      logger.info('OpenAI provider initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize OpenAI provider:', error);
      throw error;
    }
  }

  async generateResponse(
    systemMessage: string,
    userMessage: string,
    options: AIGenerationOptions
  ): Promise<string> {
    if (!this.client) {
      throw new Error('OpenAI client not initialized');
    }

    try {
      const response = await this.client.chat.completions.create({
        model: config.ai.openai.model,
        messages: [
          { role: 'system', content: systemMessage },
          { role: 'user', content: userMessage },
        ],
        max_tokens: options.maxTokens,
        temperature: options.temperature,
      });

      return response.choices[0]?.message?.content || '';
    } catch (error) {
      logger.error('OpenAI response generation failed:', error);
      throw error;
    }
  }

  async generateResponseWithFunctions(
    systemMessage: string,
    userMessage: string,
    options: AIGenerationOptions,
    availableFunctions: Array<{
      name: string;
      description: string;
      parameters: Record<string, unknown>;
    }>
  ): Promise<FunctionCallResponse> {
    if (!this.client) {
      throw new Error('OpenAI client not initialized');
    }

    try {
      const tools = availableFunctions.map(func => ({
        type: 'function' as const,
        function: {
          name: func.name,
          description: func.description,
          parameters: func.parameters,
        },
      }));

      const response = await this.client.chat.completions.create({
        model: config.ai.openai.model,
        messages: [
          { role: 'system', content: systemMessage },
          { role: 'user', content: userMessage },
        ],
        max_tokens: options.maxTokens,
        temperature: options.temperature,
        tools,
        tool_choice: 'auto',
      });

      const message = response.choices[0]?.message;
      if (!message) {
        throw new Error('No response from OpenAI');
      }

      const result: FunctionCallResponse = {};

      // 如果有function call，返回function calls
      if (message.tool_calls && message.tool_calls.length > 0) {
        result.functionCalls = message.tool_calls
          .filter(toolCall => toolCall.type === 'function')
          .map(toolCall => ({
            name: toolCall.function.name,
            arguments: JSON.parse(toolCall.function.arguments),
          }));
      }

      // 如果有文本内容，返回内容
      if (message.content) {
        result.content = message.content;
      }

      return result;
    } catch (error) {
      logger.error('OpenAI function call failed:', error);
      throw error;
    }
  }
}