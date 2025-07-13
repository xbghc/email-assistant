# 🔐 认证 API

## 概述

Email Assistant 使用 JWT (JSON Web Token) 进行身份认证。用户需要先登录获取 token，然后在后续请求中携带该 token。

## 认证流程

1. **登录** - 使用邮箱和密码获取 JWT token
2. **携带 Token** - 在请求头中添加 `Authorization: Bearer <token>`
3. **Token 验证** - 服务器验证 token 的有效性
4. **登出** - 使 token 失效（可选）

## API 端点

### 用户登录

获取访问令牌

```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

**请求参数：**
| 参数 | 类型 | 必需 | 描述 |
|------|------|------|------|
| email | string | 是 | 用户邮箱地址 |
| password | string | 是 | 用户密码 |

**成功响应：**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user-123",
      "username": "张三",
      "email": "user@example.com",
      "role": "User"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c"
  }
}
```

**错误响应：**
```json
{
  "success": false,
  "error": "Invalid email or password",
  "code": "INVALID_CREDENTIALS"
}
```

**可能的错误：**
- `400 BAD_REQUEST` - 邮箱或密码格式错误
- `401 UNAUTHORIZED` - 邮箱或密码不正确
- `429 RATE_LIMIT` - 登录尝试次数过多

### 用户登出

使当前令牌失效

```http
POST /api/auth/logout
Authorization: Bearer <token>
```

**成功响应：**
```json
{
  "success": true,
  "data": {
    "message": "Successfully logged out"
  }
}
```

**错误响应：**
```json
{
  "success": false,
  "error": "Invalid token",
  "code": "INVALID_TOKEN"
}
```

### 验证令牌

验证当前令牌是否有效

```http
GET /api/auth/verify
Authorization: Bearer <token>
```

**成功响应：**
```json
{
  "success": true,
  "data": {
    "valid": true,
    "user": {
      "id": "user-123",
      "email": "user@example.com",
      "role": "User"
    },
    "expiresAt": "2025-07-19T08:00:00.000Z"
  }
}
```

**错误响应：**
```json
{
  "success": false,
  "error": "Token has expired",
  "code": "TOKEN_EXPIRED"
}
```

## Token 使用

### 在请求头中添加 Token

```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Token 属性

- **有效期**: 7 天（默认）
- **算法**: HS256
- **包含信息**: 用户 ID、邮箱、角色、过期时间

## 权限级别

### User（普通用户）
- 管理自己的日程和偏好设置
- 提交工作报告
- 查看自己的数据

### Admin（管理员）
- 拥有普通用户的所有权限
- 管理其他用户
- 访问系统监控数据
- 使用测试端点

## 使用示例

### JavaScript/Node.js

```javascript
// 登录
async function login(email, password) {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ email, password })
  });
  
  const result = await response.json();
  if (result.success) {
    // 保存 token
    localStorage.setItem('token', result.data.token);
    return result.data;
  } else {
    throw new Error(result.error);
  }
}

// 使用 token 发送请求
async function makeAuthenticatedRequest(url, options = {}) {
  const token = localStorage.getItem('token');
  
  return fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      'Authorization': `Bearer ${token}`
    }
  });
}

// 登出
async function logout() {
  const response = await makeAuthenticatedRequest('/api/auth/logout', {
    method: 'POST'
  });
  
  if (response.ok) {
    localStorage.removeItem('token');
  }
}
```

### Python

```python
import requests

class EmailAssistantClient:
    def __init__(self, base_url):
        self.base_url = base_url
        self.token = None
    
    def login(self, email, password):
        response = requests.post(
            f"{self.base_url}/api/auth/login",
            json={"email": email, "password": password}
        )
        
        if response.ok:
            data = response.json()
            self.token = data["data"]["token"]
            return data["data"]
        else:
            raise Exception(response.json()["error"])
    
    def _get_headers(self):
        if not self.token:
            raise Exception("Not authenticated")
        return {"Authorization": f"Bearer {self.token}"}
    
    def logout(self):
        response = requests.post(
            f"{self.base_url}/api/auth/logout",
            headers=self._get_headers()
        )
        
        if response.ok:
            self.token = None
        return response.json()
```

### cURL

```bash
# 登录
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password123"}'

# 保存响应中的 token，然后在后续请求中使用
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# 验证 token
curl -X GET http://localhost:3000/api/auth/verify \
  -H "Authorization: Bearer $TOKEN"

# 登出
curl -X POST http://localhost:3000/api/auth/logout \
  -H "Authorization: Bearer $TOKEN"
```

## 安全最佳实践

### Token 存储
- **浏览器**: 使用 `localStorage` 或 `sessionStorage`
- **移动应用**: 使用安全的密钥存储
- **服务器**: 使用环境变量或密钥管理服务

### Token 管理
- 定期检查 token 是否过期
- 实现自动刷新机制（如果支持）
- 在用户登出时清除 token

### 安全注意事项
- 始终使用 HTTPS（生产环境）
- 不要在 URL 或日志中暴露 token
- 实现合理的重试机制
- 监控异常的认证活动

## 错误处理

### 常见错误场景

1. **Token 过期**
   ```json
   {
     "success": false,
     "error": "Token has expired",
     "code": "TOKEN_EXPIRED"
   }
   ```
   **解决方案**: 重新登录获取新 token

2. **Token 格式错误**
   ```json
   {
     "success": false,
     "error": "Invalid token format",
     "code": "INVALID_TOKEN_FORMAT"
   }
   ```
   **解决方案**: 检查 Authorization 头格式

3. **权限不足**
   ```json
   {
     "success": false,
     "error": "Insufficient permissions",
     "code": "FORBIDDEN"
   }
   ```
   **解决方案**: 使用具有相应权限的账户

4. **频率限制**
   ```json
   {
     "success": false,
     "error": "Too many login attempts",
     "code": "RATE_LIMIT"
   }
   ```
   **解决方案**: 等待一段时间后重试

---

**文档版本**: v1.0.0  
**最后更新**: 2025-07-12