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
          morningHour: {
            type: "number",
            description: "早晨提醒小时数 (0-23)"
          },
          morningMinute: {
            type: "number",
            description: "早晨提醒分钟数 (0-59)"
          },
          eveningHour: {
            type: "number",
            description: "晚间提醒小时数 (0-23)"
          },
          eveningMinute: {
            type: "number",
            description: "晚间提醒分钟数 (0-59)"
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
      description: "标记助手收件箱中的邮件为已读（仅管理员可用）",
      parameters: {
        type: "object",
        properties: {
          markAll: {
            type: "boolean",
            description: "是否标记助手收件箱中的所有邮件为已读"
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
      description: "获取邮件助手系统的当前状态和统计信息（仅管理员可用）",
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
  },
  {
    type: "function" as const,
    function: {
      name: "process_work_report",
      description: "处理和记录工作报告内容，用于工作总结、成果记录等",
      parameters: {
        type: "object",
        properties: {
          content: {
            type: "string",
            description: "工作报告的详细内容，包括完成的任务、进展、成果等"
          }
        },
        required: ["content"]
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "create_schedule_reminder",
      description: "创建日程安排和提醒事项",
      parameters: {
        type: "object",
        properties: {
          content: {
            type: "string",
            description: "提醒或日程的具体内容"
          },
          time: {
            type: "string",
            description: "提醒时间（可选），格式如：2024-01-15 09:00 或 明天早上9点"
          }
        },
        required: ["content"]
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "generate_work_summary",
      description: "生成指定时间段的工作总结",
      parameters: {
        type: "object",
        properties: {
          period: {
            type: "string",
            description: "总结时间段：'today'（今日）、'week'（本周）、'month'（本月）",
            enum: ["today", "week", "month"]
          }
        },
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
          morningHour: {
            type: "number",
            description: "早晨提醒小时数 (0-23)"
          },
          morningMinute: {
            type: "number",
            description: "早晨提醒分钟数 (0-59)"
          },
          eveningHour: {
            type: "number",
            description: "晚间提醒小时数 (0-23)"
          },
          eveningMinute: {
            type: "number",
            description: "晚间提醒分钟数 (0-59)"
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
      description: "标记助手收件箱中的邮件为已读（仅管理员可用）",
      parameters: {
        type: "object",
        properties: {
          markAll: {
            type: "boolean",
            description: "是否标记助手收件箱中的所有邮件为已读"
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
      description: "获取邮件助手系统的当前状态和统计信息（仅管理员可用）",
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
  },
  {
    type: "function",
    function: {
      name: "process_work_report",
      description: "处理和记录工作报告内容，用于工作总结、成果记录等",
      parameters: {
        type: "object",
        properties: {
          content: {
            type: "string",
            description: "工作报告的详细内容，包括完成的任务、进展、成果等"
          }
        },
        required: ["content"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_schedule_reminder",
      description: "创建日程安排和提醒事项",
      parameters: {
        type: "object",
        properties: {
          content: {
            type: "string",
            description: "提醒或日程的具体内容"
          },
          time: {
            type: "string",
            description: "提醒时间（可选），格式如：2024-01-15 09:00 或 明天早上9点"
          }
        },
        required: ["content"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "generate_work_summary",
      description: "生成指定时间段的工作总结",
      parameters: {
        type: "object",
        properties: {
          period: {
            type: "string",
            description: "总结时间段：'today'（今日）、'week'（本周）、'month'（本月）"
          }
        },
        required: []
      }
    }
  }
];