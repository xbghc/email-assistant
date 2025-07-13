import { IAIProvider } from '../core/interfaces/IAIProvider';
import { OpenAIProvider } from './openai/OpenAIProvider';
import { DeepSeekProvider } from './deepseek/DeepSeekProvider';
import { MockProvider } from './mock/MockProvider';
import config from '../../../config/index';
import logger from '../../../utils/logger';

export type SupportedProvider = 'openai' | 'azure-openai' | 'deepseek' | 'google' | 'anthropic' | 'mock';

export class ProviderFactory {
  private static instances: Map<SupportedProvider, IAIProvider> = new Map();

  static async createProvider(providerName?: SupportedProvider): Promise<IAIProvider> {
    const provider = providerName || config.ai.provider as SupportedProvider;
    
    // 返回已存在的实例
    if (this.instances.has(provider)) {
      const instance = this.instances.get(provider)!;
      if (instance.isInitialized) {
        return instance;
      }
    }

    // 创建新实例
    let providerInstance: IAIProvider;

    switch (provider) {
      case 'openai':
      case 'azure-openai':
        providerInstance = new OpenAIProvider();
        break;
      case 'deepseek':
        providerInstance = new DeepSeekProvider();
        break;
      case 'mock':
        providerInstance = new MockProvider();
        break;
      case 'google':
        // TODO: 实现GoogleProvider
        throw new Error('Google provider not implemented yet');
      case 'anthropic':
        // TODO: 实现AnthropicProvider
        throw new Error('Anthropic provider not implemented yet');
      default:
        throw new Error(`Unsupported AI provider: ${provider}`);
    }

    try {
      await providerInstance.initialize();
      this.instances.set(provider, providerInstance);
      logger.info(`AI provider '${provider}' created and initialized successfully`);
      return providerInstance;
    } catch (error) {
      logger.error(`Failed to initialize AI provider '${provider}':`, error);
      throw error;
    }
  }

  static async getProvider(providerName?: SupportedProvider): Promise<IAIProvider> {
    return this.createProvider(providerName);
  }

  static getSupportedProviders(): SupportedProvider[] {
    return ['openai', 'azure-openai', 'deepseek', 'google', 'anthropic', 'mock'];
  }

  static async healthCheckAll(): Promise<Record<SupportedProvider, boolean>> {
    const results: Record<string, boolean> = {};
    
    for (const providerName of this.getSupportedProviders()) {
      try {
        if (this.instances.has(providerName)) {
          const provider = this.instances.get(providerName)!;
          results[providerName] = await provider.healthCheck();
        } else {
          results[providerName] = false;
        }
      } catch (error) {
        logger.error(`Health check failed for provider '${providerName}':`, error);
        results[providerName] = false;
      }
    }

    return results as Record<SupportedProvider, boolean>;
  }

  static clearInstances(): void {
    this.instances.clear();
    logger.info('All provider instances cleared');
  }
}