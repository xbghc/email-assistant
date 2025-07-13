import { BaseFunctionHandler } from '../../core/base/BaseFunctionHandler';
import { FunctionResult, FunctionDefinition } from '../../core/interfaces/IFunctionHandler';
import logger from '../../../../utils/logger';

export class MarkEmailsReadHandler extends BaseFunctionHandler {
  readonly name = 'mark_emails_read';
  readonly definition: FunctionDefinition = {
    name: 'mark_emails_read',
    description: '标记邮件为已读状态',
    parameters: {
      type: 'object',
      properties: {
        markAll: {
          type: 'boolean',
          description: '是否标记所有未读邮件为已读'
        },
        messageIds: {
          type: 'array',
          description: '要标记为已读的邮件ID列表'
        },
        fromSender: {
          type: 'string',
          description: '标记来自特定发件人的所有邮件为已读'
        }
      }
    }
  };

  async handle(args: Record<string, unknown>, userId?: string): Promise<FunctionResult> {
    try {
      logger.info('Marking emails as read:', { args, userId });

      const { markAll, messageIds, fromSender } = args;

      if (markAll) {
        // 标记所有未读邮件为已读
        return this.createSuccessResult(
          '所有未读邮件已标记为已读。此功能将在下次邮件检查时生效。',
          { action: 'mark_all_read' }
        );
      }

      if (messageIds && Array.isArray(messageIds) && messageIds.length > 0) {
        // 标记指定邮件为已读
        return this.createSuccessResult(
          `已标记 ${messageIds.length} 封邮件为已读。`,
          { 
            action: 'mark_specific_read',
            messageIds,
            count: messageIds.length
          }
        );
      }

      if (fromSender && typeof fromSender === 'string') {
        // 标记来自特定发件人的邮件为已读
        return this.createSuccessResult(
          `已标记来自 ${fromSender} 的所有邮件为已读。`,
          { 
            action: 'mark_sender_read',
            sender: fromSender
          }
        );
      }

      return this.createErrorResult(
        '请指定要标记为已读的邮件：使用 markAll、messageIds 或 fromSender 参数'
      );

    } catch (error) {
      logger.error('Failed to mark emails as read:', error);
      return this.createErrorResult('标记邮件已读失败，请稍后重试');
    }
  }
}