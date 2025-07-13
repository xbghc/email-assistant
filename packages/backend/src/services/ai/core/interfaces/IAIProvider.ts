import { ContextEntry } from '../../../../models/index';

export interface AIGenerationOptions {
  maxTokens: number;
  temperature: number;
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