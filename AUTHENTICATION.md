# 🔐 邮件助手 - 身份认证系统

邮件助手管理界面现在需要身份认证才能访问。本文档说明如何设置和使用认证系统。

## 🚀 快速开始

### 1. 创建管理员账户

首次使用时，需要创建一个管理员账户：

```bash
node scripts/create-admin.js admin@example.com your_password_here
```

**示例：**
```bash
node scripts/create-admin.js admin@company.com admin123456
```

### 2. 登录管理界面

1. 启动邮件助手服务：
   ```bash
   npm start
   ```

2. 访问登录页面：
   ```
   http://localhost:3000/login
   ```

3. 使用创建的管理员账户登录

4. 登录成功后会自动跳转到管理界面

## 🔧 认证机制

### JWT Token 认证

- 使用 JWT (JSON Web Token) 进行身份认证
- Token 有效期：24小时
- Token 存储在浏览器的 localStorage 中
- 自动处理 Token 过期和刷新

### 权限控制

- **管理员权限**：访问所有功能
- **用户权限**：仅访问个人相关功能（暂未实现）

### 安全特性

- 密码使用 bcrypt 加密（12轮盐值）
- JWT Token 包含过期时间
- 自动检测无效或过期的 Token
- 防止未授权访问

## 🔄 认证流程

### 登录流程

1. 用户在登录页面输入邮箱和密码
2. 前端发送 POST 请求到 `/api/auth/login`
3. 后端验证凭据并生成 JWT Token
4. 前端存储 Token 并重定向到管理界面

### 认证检查

1. 每个需要认证的请求都会检查 Authorization 头
2. 如果 Token 无效或过期，返回 401 状态码
3. 前端自动重定向到登录页面

### 登出流程

1. 用户点击登出按钮
2. 前端清除存储的 Token
3. 重定向到登录页面

## 🛠️ 开发指南

### API 端点

#### 认证相关 API

- `POST /api/auth/login` - 用户登录
- `GET /api/auth/validate-token` - 验证 Token 有效性
- `POST /api/auth/logout` - 用户登出
- `GET /api/auth/me` - 获取当前用户信息

#### 受保护的页面

- `GET /` - 管理界面主页（需要管理员权限）
- `GET /login` - 登录页面（无需认证）

### 前端认证

#### 自动认证检查

```javascript
// 检查认证状态
function checkAuth() {
    const token = localStorage.getItem('authToken');
    if (!token) {
        redirectToLogin();
        return false;
    }
    return true;
}
```

#### API 请求带认证

```javascript
// 自动添加认证头的请求函数
async function apiRequest(url, options = {}) {
    const token = localStorage.getItem('authToken');
    
    const config = {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            ...options.headers
        }
    };
    
    const response = await fetch(url, config);
    
    // 处理未授权响应
    if (response.status === 401) {
        logout();
        return null;
    }
    
    return response;
}
```

### 后端认证中间件

#### 认证中间件

```typescript
// 验证 JWT Token
authenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        // HTML 页面重定向到登录页
        if (req.accepts('html') && !req.xhr && !req.path.startsWith('/api/')) {
            res.redirect('/login');
            return;
        }
        
        // API 请求返回 JSON 错误
        res.status(401).json({
            success: false,
            error: 'No token provided'
        });
        return;
    }
    
    const token = authHeader.substring(7);
    const payload = this.authService.verifyToken(token);
    
    if (!payload) {
        // 处理无效 Token...
    }
    
    req.user = payload;
    next();
}
```

## 🔧 配置选项

### JWT 配置

在 `.env` 文件中配置：

```env
# JWT 密钥（请使用强密钥）
JWT_SECRET=your-very-strong-secret-key-here

# JWT 过期时间
JWT_EXPIRES_IN=24h

# 密码加密强度
BCRYPT_SALT_ROUNDS=12
```

### 推荐配置

- **JWT_SECRET**: 至少 32 字符的随机字符串
- **JWT_EXPIRES_IN**: 建议 24h 或更短
- **BCRYPT_SALT_ROUNDS**: 建议 12 轮（安全性与性能的平衡）

## 🚨 安全注意事项

### 1. JWT 密钥安全

- 使用强随机密钥
- 定期轮换密钥
- 不要将密钥提交到版本控制

### 2. 密码策略

- 强制最小密码长度（建议 8 位以上）
- 建议包含大小写字母、数字和特殊字符
- 定期提醒用户更改密码

### 3. Token 管理

- 设置合理的过期时间
- 在用户登出时清除 Token
- 检测异常登录行为

### 4. HTTPS 使用

在生产环境中务必使用 HTTPS：

```javascript
// 仅在 HTTPS 下设置 secure cookies
if (process.env.NODE_ENV === 'production') {
    app.use(helmet({
        hsts: {
            maxAge: 31536000,
            includeSubDomains: true,
            preload: true
        }
    }));
}
```

## 🐛 故障排除

### 常见问题

#### 1. 登录失败

**症状**: 正确的凭据无法登录

**解决方案**:
- 检查用户是否已创建：`cat users.json`
- 验证邮箱格式是否正确
- 确认密码是否匹配

#### 2. Token 过期

**症状**: 登录后很快被要求重新登录

**解决方案**:
- 检查 JWT_EXPIRES_IN 配置
- 验证系统时间是否正确
- 检查 JWT_SECRET 是否配置正确

#### 3. 重定向循环

**症状**: 登录后不断重定向

**解决方案**:
- 检查前端的认证检查逻辑
- 验证 Token 是否正确存储在 localStorage
- 检查后端的认证中间件配置

### 日志调试

启用详细日志：

```bash
DEBUG=auth:* npm start
```

### 重置认证

如果需要重置所有认证数据：

```bash
# 删除用户文件
rm users.json

# 重新创建管理员账户
node scripts/create-admin.js admin@example.com newpassword
```

## 📝 更新日志

### v1.0.0
- ✅ 实现 JWT 认证系统
- ✅ 添加登录页面
- ✅ 保护管理界面
- ✅ 自动认证检查
- ✅ 安全的密码加密
- ✅ Token 过期处理

---

如有问题，请查看日志或联系技术支持。