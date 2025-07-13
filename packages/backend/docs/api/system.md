# 🏥 系统监控 API

## 概述

系统监控 API 提供健康检查、性能指标等系统状态信息。

## API 端点

### 健康检查

```http
GET /health
```

**响应：**
```json
{
  "status": "healthy",
  "services": {
    "email": "up",
    "ai": "up",
    "database": "up"
  },
  "uptime": 3600,
  "version": "1.0.0",
  "timestamp": "2025-07-12T08:00:00.000Z"
}
```

**状态说明：**
- `healthy` - 所有服务正常
- `degraded` - 部分服务异常
- `unhealthy` - 关键服务故障

### 详细系统状态

```http
GET /api/system/status
Authorization: Bearer <admin-token>
```

**需要管理员权限**

**响应：**
```json
{
  "success": true,
  "data": {
    "system": {
      "uptime": 3600,
      "memoryUsage": {
        "heapUsed": 52428800,
        "heapTotal": 67108864
      },
      "cpuUsage": 15.5
    },
    "email": {
      "status": "connected",
      "sentToday": 42
    },
    "ai": {
      "provider": "openai",
      "status": "active",
      "requestsToday": 128
    }
  }
}
```

### 获取性能指标

```http
GET /api/metrics
Authorization: Bearer <token>
```

**响应：**
```json
{
  "success": true,
  "data": {
    "cpu": { "usage": 25.5 },
    "memory": { "usage": 68.2 },
    "application": {
      "responseTime": 150,
      "requestsPerMinute": 45,
      "errorRate": 0.02
    }
  }
}
```

### 系统版本信息

```http
GET /api/system/version
```

**响应：**
```json
{
  "success": true,
  "data": {
    "version": "1.0.0",
    "buildTime": "2025-07-12T00:00:00.000Z",
    "gitCommit": "abc123",
    "nodeVersion": "20.11.0",
    "environment": "production"
  }
}
```

## 服务状态

### 邮件服务状态

```http
GET /api/system/email-status
Authorization: Bearer <admin-token>
```

**响应：**
```json
{
  "success": true,
  "data": {
    "smtp": {
      "connected": true,
      "host": "smtp.gmail.com",
      "port": 587
    },
    "imap": {
      "connected": true,
      "host": "imap.gmail.com",
      "port": 993
    },
    "stats": {
      "sentToday": 42,
      "receivedToday": 15,
      "queueLength": 2
    }
  }
}
```

### AI 服务状态

```http
GET /api/system/ai-status
Authorization: Bearer <admin-token>
```

**响应：**
```json
{
  "success": true,
  "data": {
    "provider": "openai",
    "model": "gpt-3.5-turbo",
    "status": "active",
    "requestsToday": 128,
    "averageResponseTime": 1200,
    "errorRate": 0.01
  }
}
```

## 常见错误

- `403 FORBIDDEN` - 需要管理员权限
- `503 SERVICE_UNAVAILABLE` - 服务不可用
- `500 SYSTEM_ERROR` - 系统内部错误

---

**文档版本**: v1.0.0