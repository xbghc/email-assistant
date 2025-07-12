# 🔧 管理员 API

## 概述

管理员 API 提供用户管理、系统管理等高级功能。所有端点都需要管理员权限。

## 用户管理

### 获取所有用户

```http
GET /api/admin/users
Authorization: Bearer <admin-token>
```

**响应：**
```json
{
  "success": true,
  "data": {
    "users": [
      {
        "id": "user-123",
        "username": "张三",
        "email": "user@example.com",
        "role": "User",
        "created_at": "2025-01-01T00:00:00.000Z",
        "last_login": "2025-07-12T08:00:00.000Z"
      }
    ],
    "total": 25
  }
}
```

### 创建用户

```http
POST /api/admin/users
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "username": "新用户",
  "email": "newuser@example.com",
  "password": "password123",
  "role": "User"
}
```

### 更新用户

```http
PUT /api/admin/users/:id
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "username": "更新的用户名",
  "role": "Admin"
}
```

### 删除用户

```http
DELETE /api/admin/users/:id
Authorization: Bearer <admin-token>
```

### 重置用户密码

```http
POST /api/admin/users/:id/reset-password
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "newPassword": "newpassword123"
}
```

## 测试端点

### 测试晨间提醒

```http
POST /test/morning-reminder
Authorization: Bearer <admin-token>
```

### 测试晚间提醒

```http
POST /test/evening-reminder
Authorization: Bearer <admin-token>
```

### 测试用户通知

```http
POST /test/user-notifications
Authorization: Bearer <admin-token>
```

### 测试系统通知

```http
POST /test/startup-notification
Authorization: Bearer <admin-token>
```

```http
POST /test/shutdown-notification
Authorization: Bearer <admin-token>
```

### 测试周报生成

```http
POST /test/weekly-report
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "userId": "user-id", // 或 "all" 生成所有用户周报
  "weekOffset": 0      // 0=本周, -1=上周
}
```

### 测试个性化建议

```http
POST /test/personalized-suggestions
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "userId": "user-id" // 或 "all" 为所有用户生成
}
```

### 测试管理员命令

```http
POST /test/rename-command
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "email": "user@example.com",
  "newName": "新名称"
}
```

## 系统管理

### 获取系统日志

```http
GET /api/admin/logs?lines=100&level=error
Authorization: Bearer <admin-token>
```

**查询参数：**
- `lines`: 返回行数（默认100）
- `level`: 日志级别 `error|warn|info|debug`
- `from`: 开始时间 ISO 格式
- `to`: 结束时间 ISO 格式

### 清理系统数据

```http
POST /api/admin/cleanup
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "type": "logs", // logs|temp|cache
  "daysOld": 30
}
```

### 系统配置

```http
GET /api/admin/config
Authorization: Bearer <admin-token>
```

```http
PUT /api/admin/config
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "emailCheckInterval": 30000,
  "maxLogSize": "100MB"
}
```

## 统计信息

### 获取系统统计

```http
GET /api/admin/stats
Authorization: Bearer <admin-token>
```

**响应：**
```json
{
  "success": true,
  "data": {
    "users": {
      "total": 25,
      "active": 18,
      "admins": 2
    },
    "reports": {
      "totalSubmitted": 1250,
      "thisMonth": 95
    },
    "emails": {
      "sentToday": 42,
      "sentThisMonth": 1200
    },
    "ai": {
      "requestsToday": 128,
      "requestsThisMonth": 3500
    }
  }
}
```

## 常见错误

- `403 FORBIDDEN` - 需要管理员权限
- `400 INVALID_ROLE` - 无效的用户角色
- `409 USER_EXISTS` - 用户已存在
- `404 USER_NOT_FOUND` - 用户不存在

---

**文档版本**: v1.0.0