# 📖 API 概览

## 简介

Email Assistant 提供 RESTful API 接口，支持用户认证、日程管理、工作报告、系统监控等功能。所有 API 均返回 JSON 格式数据。

**基础 URL**: `http://localhost:3000` (开发环境)

## 📚 API 模块导航

- [认证 API](./authentication.md) - 用户登录、登出、令牌验证
- [用户管理 API](./users.md) - 用户信息、偏好设置
- [日程管理 API](./schedule.md) - 日程创建、查询、更新
- [工作报告 API](./reports.md) - 工作报告提交和 AI 分析
- [系统监控 API](./system.md) - 健康检查、性能指标
- [管理员 API](./admin.md) - 用户管理、系统管理
- [测试 API](./testing.md) - 功能测试端点

## 📝 通用响应格式

### 成功响应
```json
{
  "success": true,
  "data": {
    // 响应数据
  }
}
```

### 错误响应
```json
{
  "success": false,
  "error": "错误描述信息",
  "code": "ERROR_CODE"
}
```

## 🔐 认证机制

Email Assistant 使用 JWT (JSON Web Token) 进行身份认证：

1. 通过 `/api/auth/login` 获取 token
2. 在后续请求头中添加：`Authorization: Bearer <token>`
3. Token 默认有效期为 7 天

详细信息请查看 [认证 API 文档](./authentication.md)。

## 📋 请求限制

### 速率限制
- **一般用户：** 每分钟 60 次请求
- **管理员：** 每分钟 120 次请求
- **测试端点：** 每分钟 10 次请求

### 请求大小限制
- **请求体大小：** 最大 10MB
- **文件上传：** 暂不支持

## 🌐 CORS 配置

### 开发环境
允许所有来源的跨域请求

### 生产环境
只允许配置的域名进行跨域请求，通过环境变量 `CORS_ORIGINS` 配置

## 📝 错误码参考

| HTTP 状态码 | 错误码 | 描述 |
|------------|-------|------|
| 400 | BAD_REQUEST | 请求参数错误 |
| 401 | UNAUTHORIZED | 未授权，需要登录 |
| 403 | FORBIDDEN | 权限不足 |
| 404 | NOT_FOUND | 资源不存在 |
| 429 | RATE_LIMIT | 请求频率限制 |
| 500 | INTERNAL_ERROR | 服务器内部错误 |

## 🛡️ 安全最佳实践

### Token 管理
- Token 默认有效期 7 天
- 定期轮换 Token
- 安全存储 Token

### API 安全
- 使用 HTTPS（生产环境）
- 输入验证和过滤
- SQL 注入防护
- XSS 防护

### 数据保护
- 敏感数据加密存储
- 访问日志记录
- 定期安全审计

## 📖 快速开始示例

### JavaScript/Node.js
```javascript
// 1. 登录获取 token
const loginResponse = await fetch('/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'password123'
  })
});

const { data } = await loginResponse.json();
const token = data.token;

// 2. 使用 token 调用 API
const userResponse = await fetch('/api/users/me', {
  headers: { 'Authorization': `Bearer ${token}` }
});

const userData = await userResponse.json();
```

### cURL
```bash
# 1. 登录
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password123"}'

# 2. 使用 token
curl -X GET http://localhost:3000/api/users/me \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Python
```python
import requests

# 1. 登录
response = requests.post(
    "http://localhost:3000/api/auth/login",
    json={"email": "user@example.com", "password": "password123"}
)
token = response.json()["data"]["token"]

# 2. 使用 token
headers = {"Authorization": f"Bearer {token}"}
user_response = requests.get(
    "http://localhost:3000/api/users/me",
    headers=headers
)
```

## 🔄 Webhook 集成

### 邮件 Webhook
当收到邮件时，系统会自动处理：
- 解析邮件内容
- 识别发送者
- 执行相应的 AI 处理
- 发送回复邮件

### 系统事件
系统会在以下事件时发送通知：
- 系统启动/停止
- 用户登录/登出
- 错误报告
- 性能警告

---

**文档版本**: v1.0.0  
**最后更新**: 2025-07-12