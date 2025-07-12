# 📦 共享类型包

## 概述

`@email-assistant/shared` 包含前后端共享的 TypeScript 类型定义、接口和常量。

## 主要内容

### 类型定义
- **User** - 用户数据模型
- **EmailRecord** - 邮件记录模型
- **ScheduleConfig** - 日程配置模型
- **ApiResponse** - API 响应格式
- **SystemHealth** - 系统健康状态

### 常量定义
- **API_ENDPOINTS** - API 端点常量
- **USER_ROLES** - 用户角色常量

## 使用方式

### 在后端使用
```typescript
import { User, ApiResponse } from '@email-assistant/shared';

const user: User = {
  id: 'user-123',
  username: '用户名',
  email: 'user@example.com',
  // ...
};
```

### 在前端使用
```typescript
import { API_ENDPOINTS, SystemHealth } from '@email-assistant/shared';

const response = await fetch(API_ENDPOINTS.AUTH.LOGIN);
```

## 📖 相关文档

### API 文档
完整的 API 接口文档请查看：
- [API 概览](../backend/docs/api/overview.md)
- [认证 API](../backend/docs/api/authentication.md)
- [用户管理 API](../backend/docs/api/users.md)
- [日程管理 API](../backend/docs/api/schedule.md)
- [系统监控 API](../backend/docs/api/system.md)

### 开发文档
- [后端开发文档](../backend/docs/README.md)
- [系统架构说明](../backend/docs/ARCHITECTURE.md)
- [开发环境搭建](../backend/docs/DEVELOPMENT.md)

---

**包版本**: v1.0.0  
**最后更新**: 2025-07-12