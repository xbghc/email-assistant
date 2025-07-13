import { IFunctionHandler, FunctionResult, FunctionDefinition } from '../../core/interfaces/IFunctionHandler';
import { UpdateReminderTimesHandler } from '../handlers/UpdateReminderTimesHandler';
import { MarkEmailsReadHandler } from '../handlers/MarkEmailsReadHandler';
import { GetUserConfigHandler } from '../handlers/GetUserConfigHandler';
import UserService from '../../../user/userService';
import logger from '../../../../utils/logger';

export class FunctionRegistry {
  private handlers: Map<string, IFunctionHandler> = new Map();
  private userService: UserService;

  constructor(userService?: UserService) {
    this.userService = userService || new UserService();
    this.registerDefaultHandlers();
  }

  private registerDefaultHandlers(): void {
    // 注册默认功能处理器
    this.registerHandler(new UpdateReminderTimesHandler(this.userService));
    this.registerHandler(new MarkEmailsReadHandler());
    this.registerHandler(new GetUserConfigHandler(this.userService));
  }

  registerHandler(handler: IFunctionHandler): void {
    this.handlers.set(handler.name, handler);
    logger.debug(`Function handler registered: ${handler.name}`);
  }

  unregisterHandler(name: string): void {
    this.handlers.delete(name);
    logger.debug(`Function handler unregistered: ${name}`);
  }

  getHandler(name: string): IFunctionHandler | undefined {
    return this.handlers.get(name);
  }

  getAllHandlers(): IFunctionHandler[] {
    return Array.from(this.handlers.values());
  }

  getFunctionDefinitions(): FunctionDefinition[] {
    return this.getAllHandlers().map(handler => handler.definition);
  }

  getOpenAIFunctionTools(): Array<{
    type: 'function';
    function: {
      name: string;
      description: string;
      parameters: Record<string, unknown>;
    };
  }> {
    return this.getAllHandlers().map(handler => ({
      type: 'function',
      function: {
        name: handler.definition.name,
        description: handler.definition.description,
        parameters: handler.definition.parameters,
      }
    }));
  }

  getDeepSeekFunctionTools(): Array<{
    type: 'function';
    function: {
      name: string;
      description: string;
      parameters: Record<string, unknown>;
    };
  }> {
    // DeepSeek 使用与 OpenAI 相同的格式
    return this.getOpenAIFunctionTools();
  }

  async handleFunctionCall(
    functionName: string,
    args: Record<string, unknown>,
    userId?: string
  ): Promise<FunctionResult> {
    try {
      const handler = this.getHandler(functionName);
      if (!handler) {
        return {
          success: false,
          message: `未知的功能：${functionName}`
        };
      }

      // 验证参数
      if (!handler.validateArgs(args)) {
        return {
          success: false,
          message: `功能 ${functionName} 的参数格式不正确`
        };
      }

      // 执行功能
      const result = await handler.handle(args, userId);
      
      logger.debug(`Function call executed: ${functionName}`, {
        success: result.success,
        userId
      });

      return result;

    } catch (error) {
      logger.error(`Function call failed: ${functionName}`, error);
      return {
        success: false,
        message: '功能执行失败，请稍后重试'
      };
    }
  }

  async initialize(): Promise<void> {
    await this.userService.initialize();
    logger.info('Function registry initialized successfully');
  }

  getRegisteredFunctions(): string[] {
    return Array.from(this.handlers.keys());
  }

  hasFunction(name: string): boolean {
    return this.handlers.has(name);
  }
}