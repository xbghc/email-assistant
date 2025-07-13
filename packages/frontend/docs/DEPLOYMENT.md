# 部署指南

## 🚀 构建过程

### 生产构建

```bash
# 安装依赖
pnpm install

# 类型检查
pnpm typecheck

# 代码检查
pnpm lint

# 构建生产版本
pnpm build

# 本地预览构建
pnpm preview
```

### 构建输出

构建过程创建优化的生产包：

```
dist/
├── index.html          # 主 HTML 文件
├── assets/
│   ├── index-[hash].js  # 主 JavaScript 包
│   ├── index-[hash].css # 主 CSS 包
│   ├── vendor-[hash].js # 第三方依赖
│   └── [name]-[hash].js # 基于路由的分块
└── favicon.ico         # 网站图标
```

### 构建配置

```typescript
// vite.config.ts
export default defineConfig({
  build: {
    target: 'es2015',
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false, // 调试时设为 true
    minify: 'terser',
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
        manualChunks: {
          vendor: ['vue', 'vue-router'],
          ui: ['@headlessui/vue', '@heroicons/vue']
        }
      }
    }
  }
});
```

## 🌐 环境配置

### 环境变量

创建环境特定的配置文件：

```bash
# .env.production
VITE_API_BASE_URL=https://api.your-domain.com
VITE_APP_VERSION=1.0.0
VITE_ENABLE_ANALYTICS=true
VITE_SENTRY_DSN=your-sentry-dsn

# .env.staging
VITE_API_BASE_URL=https://staging-api.your-domain.com
VITE_APP_VERSION=1.0.0-staging
VITE_ENABLE_ANALYTICS=false

# .env.development
VITE_API_BASE_URL=http://localhost:3000
VITE_APP_VERSION=1.0.0-dev
VITE_ENABLE_ANALYTICS=false
VITE_DEBUG=true
```

### 运行时配置

```typescript
// src/config/environment.ts
interface Config {
  apiBaseUrl: string;
  appVersion: string;
  enableAnalytics: boolean;
  debug: boolean;
}

export const config: Config = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000',
  appVersion: import.meta.env.VITE_APP_VERSION || '1.0.0',
  enableAnalytics: import.meta.env.VITE_ENABLE_ANALYTICS === 'true',
  debug: import.meta.env.VITE_DEBUG === 'true'
};
```

## 📦 静态托管

### Nginx 配置

```nginx
# /etc/nginx/sites-available/frontend
server {
    listen 80;
    server_name your-domain.com;
    root /var/www/frontend/dist;
    index index.html;

    # 启用 gzip 压缩
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types
        text/plain
        text/css
        text/xml
        text/javascript
        application/javascript
        application/xml+rss
        application/json;

    # 安全头
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;

    # 缓存静态资源
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # 处理 SPA 路由
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API 代理
    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## ☁️ 云部署

### Vercel 部署

```json
// vercel.json
{
  "builds": [
    {
      "src": "package.json",
      "use": "@vercel/static-build",
      "config": {
        "distDir": "dist"
      }
    }
  ],
  "routes": [
    {
      "src": "/api/(.*)",
      "dest": "https://your-api-domain.com/api/$1"
    },
    {
      "handle": "filesystem"
    },
    {
      "src": "/(.*)",
      "dest": "/index.html"
    }
  ],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "X-Frame-Options",
          "value": "SAMEORIGIN"
        },
        {
          "key": "X-XSS-Protection",
          "value": "1; mode=block"
        }
      ]
    }
  ]
}
```

### Netlify 部署

```toml
# netlify.toml
[build]
  publish = "dist"
  command = "pnpm build"

[build.environment]
  NODE_VERSION = "18"

[[redirects]]
  from = "/api/*"
  to = "https://your-api-domain.com/api/:splat"
  status = 200

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200

