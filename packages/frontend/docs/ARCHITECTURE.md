# 前端架构

## 📁 项目结构

```
src/
├── assets/          # 静态资源（样式、图片）
│   ├── styles.css   # 全局样式
│   └── variables.scss # SCSS 变量
├── components/      # 可复用 Vue 组件
│   ├── Layout.vue   # 主要布局包装器
│   └── Modal.vue    # 模态框组件
├── composables/     # Vue composables 共享逻辑
├── pages/          # 页面特定组件
├── router/         # Vue Router 配置
│   └── index.ts    # 路由定义和守卫
├── types/          # TypeScript 类型定义
│   └── index.ts    # 应用程序特定类型
├── utils/          # 工具函数
│   ├── api.ts      # API 客户端
│   ├── auth.ts     # 身份验证管理
│   ├── dom.ts      # DOM 工具
│   └── state.ts    # 应用程序状态
├── views/          # 页面视图（路由组件）
│   ├── Dashboard.vue
│   ├── Login.vue
│   ├── Logs.vue
│   ├── Reports.vue
│   ├── Settings.vue
│   ├── System.vue
│   └── Users.vue
├── App.vue         # 根组件
├── main.ts         # 应用程序入口点
└── env.d.ts        # TypeScript 环境声明
```

## 🏗️ 设计模式

### Composition API 模式

所有组件都使用 Vue 3 Composition API 和 `<script setup>`：

```typescript
<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';

// 使用 TypeScript 的 Props
interface Props {
  title: string;
  count?: number;
}

const props = withDefaults(defineProps<Props>(), {
  count: 0
});

// 响应式状态
const isVisible = ref(false);

// 计算属性
const displayText = computed(() => `${props.title} (${props.count})`);

// 生命周期钩子
onMounted(() => {
  console.log('组件已挂载');
});
</script>
```

### Composables 模式

共享逻辑提取为 composables：

```typescript
// composables/useAuth.ts
export function useAuth() {
  const user = ref<User | null>(null);
  const isLoggedIn = computed(() => !!user.value);
  
  const login = async (credentials: LoginCredentials) => {
    // 登录逻辑
  };
  
  const logout = () => {
    user.value = null;
    authManager.logout();
  };
  
  return {
    user: readonly(user),
    isLoggedIn,
    login,
    logout
  };
}
```

### 状态管理

#### 本地组件状态
使用 `ref` 和 `reactive` 管理组件特定状态：

```typescript
const formData = reactive({
  email: '',
  password: ''
});

const loading = ref(false);
```

#### 全局状态
使用 composables 管理跨组件状态：

```typescript
// utils/state.ts
const globalState = reactive({
  user: null,
  notifications: [],
  settings: {}
});

export function useGlobalState() {
  return {
    state: readonly(globalState),
    updateUser: (user: User) => globalState.user = user,
    addNotification: (notification: Notification) => 
      globalState.notifications.push(notification)
  };
}
```

## 🔄 数据流

### 组件通信

1. **父到子**: Props
2. **子到父**: Events/Emits
3. **兄弟组件**: 共享 composables
4. **全局状态**: 状态 composables

```typescript
// 父组件
<ChildComponent 
  :data="parentData" 
  @update="handleUpdate" 
/>

// 子组件
interface Props {
  data: SomeData;
}

interface Emits {
  update: [value: string];
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const handleClick = () => {
  emit('update', 'new value');
};
```

### API 数据流

```
组件 → API 客户端 → 后端 API
    ↓
组件 ← 类型化响应 ← API 响应
```

## 🛡️ 身份验证流程

### 路由保护

```typescript
// router/index.ts
router.beforeEach((to, from, next) => {
  const requiresAuth = to.matched.some(record => record.meta.requiresAuth);
  const isAuthenticated = authManager.isAuthenticated();
  
  if (requiresAuth && !isAuthenticated) {
    next('/login');
  } else {
    next();
  }
});
```

### Token 管理

