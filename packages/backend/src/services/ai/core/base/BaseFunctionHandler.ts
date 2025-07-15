import { IFunctionHandler, FunctionResult, FunctionDefinition } from '../interfaces/IFunctionHandler';
import logger from '../../../../utils/logger';

export abstract class BaseFunctionHandler implements IFunctionHandler {
  abstract readonly name: string;
  abstract readonly definition: FunctionDefinition;

  abstract handle(
    args: Record<string, unknown>,
    userId?: string
  ): Promise<FunctionResult>;

  validateArgs(args: Record<string, unknown>): boolean {
    try {
      const { properties, required = [] } = this.definition.parameters;
      
      // 检查必需参数
      for (const requiredField of required) {
        if (!(requiredField in args)) {
          logger.warn(`Missing required parameter: ${requiredField}`);
          return false;
        }
      }

      // 检查参数类型
      for (const [key, value] of Object.entries(args)) {
        if (key in properties) {
          const expectedType = properties[key]?.type;
          const actualType = typeof value;
          
          if (expectedType === 'string' && actualType !== 'string') {
            logger.warn(`Parameter ${key} should be string, got ${actualType}`);
            return false;
          }
          
          if (expectedType === 'number' && actualType !== 'number') {
            logger.warn(`Parameter ${key} should be number, got ${actualType}`);
            return false;
          }
          
          if (expectedType === 'boolean' && actualType !== 'boolean') {
            logger.warn(`Parameter ${key} should be boolean, got ${actualType}`);
            return false;
          }
          
          if (expectedType === 'array' && !Array.isArray(value)) {
            logger.warn(`Parameter ${key} should be array, got ${actualType}`);
            return false;
          }
        }
      }

      return true;
    } catch (error) {
      logger.error('Error validating function arguments:', error);
      return false;
    }
  }

  protected createSuccessResult(message: string, data?: Record<string, unknown>): FunctionResult {
    const result: FunctionResult = {
      success: true,
      message
    };
    
    if (data !== undefined) {
      result.data = data;
    }
    
    return result;
  }

  protected createErrorResult(message: string): FunctionResult {
    return {
      success: false,
      message
    };
  }
}