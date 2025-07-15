import OpenAI from 'openai';
import type { ChatCompletionCreateParams } from 'openai/resources/chat/completions';
import { OpenAICompatibleProvider, OpenAIResponse, AIRequestParams } from '../../core/base/OpenAICompatibleProvider';
import config from '../../../../config/index';
import logger from '../../../../utils/logger';

export class OpenAIProvider extends OpenAICompatibleProvider {
  readonly name = 'openai';
  private client?: OpenAI;

  constructor() {
    super({
      apiKey: config.ai.openai.apiKey || '',
      baseURL: config.ai.openai.baseURL || 'https://api.openai.com/v1',
      model: config.ai.openai.model || 'gpt-3.5-turbo',
      timeout: 30000,
    });
  }

  async initialize(): Promise<void> {
    try {
      if (!this.config.apiKey) {
        throw new Error('OpenAI API key not configured');
      }

      this.client = new OpenAI({
        apiKey: this.config.apiKey,
        baseURL: this.config.baseURL,
      });

      this._isInitialized = true;
      logger.info('OpenAI provider initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize OpenAI provider:', error);
      throw error;
    }
  }

  protected async makeRequest(requestData: AIRequestParams): Promise<OpenAIResponse> {
    if (!this.client) {
      throw new Error('OpenAI client not initialized');
    }

    // 我们的AIRequestParams结构与OpenAI的ChatCompletionCreateParams兼容
    // 只需要类型断言即可，因为我们已经确保了结构的一致性
    const response = await this.client.chat.completions.create(requestData as ChatCompletionCreateParams);
    return response as OpenAIResponse;
  }
}