import { ContextEntry } from '../../../../models/index';

export interface AIGenerationOptions {
  maxTokens: number;
  temperature: number;
  topP?: number;                    // 核心采样，控制输出的多样性
  frequencyPenalty?: number;        // 频率惩罚，减少重复内容
  presencePenalty?: number;         // 存在惩罚，鼓励探索新主题
  stopSequences?: string[];         // 停止序列，遇到时停止生成
  stream?: boolean;                 // 是否启用流式响应
  seed?: number;                    // 随机种子，确保可复现性
  responseFormat?: 'text' | 'json'; // 响应格式
}

export interface AIResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface FunctionCallResponse {  /// @todo: 为什么这里没有usage？
  content?: string;
  functionCalls?: Array<{
    name: string;
    arguments: Record<string, unknown>;
  }>;
}

export interface IAIProvider {
  readonly name: string;
  readonly isInitialized: boolean;

  initialize(): Promise<void>;
  
  generateResponse(  /// @todo: 什么时候会不提供工具调用，只让AI生成内容？
    systemMessage: string,
    userMessage: string,
    options: AIGenerationOptions
  ): Promise<string>;

  generateResponseWithFunctions(
    systemMessage: string,
    userMessage: string,
    options: AIGenerationOptions,
    availableFunctions: Array<{
      name: string;
      description: string;
      parameters: Record<string, unknown>;
    }>
  ): Promise<FunctionCallResponse>;

  generateMorningSuggestions(
    todaySchedule: string,
    yesterdayPerformance: string,
    context: ContextEntry[]
  ): Promise<string>;

  summarizeWorkReport(
    workReport: string,
    context: ContextEntry[]
  ): Promise<string>;

  compressContext(context: ContextEntry[]): Promise<string>;

  healthCheck(): Promise<boolean>;  /// @todo: 这是做什么的？
}