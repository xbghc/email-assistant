import { BaseAIProvider } from './BaseAIProvider';
import { AIGenerationOptions, FunctionCallResponse } from '../interfaces/IAIProvider';
import logger from '../../../../utils/logger';

export interface OpenAICompatibleConfig {
  apiKey: string;
  baseURL: string;
  model: string;
  timeout?: number;
}

export interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OpenAITool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface OpenAIToolCall {
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface OpenAIResponse {
  choices: Array<{
    message: {
      content?: string;
      tool_calls?: OpenAIToolCall[];
    };
  }>;
}

// 通用的AI请求参数接口，兼容OpenAI API格式
// 这样设计可以让所有OpenAI兼容的提供商使用相同的参数结构
export interface AIRequestParams {
  model: string;
  messages: OpenAIMessage[];
  max_tokens: number;
  temperature: number;
  // 高级参数 - 可选
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stop?: string[];
  stream?: boolean;
  seed?: number;
  response_format?: { type: string };
  // 函数调用相关
  tools?: OpenAITool[];
  tool_choice?: string;
}

export abstract class OpenAICompatibleProvider extends BaseAIProvider {
  protected config: OpenAICompatibleConfig;
  protected timeout: number;

  constructor(config: OpenAICompatibleConfig) {
    super();
    this.config = config;
    this.timeout = config.timeout || 30000;
  }

  async generateResponse(
    systemMessage: string,
    userMessage: string,
    options: AIGenerationOptions
  ): Promise<string> {
    try {
      const requestData: AIRequestParams = {
        model: this.config.model,
        messages: [
          { role: 'system', content: systemMessage },
          { role: 'user', content: userMessage },
        ],
        max_tokens: options.maxTokens,
        temperature: options.temperature,
      };

      // 添加可选参数
      if (options.topP !== undefined) requestData.top_p = options.topP;
      if (options.frequencyPenalty !== undefined) requestData.frequency_penalty = options.frequencyPenalty;
      if (options.presencePenalty !== undefined) requestData.presence_penalty = options.presencePenalty;
      if (options.stopSequences) requestData.stop = options.stopSequences;
      if (options.stream !== undefined) requestData.stream = options.stream;
      if (options.seed !== undefined) requestData.seed = options.seed;
      if (options.responseFormat === 'json') {
        requestData.response_format = { type: 'json_object' };
      }

      const response = await this.makeRequest(requestData);
      return response.choices[0]?.message?.content || '';
    } catch (error) {
      logger.error(`${this.name} response generation failed:`, error);
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
      const tools: OpenAITool[] = availableFunctions.map(func => ({
        type: 'function',
        function: {
          name: func.name,
          description: func.description,
          parameters: func.parameters,
        },
      }));

      const requestData: AIRequestParams = {
        model: this.config.model,
        messages: [
          { role: 'system', content: systemMessage },
          { role: 'user', content: userMessage },
        ],
        max_tokens: options.maxTokens,
        temperature: options.temperature,
        tools,
        tool_choice: 'auto',
      };

      // 添加可选参数
      if (options.topP !== undefined) requestData.top_p = options.topP;
      if (options.frequencyPenalty !== undefined) requestData.frequency_penalty = options.frequencyPenalty;
      if (options.presencePenalty !== undefined) requestData.presence_penalty = options.presencePenalty;
      if (options.stopSequences) requestData.stop = options.stopSequences;
      if (options.stream !== undefined) requestData.stream = options.stream;
      if (options.seed !== undefined) requestData.seed = options.seed;
      if (options.responseFormat === 'json') {
        requestData.response_format = { type: 'json_object' };
      }

      const response = await this.makeRequest(requestData);

      const message = response.choices[0]?.message;
      if (!message) {
        throw new Error(`No response from ${this.name}`);
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
      logger.error(`${this.name} function call failed:`, error);
      throw error;
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const testResponse = await this.makeRequest({
        model: this.config.model,
        messages: [
          { role: 'system', content: '你是一个测试助手。' },
          { role: 'user', content: '请回复"健康"' },
        ],
        max_tokens: 10,
        temperature: 0,
      });

      return (testResponse.choices[0]?.message?.content?.length || 0) > 0;
    } catch (error) {
      logger.error(`${this.name} health check failed:`, error);
      return false;
    }
  }

  protected abstract makeRequest(requestData: AIRequestParams): Promise<OpenAIResponse>;
}