[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "SAMEORIGIN"
    X-XSS-Protection = "1; mode=block"
    X-Content-Type-Options = "nosniff"

[[headers]]
  for = "/assets/*"
  [headers.values]
    Cache-Control = "max-age=31536000, immutable"
```

## 🐳 Docker 部署

### 多阶段 Dockerfile

```dockerfile
# Dockerfile
# 构建阶段
FROM node:18-alpine AS builder

WORKDIR /app

# 复制包文件
COPY package*.json ./
COPY pnpm-lock.yaml ./

# 安装 pnpm
RUN npm install -g pnpm

# 安装依赖
RUN pnpm install --frozen-lockfile

# 复制源代码
COPY . .

# 构建应用
RUN pnpm build

# 生产阶段
FROM nginx:alpine AS production

# 复制构建的应用
COPY --from=builder /app/dist /usr/share/nginx/html

# 复制 nginx 配置
COPY nginx.conf /etc/nginx/nginx.conf

# 添加健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost/ || exit 1

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

### Docker Compose

```yaml
# docker-compose.yml
version: '3.8'

services:
  frontend:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "80:80"
    environment:
      - VITE_API_BASE_URL=http://backend:3000
    depends_on:
      - backend
    networks:
      - app-network

  backend:
    image: email-assistant-backend:latest
    ports:
      - "3000:3000"
    networks:
      - app-network

networks:
  app-network:
    driver: bridge
```

## 🔄 CI/CD 流水线

### GitHub Actions

```yaml
# .github/workflows/deploy.yml
name: 部署前端

on:
  push:
    branches: [main]
    paths: ['packages/frontend/**']

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest

    steps:
      - name: 检出代码
        uses: actions/checkout@v3

      - name: 设置 Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'pnpm'

      - name: 安装 pnpm
        run: npm install -g pnpm

      - name: 安装依赖
        run: pnpm install --frozen-lockfile

      - name: 类型检查
        run: pnpm typecheck

      - name: 代码检查
        run: pnpm lint

      - name: 测试
        run: pnpm test

      - name: 构建
        run: pnpm build
        env:
          VITE_API_BASE_URL: ${{ secrets.API_BASE_URL }}
          VITE_APP_VERSION: ${{ github.sha }}

      - name: 部署到 S3
        uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1

      - name: 同步到 S3
        run: aws s3 sync dist/ s3://${{ secrets.S3_BUCKET }} --delete

      - name: 刷新 CloudFront
        run: aws cloudfront create-invalidation --distribution-id ${{ secrets.CLOUDFRONT_DISTRIBUTION_ID }} --paths "/*"
```

## 📊 性能优化

### Bundle 分析

```bash
# 分析 bundle 大小
pnpm build --analyze

# 检查 bundle 组成
npx vite-bundle-analyzer dist/
```

### Lighthouse 优化

优化 Lighthouse 评分：

1. **性能**
   - 代码分割
   - 懒加载
   - 图片优化
   - 关键 CSS 内联

2. **可访问性**
   - 语义化 HTML
   - ARIA 标签
   - 颜色对比
   - 键盘导航

3. **最佳实践**
   - HTTPS
   - 现代图片格式
   - 高效缓存策略
   - 无控制台错误

4. **SEO**
   - Meta 标签
   - 结构化数据
   - 移动友好
   - 快速加载

## 🔒 安全

### 内容安全策略

```html
<!-- index.html -->
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self';
  script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net;
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
  font-src 'self' https://fonts.gstatic.com;
  img-src 'self' data: https:;
  connect-src 'self' https://api.your-domain.com;
">
```

### 环境变量安全

```bash
# 永远不要提交这些到版本控制
VITE_API_KEY=secret-key
VITE_ANALYTICS_ID=analytics-id

# 在 CI/CD 中使用密钥管理敏感数据
```

## 📈 监控

### 错误跟踪

```typescript
// utils/monitoring.ts
import * as Sentry from '@sentry/vue';

export function setupMonitoring(app: App) {
  if (config.enableSentry) {
    Sentry.init({
      app,
      dsn: config.sentryDsn,
      environment: config.environment,
      release: config.appVersion,
      beforeSend(event) {
        // 在开发环境中过滤错误
        if (config.debug) {
          console.log('Sentry 事件:', event);
          return null; // 不发送到开发环境
        }
        return event;
      }
    });
  }
}
```

### 分析

```typescript
// utils/analytics.ts
export function setupAnalytics() {
  if (config.enableAnalytics) {
    // Google Analytics
    gtag('config', config.analyticsId, {
      page_title: document.title,
      page_location: window.location.href
    });

    // 跟踪路由变化
    router.afterEach((to) => {
      gtag('config', config.analyticsId, {
        page_title: to.meta.title || to.name,
        page_location: window.location.href
      });
    });
  }
}
```

## 🚨 故障排除

### 常见构建问题

1. **内存问题**
   ```bash
   # 增加 Node.js 内存限制
   NODE_OPTIONS="--max-old-space-size=4096" pnpm build
   ```

2. **类型错误**
   ```bash
   # 检查 TypeScript 错误
   pnpm typecheck
   ```

3. **Bundle 大小问题**
   ```bash
   # 分析 bundle
   pnpm build --analyze
   ```

4. **依赖问题**
   ```bash
   # 清除缓存并重新安装
   rm -rf node_modules pnpm-lock.yaml
   pnpm install
   ```

### 部署问题

1. **404 错误**: 确保 SPA 路由已配置
2. **API 错误**: 检查 CORS 和代理配置
3. **资源加载**: 验证基础 URL 和公共路径
4. **缓存问题**: 实施适当的缓存失效策略