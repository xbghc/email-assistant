# 👨‍💻 开发指南

## 概述

本文档提供 Email Assistant 本地开发环境的搭建和开发流程指导。

## 环境要求

### 必需软件
- **Node.js**: 20.11.0+
- **PNPM**: 8.0+
- **Git**: 2.30+

### 推荐工具
- **VS Code**: 配合 TypeScript 扩展
- **Postman**: API 测试
- **MongoDB Compass**: 数据查看 (未来)

## 快速开始

### 1. 克隆项目
```bash
git clone <repository-url>
cd email-assistant
```

### 2. 安装依赖
```bash
pnpm install
```

### 3. 环境配置
```bash
# 复制环境配置模板
cp .env.example .env

# 编辑配置文件
vim .env
```

### 4. 启动开发服务器
```bash
# 启动前后端开发服务器
pnpm dev

# 或分别启动
pnpm dev:backend    # 后端开发服务器
pnpm dev:frontend   # 前端开发服务器
```

## 开发环境配置

### 环境变量配置
开发环境的 `.env` 配置示例：

```env
# 开发环境配置
NODE_ENV=development
PORT=3000
HOST=localhost

# JWT 配置 (开发用)
JWT_SECRET=development-secret-key-change-in-production
JWT_EXPIRES_IN=24h

# 邮件配置 (使用测试邮箱)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=test@gmail.com
SMTP_PASS=test-app-password

IMAP_HOST=imap.gmail.com
IMAP_PORT=993
IMAP_USER=test@gmail.com
IMAP_PASS=test-app-password
IMAP_TLS=true

# 用户配置
USER_EMAIL=developer@example.com
USER_NAME=Developer

# AI 配置 (开发用较便宜的模型)
AI_PROVIDER=openai
OPENAI_API_KEY=your-development-api-key
OPENAI_MODEL=gpt-3.5-turbo

# 开发配置
EMAIL_CHECK_INTERVAL_MS=60000  # 更长的检查间隔
MORNING_REMINDER_TIME=09:00
EVENING_REMINDER_TIME=18:00
```

### 创建管理员账户
```bash
cd packages/backend
node scripts/create-admin.js admin@example.com password123
```

## 开发流程

### 代码规范

#### TypeScript 配置
项目使用 ESNext 模块和 ES2022 语言特性：
```json
{
  "target": "ES2022",
  "module": "ESNext",
  "moduleResolution": "bundler"
}
```

#### ESLint 规则
```bash
# 运行代码检查
pnpm lint

# 自动修复问题
pnpm lint:fix
```

#### 代码提交规范
建议使用语义化提交信息：
```bash
git commit -m "feat: 添加用户偏好设置功能"
git commit -m "fix: 修复邮件发送失败问题"
git commit -m "docs: 更新 API 文档"
```

### 开发命令

#### 构建和类型检查
```bash
pnpm build              # 构建所有包
pnpm build:backend      # 仅构建后端
pnpm build:frontend     # 仅构建前端
pnpm build:shared       # 仅构建共享包

pnpm typecheck          # 类型检查
pnpm validate           # 运行所有检查 (类型+lint+测试)
```

#### 测试
```bash
pnpm test               # 运行所有测试
pnpm test:watch         # 监听模式运行测试
pnpm test:coverage      # 运行测试并生成覆盖率报告
```

#### 清理
```bash
pnpm clean              # 清理所有构建产物
```

## 项目结构

### 后端开发结构
```
packages/backend/
├── src/
│   ├── config/          # 配置管理
│   ├── middleware/      # Express 中间件
│   ├── models/          # 数据模型
│   ├── routes/          # 路由定义
│   ├── services/        # 业务逻辑服务
│   │   ├── admin/       # 管理员功能
│   │   ├── ai/          # AI 服务
│   │   ├── core/        # 核心服务
│   │   ├── email/       # 邮件服务
│   │   ├── reports/     # 报告服务
│   │   ├── system/      # 系统服务
│   │   └── user/        # 用户服务
│   └── utils/           # 工具函数
├── tests/               # 测试文件
└── scripts/             # 脚本文件
```

### 前端开发结构
```
packages/frontend/
├── src/
│   ├── components/      # 可复用组件
│   ├── views/           # 页面组件
│   ├── router/          # 路由配置
│   ├── utils/           # 工具函数
│   ├── types/           # 类型定义
│   └── assets/          # 静态资源
└── public/              # 公共资源
```

## 调试指南

### 后端调试

#### 日志查看
```bash
# 查看实时日志
tail -f packages/backend/logs/combined.log

# 查看错误日志
tail -f packages/backend/logs/error.log
```

#### 调试邮件配置
```bash
cd packages/backend
node debug-email-config.js
```

#### VS Code 调试配置
创建 `.vscode/launch.json`:
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug Backend",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/packages/backend/dist/index.js",
      "outFiles": ["${workspaceFolder}/packages/backend/dist/**/*.js"],
      "env": {
        "NODE_ENV": "development"
      },
      "console": "integratedTerminal",
      "restart": true,
      "runtimeArgs": ["--enable-source-maps"]
    }
  ]
}
```

### 前端调试

#### 开发服务器
```bash
# 启动开发服务器
cd packages/frontend
pnpm dev

# 访问 http://localhost:5173
```

#### Vue DevTools
安装 Vue DevTools 浏览器扩展进行组件调试。

### API 测试

#### 使用 cURL
```bash
# 健康检查
curl http://localhost:3000/health

# 用户登录
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"password123"}'
```

#### 使用内置测试
```bash
# 测试晨间提醒
curl -X POST http://localhost:3000/test/morning-reminder \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## 开发最佳实践

### 代码组织
1. **单一职责** - 每个服务只负责一个功能域
2. **依赖注入** - 使用构造函数注入依赖
3. **接口抽象** - 为主要服务定义接口
4. **错误处理** - 统一的错误处理机制

### 新功能开发

#### 添加新的 API 端点
1. 在 `routes/` 中定义路由
2. 在 `services/` 中实现业务逻辑
3. 添加相应的测试
4. 更新 API 文档

#### 添加新的服务
1. 创建服务类和接口
2. 在 `index.ts` 中初始化服务
3. 注入到需要的地方
4. 编写单元测试

### 测试开发
```bash
# 运行特定测试文件
pnpm test src/services/__tests__/userService.test.ts

# 运行测试并查看覆盖率
pnpm test:coverage
```

### 性能分析
```bash
# 启用性能监控
NODE_ENV=development node --inspect dist/index.js

# 使用 Chrome DevTools 进行性能分析
```

## 常见问题

### 依赖问题
```bash
# 清理依赖重新安装
rm -rf node_modules packages/*/node_modules
pnpm install
```

### 构建问题
```bash
# 清理构建缓存
pnpm clean
pnpm build
```

### 类型错误
```bash
# 运行类型检查查看详细错误
pnpm typecheck
```

### 邮件测试问题
```bash
# 检查邮件配置
node packages/backend/debug-email-config.js

# 查看邮件服务日志
grep "email" packages/backend/logs/combined.log
```

## Git 工作流

### 分支策略
- `main` - 主分支，生产代码
- `develop` - 开发分支
- `feature/*` - 功能分支
- `hotfix/*` - 热修复分支

### 提交前检查
```bash
# 运行完整验证
pnpm validate

# 确保所有测试通过
pnpm test

# 检查代码风格
pnpm lint
```

---

**文档版本**: v1.0.0  
**最后更新**: 2025-07-12