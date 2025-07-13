# 邮件助手前端

基于 Vue 3、TypeScript、Vite 的现代化邮件助手系统前端应用，支持响应式设计。

## 🚀 快速开始

```bash
# 安装依赖
pnpm install

# 启动开发服务器
pnpm dev

# 构建生产版本
pnpm build
```

## 📋 可用脚本

| 命令 | 描述 |
|---------|-------------|
| `pnpm dev` | 启动开发服务器（支持热重载） |
| `pnpm build` | 构建生产版本 |
| `pnpm preview` | 本地预览生产构建 |
| `pnpm typecheck` | 运行 TypeScript 类型检查 |
| `pnpm lint` | 运行 ESLint 代码检查 |
| `pnpm lint:fix` | 自动修复 ESLint 问题 |
| `pnpm clean` | 清理构建产物 |

## 🏗️ 技术栈

- **框架**: Vue 3 + Composition API
- **语言**: TypeScript
- **构建工具**: Vite 7.x
- **路由**: Vue Router 4
- **样式**: SCSS + CSS 自定义属性
- **图标**: Feather Icons
- **状态管理**: Composables 模式
- **API**: RESTful API + 类型安全

## 📚 文档

- [架构设计](./docs/ARCHITECTURE.md) - 系统架构和设计模式
- [组件库](./docs/COMPONENTS.md) - 组件库和使用指南
- [API集成](./docs/API.md) - API客户端和集成模式
- [开发指南](./docs/DEVELOPMENT.md) - 开发规范和最佳实践
- [部署指南](./docs/DEPLOYMENT.md) - 构建和部署说明

## 🔧 配置

### 开发服务器
- 端口: 3001
- API 代理: http://localhost:3000
- 热模块替换已启用

### 路径别名
- `@/` → `src/`
- `@shared/` → `../shared/src/`

## 🌐 环境变量

```bash
# .env.local
VITE_API_BASE_URL=http://localhost:3000
VITE_APP_VERSION=1.0.0
```

## 🧪 开发工作流

1. **安装**: `pnpm install`
2. **开发**: `pnpm dev`
3. **类型检查**: `pnpm typecheck`
4. **代码检查**: `pnpm lint`
5. **构建**: `pnpm build`

## 📞 技术支持

如有问题和支持需求：
- 查阅 [开发指南](./docs/DEVELOPMENT.md)
- 查看 [组件文档](./docs/COMPONENTS.md)
- 参考 [API集成指南](./docs/API.md)