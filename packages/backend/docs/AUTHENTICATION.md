# 🔐 认证指南

## 概述

Email Assistant 使用 JWT (JSON Web Token) 进行身份认证和授权管理。本文档详细说明认证机制的实现和最佳实践。

## 认证架构

### JWT Token 结构
- **算法**: HS256
- **有效期**: 7 天（默认）
- **载荷信息**: 用户 ID、邮箱、角色、签发时间、过期时间

### 权限级别
- **User**: 普通用户，管理个人数据
- **Admin**: 管理员，拥有系统管理权限

## 认证流程

### 1. 用户登录
```
用户提交邮箱密码 → 服务器验证 → 生成 JWT → 返回给客户端
```

### 2. 请求认证
```
客户端发送请求 → 携带 JWT → 服务器验证 → 处理请求
```

### 3. Token 刷新
当前实现为静态过期，建议未来实现自动刷新机制。

## 实现细节

### 密码安全
- 使用 bcrypt 进行密码哈希
- 盐值轮数: 12
- 支持密码强度验证

### Token 验证中间件
位置: `src/middleware/authMiddleware.ts`

**功能**:
- 验证 Authorization 头格式
- 验证 JWT 签名和过期时间
- 提取用户信息到 `req.user`
- 角色权限检查

### 环境变量配置
```env
JWT_SECRET=your-secret-key-at-least-32-characters
JWT_EXPIRES_IN=7d
```

**安全要求**:
- JWT_SECRET 必须至少 32 个字符
- 生产环境使用强随机密钥
- 定期轮换密钥

## 角色权限

### User (普通用户)
- 查看和修改自己的信息
- 管理个人日程和偏好
- 提交工作报告
- 查看个人统计数据

### Admin (管理员)
- 拥有普通用户的所有权限
- 管理所有用户账户
- 访问系统监控和统计
- 使用测试功能
- 查看系统日志

## 安全最佳实践

### 服务器端
1. **密钥管理**
   - 使用环境变量存储密钥
   - 定期轮换 JWT 密钥
   - 生产环境使用密钥管理服务

2. **Token 验证**
   - 验证 Token 格式和签名
   - 检查过期时间
   - 记录认证失败日志

3. **密码策略**
   - 最少 8 个字符
   - 账户锁定机制（建议）
   - 密码历史记录（建议）

### 客户端
1. **Token 存储**
   - 浏览器: localStorage 或 sessionStorage
   - 移动应用: 安全密钥存储
   - 避免存储在 Cookie 中（当前实现）

2. **请求处理**
   - 所有 API 请求携带 Authorization 头
   - 处理 401 错误自动跳转登录
   - 实现 Token 过期检测

## 错误处理

### 常见认证错误
- `401 UNAUTHORIZED` - Token 无效或过期
- `403 FORBIDDEN` - 权限不足
- `400 BAD_REQUEST` - 请求格式错误

### 错误响应示例
```json
{
  "success": false,
  "error": "Token has expired",
  "code": "TOKEN_EXPIRED"
}
```

## 开发调试

### 测试用户创建
使用管理员脚本创建测试账户:
```bash
node scripts/create-admin.js admin@example.com password123
```

### Token 调试
可以使用 [jwt.io](https://jwt.io) 解析和验证 JWT Token。

### 本地开发
开发环境可以使用较短的过期时间便于测试:
```env
JWT_EXPIRES_IN=1h
```

## 未来改进

### 计划功能
- [ ] Token 自动刷新机制
- [ ] 记住我功能
- [ ] 多设备登录管理
- [ ] OAuth 第三方登录
- [ ] 二次认证 (2FA)

### 安全增强
- [ ] 账户锁定机制
- [ ] 登录异常检测
- [ ] IP 白名单
- [ ] 密码复杂度策略

---

**文档版本**: v1.0.0  
**最后更新**: 2025-07-12