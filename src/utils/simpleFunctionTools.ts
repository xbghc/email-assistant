// 简化的Function Call工具定义，兼容性更好
export const simpleFunctionTools = [
  {
    type: "function" as const,
    function: {
      name: "update_reminder_times",
      description: "更新用户的提醒时间设置",
      parameters: {
        type: "object",
        properties: {
          morningTime: {
            type: "string",
            description: "早晨提醒时间，格式为HH:MM，例如：08:00、09:30。支持自然语言如'9点半'转换为'09:30'"
          },
          eveningTime: {
            type: "string", 
            description: "晚间提醒时间，格式为HH:MM，例如：20:00、18:30。支持自然语言如'6点半'转换为'18:30'"
          }
        },
        required: []
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "mark_emails_read",
      description: "标记邮件为已读",
      parameters: {
        type: "object",
        properties: {
          markAll: {
            type: "boolean",
            description: "是否标记所有邮件为已读"
          }
        },
        required: ["markAll"]
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "get_user_config",
      description: "获取用户当前配置信息",
      parameters: {
        type: "object",
        properties: {},
        required: []
      }
    }
  }
];

// DeepSeek格式的简化Function工具 - 严格按照DeepSeek文档格式
export const simpleDeepSeekTools = [
  {
    type: "function",
    function: {
      name: "update_reminder_times",
      description: "更新用户的提醒时间设置",
      parameters: {
        type: "object",
        properties: {
          morningTime: {
            type: "string",
            description: "早晨提醒时间，格式为HH:MM，例如：08:00、09:30。支持自然语言如'9点半'转换为'09:30'"
          },
          eveningTime: {
            type: "string", 
            description: "晚间提醒时间，格式为HH:MM，例如：20:00、18:30。支持自然语言如'6点半'转换为'18:30'"
          }
        },
        required: []
      }
    }
  },
  {
    type: "function",
    function: {
      name: "mark_emails_read",
      description: "标记邮件为已读",
      parameters: {
        type: "object",
        properties: {
          markAll: {
            type: "boolean",
            description: "是否标记所有邮件为已读"
          }
        },
        required: ["markAll"]
      }
    }
  },
  {
    type: "function", 
    function: {
      name: "get_user_config",
      description: "获取用户当前配置信息",
      parameters: {
        type: "object",
        properties: {},
        required: []
      }
    }
  }
];