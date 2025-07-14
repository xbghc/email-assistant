import { AIGenerationOptions } from '../interfaces/IAIProvider';

/**
 * AI生成选项预设工具类
 * 为不同场景提供预配置的AI选项
 */
export class AIOptionPresets {
  /**
   * 创意写作场景 - 高创造性，多样性
   */
  static creative(maxTokens: number = 1000): AIGenerationOptions {
    return {
      maxTokens,
      temperature: 0.8,
      topP: 0.9,
      frequencyPenalty: 0.3,
      presencePenalty: 0.3,
    };
  }

  /**
   * 精确任务场景 - 一致性，可预测性
   */
  static precise(maxTokens: number = 500): AIGenerationOptions {
    return {
      maxTokens,
      temperature: 0.1,
      topP: 0.1,
      frequencyPenalty: 0.0,
      presencePenalty: 0.0,
      seed: 42, // 固定种子确保可复现性
    };
  }

  /**
   * 分析任务场景 - 结构化，逻辑性
   */
  static analytical(maxTokens: number = 800): AIGenerationOptions {
    return {
      maxTokens,
      temperature: 0.3,
      topP: 0.7,
      frequencyPenalty: 0.1,
      presencePenalty: 0.1,
    };
  }

  /**
   * 对话场景 - 自然，平衡
   */
  static conversational(maxTokens: number = 600): AIGenerationOptions {
    return {
      maxTokens,
      temperature: 0.7,
      topP: 0.8,
      frequencyPenalty: 0.2,
      presencePenalty: 0.2,
    };
  }

  /**
   * 摘要场景 - 简洁，重点突出
   */
  static summarization(maxTokens: number = 300): AIGenerationOptions {
    return {
      maxTokens,
      temperature: 0.2,
      topP: 0.6,
      frequencyPenalty: 0.1,
      presencePenalty: 0.0,
    };
  }

  /**
   * 结构化数据场景 - JSON输出
   */
  static structured(maxTokens: number = 500): AIGenerationOptions {
    return {
      maxTokens,
      temperature: 0.1,
      topP: 0.1,
      frequencyPenalty: 0.0,
      presencePenalty: 0.0,
      responseFormat: 'json',
    };
  }

  /**
   * 代码生成场景 - 精确，逻辑性
   */
  static codeGeneration(maxTokens: number = 1000): AIGenerationOptions {
    return {
      maxTokens,
      temperature: 0.2,
      topP: 0.5,
      frequencyPenalty: 0.1,
      presencePenalty: 0.1,
      stopSequences: ['```\n', '```'],
    };
  }

  /**
   * 翻译场景 - 准确，一致
   */
  static translation(maxTokens: number = 800): AIGenerationOptions {
    return {
      maxTokens,
      temperature: 0.1,
      topP: 0.3,
      frequencyPenalty: 0.0,
      presencePenalty: 0.0,
    };
  }

  /**
   * 问答场景 - 信息性，直接
   */
  static questionAnswering(maxTokens: number = 400): AIGenerationOptions {
    return {
      maxTokens,
      temperature: 0.4,
      topP: 0.7,
      frequencyPenalty: 0.1,
      presencePenalty: 0.1,
    };
  }

  /**
   * 自定义选项创建器
   */
  static custom(options: Partial<AIGenerationOptions> & { maxTokens: number; temperature: number }): AIGenerationOptions {
    return {
      topP: 0.9,
      frequencyPenalty: 0.0,
      presencePenalty: 0.0,
      ...options,
    };
  }
}