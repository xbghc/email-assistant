import axios from 'axios';
import { BaseAIProvider } from '../../core/base/BaseAIProvider';
import { AIGenerationOptions, FunctionCallResponse } from '../../core/interfaces/IAIProvider';
import config from '../../../../config/index';
import logger from '../../../../utils/logger';

export class DeepSeekProvider extends BaseAIProvider {
  readonly name = 'deepseek';
  private readonly timeout = 45000; // DeepSeek专用超时45秒

  async initialize(): Promise<void> {
    try {
      if (!config.ai.deepseek.apiKey) {
        throw new Error('DeepSeek API key not configured');
      }

      // 测试连接
      await this.healthCheck();
      
      this._isInitialized = true;
      logger.info('DeepSeek provider initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize DeepSeek provider:', error);
      throw error;
    }
  }

  async generateResponse(
    systemMessage: string,
    userMessage: string,
    options: AIGenerationOptions
  ): Promise<string> {
    try {
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
          timeout: this.timeout,
        }
      );

      return response.data.choices[0]?.message?.content || '';
    } catch (error) {
      logger.error('DeepSeek response generation failed:', error);
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
    try {
      const tools = availableFunctions.map(func => ({
        type: 'function' as const,
        function: {
          name: func.name,
          description: func.description,
          parameters: func.parameters,
        },
      }));

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
          tools,
          tool_choice: 'auto',
        },
        {
          headers: {
            'Authorization': `Bearer ${config.ai.deepseek.apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: this.timeout,
        }
      );

      const message = response.data.choices[0]?.message;
      if (!message) {
        throw new Error('No response from DeepSeek');
      }

      const result: FunctionCallResponse = {};

      // 如果有function call，返回function calls
      if (message.tool_calls && message.tool_calls.length > 0) {
        result.functionCalls = message.tool_calls
          .filter((toolCall: { type: string }) => toolCall.type === 'function')
          .map((toolCall: { function: { name: string; arguments: string } }) => ({
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
      logger.error('DeepSeek function call failed:', error);
      throw error;
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const testResponse = await axios.post(
        `${config.ai.deepseek.baseURL}/chat/completions`,
        {
          model: config.ai.deepseek.model,
          messages: [
            { role: 'system', content: '你是一个测试助手。' },
            { role: 'user', content: '请回复"健康"' },
          ],
          max_tokens: 10,
          temperature: 0,
        },
        {
          headers: {
            'Authorization': `Bearer ${config.ai.deepseek.apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: this.timeout,
        }
      );

      return testResponse.data.choices[0]?.message?.content?.length > 0;
    } catch (error) {
      logger.error('DeepSeek health check failed:', error);
      return false;
    }
  }
}