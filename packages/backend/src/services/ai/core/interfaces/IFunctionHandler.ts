export interface FunctionResult {
  success: boolean;
  message: string;
  data?: Record<string, unknown>;
}

export interface FunctionDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, {
      type: string;
      description: string;
      enum?: string[];
    }>;
    required?: string[];
  };
}

export interface IFunctionHandler {
  readonly name: string;
  readonly definition: FunctionDefinition;

  handle(
    args: Record<string, unknown>,
    userId?: string
  ): Promise<FunctionResult>;

  validateArgs(args: Record<string, unknown>): boolean;
}