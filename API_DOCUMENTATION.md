# Email Assistant API 文档

## 概览

Email Assistant 是一个智能邮件助手应用程序，提供定时提醒、工作报告处理和AI驱动的邮件管理功能。

**基础URL**: `http://localhost:3000`  
**API版本**: v1.0.0  
**认证方式**: JWT Bearer Token

## 认证

大部分API端点需要JWT令牌认证。在请求头中包含：

```
Authorization: Bearer <your-jwt-token>
```

### 获取访问令牌

```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "admin@example.com",
  "password": "your-password"
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "user-123",
      "email": "admin@example.com",
      "role": "admin"
    }
  }
}
```

## API 端点

### 健康检查

检查应用程序健康状态。

```http
GET /health
```

**响应**:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "version": "1.0.0",
  "uptime": 3600,
  "services": {
    "database": "healthy",
    "email": "healthy",
    "ai": "healthy"
  }
}
```

### 用户管理

#### 获取当前用户信息

```http
GET /api/users/me
Authorization: Bearer <token>
```

**响应**:
```json
{
  "success": true,
  "data": {
    "id": "user-123",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "user",
    "config": {
      "schedule": {
        "morningReminderTime": "08:00",
        "eveningReminderTime": "20:00",
        "timezone": "Asia/Shanghai"
      },
      "language": "zh"
    },
    "isActive": true,
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

#### 更新用户配置

```http
PUT /api/users/me/config
Authorization: Bearer <token>
Content-Type: application/json

{
  "schedule": {
    "morningReminderTime": "09:00",
    "eveningReminderTime": "19:00"
  },
  "language": "en"
}
```

#### 获取所有用户 (仅管理员)

```http
GET /api/users
Authorization: Bearer <admin-token>
```

### 日程管理

#### 获取今日日程

```http
GET /api/schedule/today
Authorization: Bearer <token>
```

**响应**:
```json
{
  "success": true,
  "data": {
    "date": "2024-01-15",
    "events": [
      {
        "id": "event-1",
        "time": "09:00",
        "title": "团队会议",
        "description": "周例会讨论项目进展",
        "location": "会议室A",
        "priority": "high"
      },
      {
        "id": "event-2", 
        "time": "14:00",
        "title": "客户拜访",
        "description": "与客户讨论需求",
        "priority": "medium"
      }
    ]
  }
}
```

#### 获取指定日期日程

```http
GET /api/schedule/{date}
Authorization: Bearer <token>
```

**路径参数**:
- `date`: 日期，格式为 YYYY-MM-DD

#### 创建/更新日程

```http
POST /api/schedule
Authorization: Bearer <token>
Content-Type: application/json

{
  "date": "2024-01-16",
  "events": [
    {
      "time": "10:00",
      "title": "产品评审",
      "description": "评审新功能设计",
      "location": "会议室B",
      "priority": "high"
    }
  ]
}
```

#### 获取未来N天日程

```http
GET /api/schedule/upcoming/{days}
Authorization: Bearer <token>
```

**路径参数**:
- `days`: 天数，数字类型

### 工作报告

#### 提交工作报告

```http
POST /api/work-report
Authorization: Bearer <token>
Content-Type: application/json

{
  "report": "今天完成了用户认证模块的开发，解决了3个bug，明天计划开始API文档编写。",
  "date": "2024-01-15",
  "mood": "good",
  "productivity": 8
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "reportId": "report-123",
    "aiSummary": "用户今日工作效率较高，完成了认证模块开发并修复了多个问题，建议继续保持这个节奏。",
    "suggestions": [
      "继续保持高效的工作节奏",
      "注意代码质量和测试覆盖",
      "可以考虑提前规划明天的优先任务"
    ],
    "timestamp": "2024-01-15T18:00:00.000Z"
  }
}
```

### 测试端点

#### 测试晨间提醒

```http
POST /api/test/morning-reminder
Authorization: Bearer <token>
```

#### 测试晚间提醒

```http
POST /api/test/evening-reminder 
Authorization: Bearer <token>
```

### 系统管理

#### 获取系统状态 (仅管理员)

```http
GET /api/admin/status
Authorization: Bearer <admin-token>
```

**响应**:
```json
{
  "success": true,
  "data": {
    "system": {
      "uptime": 86400,
      "memoryUsage": {
        "rss": 134217728,
        "heapTotal": 67108864,
        "heapUsed": 45654321,
        "external": 1234567
      },
      "cpuUsage": 15.6
    },
    "email": {
      "status": "healthy",
      "sentToday": 25,
      "queueLength": 0,
      "lastError": null
    },
    "ai": {
      "provider": "openai",
      "status": "healthy",
      "requestsToday": 45,
      "lastResponse": "2024-01-15T17:30:00.000Z"
    }
  }
}
```

#### 获取日志 (仅管理员)

```http
GET /api/admin/logs?level=error&limit=100&search=keyword&startDate=2024-01-01&endDate=2024-01-15
Authorization: Bearer <admin-token>
```

**查询参数**:
- `level`: 日志级别 (error, warn, info, debug, all)
- `limit`: 返回条数限制
- `search`: 搜索关键词
- `startDate`: 开始日期 (YYYY-MM-DD)
- `endDate`: 结束日期 (YYYY-MM-DD)

#### 导出日志 (仅管理员)

```http
GET /api/admin/logs/export?level=error&startDate=2024-01-01&endDate=2024-01-15
Authorization: Bearer <admin-token>
```

返回CSV格式的日志文件。

### 性能监控

#### 获取性能指标

```http
GET /api/metrics
Authorization: Bearer <token>
```

**响应**:
```json
{
  "success": true,
  "data": {
    "timestamp": "2024-01-15T18:00:00.000Z",
    "cpu": {
      "usage": 15.6,
      "loadAverage": [0.5, 0.8, 1.2]
    },
    "memory": {
      "total": 8589934592,
      "used": 4294967296,
      "free": 4294967296,
      "usage": 50.0
    },
    "application": {
      "uptime": 86400,
      "requestsPerMinute": 12,
      "responseTime": 145,
      "errorRate": 0.02
    }
  }
}
```

## 错误处理

API使用标准HTTP状态码，所有错误响应遵循以下格式：

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "请求参数验证失败",
    "details": {
      "field": "email",
      "issue": "邮箱格式不正确"
    }
  },
  "timestamp": "2024-01-15T18:00:00.000Z"
}
```

### 常见错误码

| 状态码 | 错误码 | 描述 |
|--------|--------|------|
| 400 | VALIDATION_ERROR | 请求参数验证失败 |
| 401 | UNAUTHORIZED | 未授权访问 |
| 403 | FORBIDDEN | 访问被禁止 |
| 404 | NOT_FOUND | 资源不存在 |
| 429 | RATE_LIMIT_EXCEEDED | 请求频率超限 |
| 500 | INTERNAL_ERROR | 服务器内部错误 |
| 503 | SERVICE_UNAVAILABLE | 服务不可用 |

## 限制和配额

- **请求频率**: 每分钟最多100个请求
- **文件上传**: 最大10MB
- **请求超时**: 30秒
- **Token有效期**: 24小时

## 示例代码

### JavaScript/Node.js

```javascript
const axios = require('axios');

