import { User } from '../models/User';

/**
 * 为特定用户生成专属的Function Call工具
 * 这样可以确保用户只能修改自己的数据，无法访问其他用户的数据
 */
export function createUserSpecificFunctionTools(user: User) {
  return [
    {
      type: "function" as const,
      function: {
        name: "update_my_schedule_times",
        description: `修改您的每日提醒时间（当前：早晨 ${user.config.schedule.morningReminderTime}，晚间 ${user.config.schedule.eveningReminderTime}）`,
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
        name: "mark_my_emails_as_read",
        description: "标记您的邮件为已读状态",
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
        name: "get_my_config",
        description: `获取您当前的配置信息（姓名：${user.name}，语言：${user.config.language === 'zh' ? '中文' : '英文'}）`,
        parameters: {
          type: "object",
          properties: {},
          additionalProperties: false
        }
      }
    },
    {
      type: "function" as const,
      function: {
        name: "stop_my_service",
        description: "暂停您的邮件助手服务（可由管理员重新启用）",
        parameters: {
          type: "object",
          properties: {
            confirmStop: {
              type: "boolean",
              description: "确认停止服务（必须为 true）"
            },
            reason: {
              type: "string",
              description: "停止服务的原因（可选）"
            }
          },
          required: ["confirmStop"],
          additionalProperties: false
        }
      }
    },
    {
      type: "function" as const,
      function: {
        name: "remove_my_account",
        description: "完全移除您的邮件助手账户和所有数据（不可恢复，请谨慎使用）",
        parameters: {
          type: "object",
          properties: {
            confirmRemoval: {
              type: "boolean",
              description: "确认移除账户（必须为 true）"
            },
            finalConfirmation: {
              type: "string",
              description: "最终确认，请输入'我确认删除我的账户'",
              enum: ["我确认删除我的账户"]
            },
            reason: {
              type: "string",
              description: "移除账户的原因（可选，有助于改进服务）"
            }
          },
          required: ["confirmRemoval", "finalConfirmation"],
          additionalProperties: false
        }
      }
    },
    {
      type: "function" as const,
      function: {
        name: "get_help",
        description: "获取邮件助手的使用帮助和功能说明",
        parameters: {
          type: "object",
          properties: {
            topic: {
              type: "string",
              enum: ["basic", "time", "email", "functions", "all"],
              description: "帮助主题：basic(基础使用), time(时间设置), email(邮件管理), functions(功能列表), all(全部)"
            }
          },
          additionalProperties: false
        }
      }
    }
  ];
}

/**
 * 为DeepSeek生成用户专属的Function Call工具（格式略有不同）
 */
export function createUserSpecificDeepSeekFunctionTools(user: User) {
  return [
    {
      name: "update_my_schedule_times",
      description: `修改您的每日提醒时间（当前：早晨 ${user.config.schedule.morningReminderTime}，晚间 ${user.config.schedule.eveningReminderTime}）`,
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
      name: "mark_my_emails_as_read", 
      description: "标记您的邮件为已读状态",
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
      name: "get_my_config",
      description: `获取您当前的配置信息（姓名：${user.name}，语言：${user.config.language === 'zh' ? '中文' : '英文'}）`,
      parameters: {
        type: "object",
        properties: {}
      }
    },
    {
      name: "stop_my_service",
      description: "暂停您的邮件助手服务（可由管理员重新启用）",
      parameters: {
        type: "object",
        properties: {
          confirmStop: {
            type: "boolean",
            description: "确认停止服务（必须为 true）"
          },
          reason: {
            type: "string",
            description: "停止服务的原因（可选）"
          }
        }
      }
    },
    {
      name: "remove_my_account",
      description: "完全移除您的邮件助手账户和所有数据（不可恢复，请谨慎使用）",
      parameters: {
        type: "object",
        properties: {
          confirmRemoval: {
            type: "boolean",
            description: "确认移除账户（必须为 true）"
          },
          finalConfirmation: {
            type: "string",
            description: "最终确认，请输入'我确认删除我的账户'"
          },
          reason: {
            type: "string",
            description: "移除账户的原因（可选）"
          }
        }
      }
    },
    {
      name: "get_help",
      description: "获取邮件助手的使用帮助和功能说明",
      parameters: {
        type: "object",
        properties: {
          topic: {
            type: "string",
            description: "帮助主题"
          }
        }
      }
    }
  ];
}

/**
 * 管理员专用的Function Call工具（包含用户管理功能）
 */
export function createAdminFunctionTools() {
  return [
    {
      type: "function" as const,
      function: {
        name: "admin_add_user",
        description: "添加新用户（管理员专用）",
        parameters: {
          type: "object",
          properties: {
            email: {
              type: "string",
              description: "用户邮箱地址"
            },
            name: {
              type: "string", 
              description: "用户姓名"
            },
            morningTime: {
              type: "string",
              description: "早晨提醒时间，格式为 HH:MM，如 08:30"
            },
            eveningTime: {
              type: "string",
              description: "晚间提醒时间，格式为 HH:MM，如 20:00"
            }
          },
          required: ["email", "name"],
          additionalProperties: false
        }
      }
    },
    {
      type: "function" as const,
      function: {
        name: "admin_list_users",
        description: "列出所有用户（管理员专用）",
        parameters: {
          type: "object",
          properties: {},
          additionalProperties: false
        }
      }
    },
    {
      type: "function" as const,
      function: {
        name: "admin_update_user",
        description: "更新用户配置（管理员专用）",
        parameters: {
          type: "object",
          properties: {
            email: {
              type: "string",
              description: "要更新的用户邮箱"
            },
            field: {
              type: "string",
              enum: ["name", "morningTime", "eveningTime", "language", "status"],
              description: "要更新的字段"
            },
            value: {
              type: "string",
              description: "新的值"
            }
          },
          required: ["email", "field", "value"],
          additionalProperties: false
        }
      }
    }
  ];
}