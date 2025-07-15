import axios from 'axios';
import { OpenAICompatibleProvider, OpenAIResponse, AIRequestParams } from '../../core/base/OpenAICompatibleProvider';
import config from '../../../../config/index';
import logger from '../../../../utils/logger';

export class DeepSeekProvider extends OpenAICompatibleProvider {
  readonly name = 'deepseek';

  constructor() {
    super({
      apiKey: config.ai.deepseek.apiKey || '',
      baseURL: config.ai.deepseek.baseURL || 'https://api.deepseek.com',
      model: config.ai.deepseek.model || 'deepseek-chat',
      timeout: 45000, // DeepSeek专用超时45秒
    });
  }

  async initialize(): Promise<void> {
    try {
      if (!this.config.apiKey) {
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

  protected async makeRequest(requestData: AIRequestParams): Promise<OpenAIResponse> {
    const response = await axios.post(
      `${this.config.baseURL}/chat/completions`,
      requestData,
      {
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: this.timeout,
      }
    );

    return response.data;
  }
}