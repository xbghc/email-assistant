# 📅 日程管理 API

## 概述

日程管理 API 允许用户创建、查询和更新个人日程安排。所有端点都需要用户认证。

## API 端点

### 获取今日日程

```http
GET /api/schedule/today
Authorization: Bearer <token>
```

**响应：**
```json
{
  "success": true,
  "data": {
    "date": "2025-07-12",
    "events": [
      {
        "time": "09:00",
        "title": "团队会议",
        "description": "讨论项目进展",
        "priority": "high"
      }
    ]
  }
}
```

### 获取指定日期日程

```http
GET /api/schedule?date=2025-07-12
Authorization: Bearer <token>
```

**查询参数：**
- `date`: 日期格式 YYYY-MM-DD

### 创建/更新日程

```http
POST /api/schedule
Authorization: Bearer <token>
Content-Type: application/json

{
  "date": "2025-07-12",
  "events": [
    {
      "time": "14:00",
      "title": "项目评审",
      "description": "季度项目评审会议",
      "priority": "high"
    }
  ]
}
```

**事件字段：**
- `time`: 时间格式 HH:MM
- `title`: 事件标题（必需）
- `description`: 事件描述（可选）
- `priority`: 优先级 `low|medium|high`

### 获取日程状态

```http
GET /api/schedule/status
Authorization: Bearer <token>
```

**响应：**
```json
{
  "success": true,
  "data": {
    "totalEvents": 15,
    "upcomingEvents": 3,
    "todayEvents": 2,
    "nextEvent": {
      "date": "2025-07-12",
      "time": "15:00",
      "title": "客户会议"
    }
  }
}
```

### 删除日程

```http
DELETE /api/schedule?date=2025-07-12
Authorization: Bearer <token>
```

删除指定日期的所有日程事件。

## 常见错误

- `400 INVALID_DATE` - 日期格式错误
- `400 INVALID_TIME` - 时间格式错误
- `400 MISSING_TITLE` - 缺少事件标题
- `404 SCHEDULE_NOT_FOUND` - 日程不存在

---

**文档版本**: v1.0.0