```typescript
// utils/auth.ts
class AuthManager {
  private token: string | null = null;
  
  login(token: string) {
    this.token = token;
    localStorage.setItem('authToken', token);
    apiClient.setToken(token);
  }
  
  logout() {
    this.token = null;
    localStorage.removeItem('authToken');
    apiClient.setToken(null);
    router.push('/login');
  }
  
  isAuthenticated(): boolean {
    return !!this.token && !this.isTokenExpired();
  }
}
```

## 🎨 样式架构

### CSS 自定义属性

```css
:root {
  --primary-color: #3b82f6;
  --secondary-color: #64748b;
  --success-color: #10b981;
  --warning-color: #f59e0b;
  --error-color: #ef4444;
  
  --font-family: 'Inter', sans-serif;
  --border-radius: 8px;
  --box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}
```

### SCSS 变量

```scss
// assets/variables.scss
$breakpoints: (
  mobile: 768px,
  tablet: 1024px,
  desktop: 1280px
);

$spacing: (
  xs: 0.25rem,
  sm: 0.5rem,
  md: 1rem,
  lg: 1.5rem,
  xl: 2rem
);
```

### 组件样式

```vue
<style scoped lang="scss">
.component {
  padding: map-get($spacing, md);
  border-radius: var(--border-radius);
  
  @media (max-width: map-get($breakpoints, mobile)) {
    padding: map-get($spacing, sm);
  }
  
  &__title {
    color: var(--primary-color);
    font-weight: 600;
  }
  
  &--active {
    background-color: var(--primary-color);
    color: white;
  }
}
</style>
```

## 🔧 构建架构

### Vite 配置

```javascript
export default defineConfig({
  plugins: [vue()],
  
  build: {
    target: 'esnext',
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]'
      }
    }
  },
  
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@shared': resolve(__dirname, '../shared/src')
    }
  }
});
```

### 代码分割

基于路由的自动代码分割：

```typescript
const routes = [
  {
    path: '/dashboard',
    component: () => import('@/views/Dashboard.vue') // 懒加载
  }
];
```

### 资源优化

- **图片**: 自动优化
- **CSS**: PostCSS 和 autoprefixer
- **JS**: Tree shaking 和压缩
- **字体**: 预加载和优化

## 📱 响应式设计

### 移动优先方法

```scss
.component {
  // 移动端样式（默认）
  padding: 1rem;
  
  @media (min-width: 768px) {
    // 平板样式
    padding: 1.5rem;
  }
  
  @media (min-width: 1024px) {
    // 桌面样式
    padding: 2rem;
  }
}
```

### 自适应组件

组件适应屏幕尺寸：

```typescript
import { useWindowSize } from '@/composables/useWindowSize';

const { width, height } = useWindowSize();
const isMobile = computed(() => width.value < 768);
```

## 🧪 测试策略

### 组件测试

```typescript
// Component.spec.ts
import { mount } from '@vue/test-utils';
import Component from '@/components/Component.vue';

describe('Component', () => {
  it('正确渲染', () => {
    const wrapper = mount(Component, {
      props: { title: 'Test' }
    });
    
    expect(wrapper.text()).toContain('Test');
  });
});
```

### 集成测试

测试组件交互和 API 集成：

```typescript
// 集成测试示例
it('API 调用成功时应更新数据', async () => {
  const mockApiResponse = { data: [/* 模拟数据 */] };
  vi.spyOn(apiClient, 'get').mockResolvedValue(mockApiResponse);
  
  const wrapper = mount(Component);
  await wrapper.vm.loadData();
  
  expect(wrapper.vm.items).toEqual(mockApiResponse.data);
});
```

## 🔍 性能考虑

### 懒加载

- 基于路由的代码分割
- 组件懒加载
- 图片懒加载

### 优化技术

- 大列表的虚拟滚动
- 防抖搜索输入
- 记忆化计算属性
- 高效的状态更新

### Bundle 分析

```bash
# 分析 bundle 大小
pnpm build --analyze

# 检查未使用的依赖
pnpm depcheck
```