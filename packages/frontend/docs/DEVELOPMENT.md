# 开发指南

## 🚀 快速开始

### 前置要求

- **Node.js**: 18+ (推荐使用最新 LTS)
- **pnpm**: 8+ (包管理器)
- **Git**: 最新版本
- **VS Code**: 推荐编辑器

### 初始设置

```bash
# 克隆仓库
git clone <repository-url>
cd email-assistant

# 安装依赖（从项目根目录）
pnpm install

# 启动前端开发服务器
cd packages/frontend
pnpm dev
```

开发服务器将在 `http://localhost:3001` 启动，API 代理到 `http://localhost:3000`。

## 🛠️ 开发环境

### VS Code 设置

推荐的 VS Code 扩展：

```json
{
  "recommendations": [
    "vue.volar",
    "vue.vscode-typescript-vue-plugin",
    "esbenp.prettier-vscode",
    "dbaeumer.vscode-eslint"
  ]
}
```

### 设置

创建 `.vscode/settings.json`：

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.preferences.importModuleSpecifier": "relative",
  "vue.codeActions.enabled": true
}
```

### 环境变量

创建 `.env.local` 文件：

```bash
# API 配置
VITE_API_BASE_URL=http://localhost:3000
VITE_API_TIMEOUT=10000

# 开发
VITE_DEV_MODE=true
VITE_DEBUG=true

# 功能
VITE_ENABLE_WEBSOCKET=true
VITE_ENABLE_ANALYTICS=false
```

## 📁 项目结构

### 目录组织

```
src/
├── assets/          # 静态资源
├── components/      # 可复用组件
├── composables/     # Vue composables
├── pages/          # 页面特定组件
├── router/         # Vue Router 配置
├── types/          # TypeScript 定义
├── utils/          # 工具函数
├── views/          # 路由组件
└── main.ts         # 应用程序入口
```

### 文件命名约定

- **组件**: PascalCase (`UserForm.vue`, `NavBar.vue`)
- **视图**: PascalCase (`Dashboard.vue`, `UserSettings.vue`)
- **Composables**: camelCase，以 `use` 为前缀 (`useAuth.ts`, `useUsers.ts`)
- **工具**: camelCase (`formatDate.ts`, `apiClient.ts`)
- **类型**: PascalCase (`User.ts`, `ApiResponse.ts`)

## 🧩 组件开发

### 组件模板

新组件使用此模板：

```vue
<template>
  <div class="component-name">
    <!-- 组件内容 -->
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';

// 为开发工具定义组件名称
defineOptions({
  name: 'ComponentName'
});

// Props 接口
interface Props {
  title: string;
  count?: number;
  disabled?: boolean;
}

// 带默认值的 Props
const props = withDefaults(defineProps<Props>(), {
  count: 0,
  disabled: false
});

// Emits 接口
interface Emits {
  update: [value: string];
  close: [];
}

const emit = defineEmits<Emits>();

// 响应式状态
const isVisible = ref(false);
const internalValue = ref('');

// 计算属性
const computedValue = computed(() => {
  return `${props.title}: ${props.count}`;
});

// 方法
const handleClick = () => {
  emit('update', internalValue.value);
};

// 生命周期
onMounted(() => {
  console.log('组件已挂载');
});

// 暴露公共方法（如果需要）
defineExpose({
  focus: () => {
    // 公共方法实现
  }
});
</script>

<style scoped lang="scss">
.component-name {
  // 组件特定样式
  padding: 1rem;
  border-radius: var(--border-radius);
  
  &__element {
    // BEM 元素样式
  }
  
  &--modifier {
    // BEM 修饰符样式
  }
}
</style>
```

## 🎨 样式指南

### SCSS 架构

```scss
// assets/styles/main.scss
@import 'variables';
@import 'mixins';
@import 'base';
@import 'components';
@import 'utilities';

// assets/styles/_variables.scss
// 颜色
$primary-color: #3b82f6;
$secondary-color: #64748b;
$success-color: #10b981;
$warning-color: #f59e0b;
$error-color: #ef4444;

// 字体
$font-family-base: 'Inter', sans-serif;
$font-size-base: 14px;
$line-height-base: 1.5;

