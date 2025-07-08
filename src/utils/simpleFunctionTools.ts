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
  },
  {
    type: "function" as const,
    function: {
      name: "get_recent_activities",
      description: "获取用户最近的活动记录，包括工作报告和日程反馈",
      parameters: {
        type: "object",
        properties: {
          days: {
            type: "number",
            description: "查询最近多少天的记录，默认7天，最多30天"
          },
          type: {
            type: "string",
            description: "活动类型过滤：'work_summary', 'schedule', 'conversation' 或 'all'",
            enum: ["work_summary", "schedule", "conversation", "all"]
          }
        },
        required: []
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "get_reminder_history",
      description: "获取提醒发送历史记录",
      parameters: {
        type: "object",
        properties: {
          days: {
            type: "number",
            description: "查询最近多少天的提醒记录，默认7天"
          }
        },
        required: []
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "get_system_status",
      description: "获取邮件助手系统的当前状态和统计信息",
      parameters: {
        type: "object",
        properties: {},
        required: []
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "search_conversations",
      description: "搜索历史对话记录",
      parameters: {
        type: "object",
        properties: {
          keyword: {
            type: "string",
            description: "搜索关键词"
          },
          days: {
            type: "number",
            description: "搜索范围（天数），默认30天"
          }
        },
        required: ["keyword"]
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
  },
  {
    type: "function",
    function: {
      name: "get_recent_activities",
      description: "获取用户最近的活动记录，包括工作报告和日程反馈",
      parameters: {
        type: "object",
        properties: {
          days: {
            type: "number",
            description: "查询最近多少天的记录，默认7天，最多30天"
          },
          type: {
            type: "string",
            description: "活动类型过滤：'work_summary', 'schedule', 'conversation' 或 'all'"
          }
        },
        required: []
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_reminder_history",
      description: "获取提醒发送历史记录",
      parameters: {
        type: "object",
        properties: {
          days: {
            type: "number",
            description: "查询最近多少天的提醒记录，默认7天"
          }
        },
        required: []
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_system_status",
      description: "获取邮件助手系统的当前状态和统计信息",
      parameters: {
        type: "object",
        properties: {},
        required: []
      }
    }
  },
  {
    type: "function",
    function: {
      name: "search_conversations",
      description: "搜索历史对话记录",
      parameters: {
        type: "object",
        properties: {
          keyword: {
            type: "string",
            description: "搜索关键词"
          },
          days: {
            type: "number",
            description: "搜索范围（天数），默认30天"
          }
        },
        required: ["keyword"]
      }
    }
  }
];