# 🧪 测试 API

## 概述

测试 API 用于手动触发系统功能进行验证和调试，仅供管理员使用。

## 邮件测试

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

## 通知测试

### 测试用户通知
```http
POST /test/user-notifications
Authorization: Bearer <admin-token>
```

### 测试系统启动通知
```http
POST /test/startup-notification
Authorization: Bearer <admin-token>
```

### 测试系统停止通知
```http
POST /test/shutdown-notification
Authorization: Bearer <admin-token>
```

## 报告测试

### 测试周报生成
```http
POST /test/weekly-report
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "userId": "user-id", // 或 "all"
  "weekOffset": 0      // 0=本周, -1=上周
}
```

### 测试个性化建议
```http
POST /test/personalized-suggestions
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "userId": "user-id" // 或 "all"
}
```

## 管理员功能测试

### 测试重命名命令
```http
POST /test/rename-command
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "email": "user@example.com",
  "newName": "新名称"
}
```

## 使用注意事项

- **会发送真实邮件** - 请谨慎使用
- **频率限制** - 每分钟最多 10 次请求
- **仅管理员** - 需要管理员权限

---

**文档版本**: v1.0.0