// 间距
$spacing-xs: 0.25rem;
$spacing-sm: 0.5rem;
$spacing-md: 1rem;
$spacing-lg: 1.5rem;
$spacing-xl: 2rem;

// 断点
$breakpoint-sm: 640px;
$breakpoint-md: 768px;
$breakpoint-lg: 1024px;
$breakpoint-xl: 1280px;
```

### CSS 自定义属性

使用 CSS 变量进行动态主题：

```scss
:root {
  // 颜色
  --color-primary: #{$primary-color};
  --color-secondary: #{$secondary-color};
  --color-background: #ffffff;
  --color-surface: #f8fafc;
  --color-text: #1e293b;
  --color-text-muted: #64748b;
  
  // 间距
  --spacing-xs: #{$spacing-xs};
  --spacing-sm: #{$spacing-sm};
  --spacing-md: #{$spacing-md};
  --spacing-lg: #{$spacing-lg};
  --spacing-xl: #{$spacing-xl};
  
  // 组件
  --border-radius: 8px;
  --box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  --transition: all 0.2s ease-in-out;
}

// 深色主题
[data-theme="dark"] {
  --color-background: #0f172a;
  --color-surface: #1e293b;
  --color-text: #f1f5f9;
  --color-text-muted: #94a3b8;
}
```

## 🧪 测试

### 测试设置

安装测试依赖：

```bash
pnpm add -D @vue/test-utils vitest jsdom @testing-library/vue
```

在 `vite.config.ts` 中配置 Vitest：

```typescript
export default defineConfig({
  // ... 其他配置
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts']
  }
});
```

### 组件测试

```typescript
// components/__tests__/UserCard.test.ts
import { mount } from '@vue/test-utils';
import { describe, it, expect, beforeEach } from 'vitest';
import UserCard from '../UserCard.vue';
import type { User } from '@/types/User';

const mockUser: User = {
  id: '1',
  name: 'John Doe',
  email: 'john@example.com',
  role: 'user',
  createdAt: new Date(),
  updatedAt: new Date()
};

describe('UserCard', () => {
  it('正确渲染用户信息', () => {
    const wrapper = mount(UserCard, {
      props: { user: mockUser }
    });

    expect(wrapper.text()).toContain('John Doe');
    expect(wrapper.text()).toContain('john@example.com');
  });

  it('点击编辑按钮时触发编辑事件', async () => {
    const wrapper = mount(UserCard, {
      props: { user: mockUser }
    });

    await wrapper.find('[data-testid="edit-button"]').trigger('click');

    expect(wrapper.emitted('edit')).toBeTruthy();
    expect(wrapper.emitted('edit')?.[0]).toEqual([mockUser]);
  });
});
```

## 📚 最佳实践

### 代码质量

1. **使用 TypeScript**: 始终为 props、emits 和数据类型化
2. **单一职责**: 每个组件应有一个明确的目的
3. **Composition API**: 优先使用 Composition API 而非 Options API
4. **Ref vs Reactive**: 基本类型使用 `ref`，对象使用 `reactive`
5. **只读**: 从 composables 返回只读的 refs

### 性能

1. **懒加载**: 对路由和重型组件使用动态导入
2. **虚拟滚动**: 对大列表（>100项）使用虚拟滚动
3. **防抖**: 对搜索输入和 API 调用进行防抖
4. **记忆化**: 对昂贵计算使用 `computed`
5. **浅引用**: 不需要深度响应时使用 `shallowRef`

### 可访问性

1. **语义化 HTML**: 使用正确的 HTML 元素
2. **ARIA 标签**: 为屏幕阅读器添加标签
3. **键盘导航**: 确保所有交互元素都可键盘访问
4. **焦点管理**: 在模态框和表单中正确处理焦点
5. **颜色对比**: 确保足够的颜色对比度

### 安全

1. **输入验证**: 验证所有用户输入
2. **XSS 预防**: 清理用户生成的内容
3. **CSRF 保护**: 对表单使用 CSRF 令牌
4. **内容安全策略**: 实施适当的 CSP 头
5. **安全存储**: 不要在 localStorage 中存储敏感数据