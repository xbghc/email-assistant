# 👤 用户管理 API

## 概述

用户管理 API 允许用户查看和更新自己的个人信息、偏好设置等。所有端点都需要用户认证。

用户的唯一标识符（ID）就是其电子邮件地址。

## API 端点

### 获取当前用户信息

```http
GET /api/users/me
Authorization: Bearer <token>
```

**响应：**

```json
{
  "success": true,
  "data": {
    "id": "user@example.com",
    "username": "张三",
    "email": "user@example.com",
    "role": "User",
    "created_at": "2025-01-01T00:00:00.000Z",
    "preferences": {
      "morning_reminder": true,
      "evening_reminder": true,
      "weekly_report": true,
      "timezone": "Asia/Shanghai"
    }
  }
}
```

### 更新用户偏好设置

```http
PUT /api/users/preferences
Authorization: Bearer <token>
Content-Type: application/json

{
  "morning_reminder": true,
  "evening_reminder": false,
  "weekly_report": true,
  "timezone": "Asia/Shanghai"
}
```

**支持的时区：** `Asia/Shanghai`, `America/New_York`, `Europe/London`, `Asia/Tokyo`, `UTC`

### 更新用户基本信息

```http
PUT /api/users/profile
Authorization: Bearer <token>
Content-Type: application/json

{
  "username": "新用户名"
}
```

### 修改密码

```http
PUT /api/users/password
Authorization: Bearer <token>
Content-Type: application/json

{
  "currentPassword": "旧密码",
  "newPassword": "新密码"
}
```

**密码要求：** 最少 8 个字符

### 获取用户统计信息

```http
GET /api/users/stats
Authorization: Bearer <token>
```

**响应：**

```json
{
  "success": true,
  "data": {
    "totalReports": 45,
    "totalSchedules": 128,
    "remindersSent": 89,
    "weeklyReportsGenerated": 12,
    "lastLoginAt": "2025-07-12T08:00:00.000Z",
    "accountCreatedAt": "2025-01-01T00:00:00.000Z"
  }
}
```

## 常见错误

- `401 UNAUTHORIZED` - 认证失败
- `400 INVALID_TIMEZONE` - 时区格式错误
- `400 INVALID_PASSWORD` - 当前密码错误
- `400 WEAK_PASSWORD` - 新密码不符合要求

---

## **文档版本**: v1.0.0