// 登录获取token
async function login(email, password) {
  const response = await axios.post('http://localhost:3000/api/auth/login', {
    email,
    password
  });
  return response.data.data.token;
}

// 获取今日日程
async function getTodaySchedule(token) {
  const response = await axios.get('http://localhost:3000/api/schedule/today', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  return response.data.data;
}

// 提交工作报告
async function submitWorkReport(token, report) {
  const response = await axios.post('http://localhost:3000/api/work-report', {
    report
  }, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  return response.data.data;
}
```

### Python

```python
import requests
import json

class EmailAssistantAPI:
    def __init__(self, base_url='http://localhost:3000'):
        self.base_url = base_url
        self.token = None
    
    def login(self, email, password):
        response = requests.post(f'{self.base_url}/api/auth/login', json={
            'email': email,
            'password': password
        })
        data = response.json()
        self.token = data['data']['token']
        return self.token
    
    def get_headers(self):
        return {
            'Authorization': f'Bearer {self.token}',
            'Content-Type': 'application/json'
        }
    
    def get_today_schedule(self):
        response = requests.get(
            f'{self.base_url}/api/schedule/today',
            headers=self.get_headers()
        )
        return response.json()['data']
    
    def submit_work_report(self, report):
        response = requests.post(
            f'{self.base_url}/api/work-report',
            json={'report': report},
            headers=self.get_headers()
        )
        return response.json()['data']

# 使用示例
api = EmailAssistantAPI()
api.login('admin@example.com', 'password')
schedule = api.get_today_schedule()
print(json.dumps(schedule, indent=2))
```

### cURL

```bash
# 登录
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"password"}'

# 获取今日日程 (需要替换 YOUR_TOKEN)
curl -X GET http://localhost:3000/api/schedule/today \
  -H "Authorization: Bearer YOUR_TOKEN"

# 提交工作报告
curl -X POST http://localhost:3000/api/work-report \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"report":"今天完成了API文档编写工作"}'
```

## 更新日志

### v1.0.0 (2024-01-15)
- 初始API版本发布
- 支持用户认证和授权
- 实现日程管理功能
- 添加工作报告提交
- 提供系统监控接口

## 支持

如需技术支持，请联系：
- 邮箱: support@email-assistant.com
- 文档: [项目README](./README.md)
- 问题反馈: [GitHub Issues](https://github.com/your-org/email-assistant/issues)