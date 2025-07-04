// OpenAI Function Call工具定义
export const functionTools = [
  {
    type: "function" as const,
    function: {
      name: "update_schedule_times",
      description: "修改每日早晨和晚间提醒的时间",
      parameters: {
        type: "object",
        properties: {
          morningTime: {
            type: "string",
            description: "早晨提醒时间，格式为 HH:MM（24小时制），如 08:30",
            pattern: "^([01]?[0-9]|2[0-3]):[0-5][0-9]$"
          },
          eveningTime: {
            type: "string", 
            description: "晚间提醒时间，格式为 HH:MM（24小时制），如 20:00",
            pattern: "^([01]?[0-9]|2[0-3]):[0-5][0-9]$"
          }
        },
        additionalProperties: false
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "mark_emails_as_read",
      description: "标记邮件为已读状态",
      parameters: {
        type: "object",
        properties: {
          markAll: {
            type: "boolean",
            description: "是否标记所有未读邮件为已读"
          },
          messageIds: {
            type: "array",
            items: {
              type: "string"
            },
            description: "要标记为已读的特定邮件ID列表"
          },
          fromSender: {
            type: "string",
            description: "标记来自特定发件人的所有邮件为已读"
          }
        },
        additionalProperties: false
      }
    }
  },
  {
    type: "function" as const, 
    function: {
      name: "get_current_config",
      description: "获取当前邮件助手的配置信息，包括提醒时间、邮件检查间隔等",
      parameters: {
        type: "object",
        properties: {},
        additionalProperties: false
      }
    }
  }
];

// DeepSeek Function Call工具定义（格式略有不同）
export const deepseekFunctionTools = [
  {
    name: "update_schedule_times",
    description: "修改每日早晨和晚间提醒的时间",
    parameters: {
      type: "object",
      properties: {
        morningTime: {
          type: "string",
          description: "早晨提醒时间，格式为 HH:MM（24小时制），如 08:30"
        },
        eveningTime: {
          type: "string",
          description: "晚间提醒时间，格式为 HH:MM（24小时制），如 20:00"
        }
      }
    }
  },
  {
    name: "mark_emails_as_read", 
    description: "标记邮件为已读状态",
    parameters: {
      type: "object",
      properties: {
        markAll: {
          type: "boolean",
          description: "是否标记所有未读邮件为已读"
        },
        messageIds: {
          type: "array",
          items: {
            type: "string"
          },
          description: "要标记为已读的特定邮件ID列表"
        },
        fromSender: {
          type: "string",
          description: "标记来自特定发件人的所有邮件为已读"
        }
      }
    }
  },
  {
    name: "get_current_config",
    description: "获取当前邮件助手的配置信息，包括提醒时间、邮件检查间隔等",
    parameters: {
      type: "object",
      properties: {}
    }
  }
];