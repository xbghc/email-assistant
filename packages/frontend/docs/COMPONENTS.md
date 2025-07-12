# 组件库

## 🧩 核心组件

### Layout.vue

主要应用布局组件，提供整体结构。

**功能特性：**
- 响应式导航侧边栏
- 带用户信息的头部
- 主内容区域
- 移动端友好设计

**Props：**
```typescript
interface Props {
  sidebarCollapsed?: boolean;
}
```

**插槽：**
- `default` - 主内容区域
- `header` - 自定义头部内容
- `sidebar` - 额外侧边栏内容

**使用方法：**
```vue
<template>
  <Layout :sidebar-collapsed="isCollapsed">
    <template #header>
      <h1>页面标题</h1>
    </template>
    
    <div class="page-content">
      <!-- 您的页面内容 -->
    </div>
  </Layout>
</template>
```

### Modal.vue

可复用的模态框组件，用于覆盖层和表单。

**功能特性：**
- 点击背景关闭
- ESC 键支持
- 焦点管理
- 动画过渡
- 可自定义尺寸

**Props：**
```typescript
interface Props {
  visible: boolean;
  title?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  closable?: boolean;
  maskClosable?: boolean;
}
```

## 📄 视图组件

### Dashboard.vue - 仪表板

系统概览和快速操作仪表板。

**功能特性：**
- 系统状态卡片
- 最近活动时间线
- 快速操作按钮
- 性能指标
- 实时更新

### Users.vue - 用户管理

管理员用户管理界面。

**功能特性：**
- 用户列表（搜索/过滤）
- 添加/编辑用户表单
- 角色管理
- 批量操作
- 活动跟踪

### System.vue - 系统监控

系统监控和配置界面。

**功能特性：**
- 服务状态监控
- 配置管理
- 系统日志查看器
- 性能指标
- 维护工具

### Settings.vue - 设置

应用程序配置和偏好设置。

**设置分类：**
- **通用**: 基础应用设置
- **邮件**: SMTP/IMAP 配置
- **AI**: 提供商设置
- **通知**: 警报偏好
- **安全**: 身份验证设置

### Logs.vue - 日志查看

实时日志查看和管理。

**功能特性：**
- 实时日志流
- 搜索和过滤
- 日志级别选择
- 下载功能
- 自动滚动开关

### Reports.vue - 报告

分析和报告仪表板。

**功能特性：**
- 邮件统计图表
- 性能报告
- 用户活动分析
- 导出功能
- 日期范围选择

### Login.vue - 登录

身份验证界面。

**功能特性：**
- 邮箱/密码登录
- 记住我选项
- 密码重置链接
- 表单验证
- 加载状态

## 🔧 工具组件

### Button 组件

可复用按钮，支持多种变体和状态。

```vue
<template>
  <button
    :class="buttonClasses"
    :disabled="disabled || loading"
    @click="handleClick"
  >
    <Icon v-if="icon && !loading" :name="icon" />
    <Spinner v-if="loading" size="sm" />
    <span v-if="$slots.default"><slot /></span>
  </button>
</template>

<script setup lang="ts">
interface Props {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  icon?: string;
  loading?: boolean;
  disabled?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'primary',
  size: 'md'
});
</script>
```

### Input 组件

带验证和状态的表单输入。

```vue
<template>
  <div class="input-group">
    <label v-if="label" :for="id" class="input-label">
      {{ label }}
      <span v-if="required" class="required">*</span>
    </label>
    
    <input
      :id="id"
      v-model="inputValue"
      :type="type"
      :placeholder="placeholder"
      :disabled="disabled"
      :class="inputClasses"
      @blur="validateInput"
    />
    
    <div v-if="error" class="input-error">
      {{ error }}
    </div>
  </div>
</template>
```

## 📊 数据展示组件

### DataTable 组件

可复用数据表格，支持排序、过滤和分页。

**功能特性：**
- 列排序
- 行选择
- 分页
- 搜索过滤
- 自定义单元格渲染器
- 导出功能

### 图表组件

各种数据可视化图表组件：

- `LineChart` - 趋势分析
- `BarChart` - 对比分析
- `PieChart` - 分布分析
- `MetricCard` - KPI 显示

## 🎨 样式指南

### CSS 类命名

使用 BEM 方法论进行类命名：

```scss
.component {
  // 基础组件样式
  
  &__element {
    // 元素样式
  }
  
  &--modifier {
    // 修饰符样式
  }
}
```

### CSS 自定义属性

使用 CSS 变量进行主题化：

```scss
.component {
  background-color: var(--background-color);
  color: var(--text-color);
  border: 1px solid var(--border-color);
}
```

### 响应式设计

移动端优先的响应式设计：

```scss
.component {
  // 移动端样式（默认）
  
  @media (min-width: 768px) {
    // 平板样式
  }
  
  @media (min-width: 1024px) {
    // 桌面样式
  }
}
```

## 🧪 组件测试

### 测试设置

```typescript
import { mount } from '@vue/test-utils';
import { describe, it, expect } from 'vitest';
import Button from '@/components/Button.vue';

describe('Button 组件', () => {
  it('正确渲染', () => {
    const wrapper = mount(Button, {
      props: { variant: 'primary' },
      slots: { default: '点击我' }
    });
    
    expect(wrapper.text()).toContain('点击我');
    expect(wrapper.classes()).toContain('btn--primary');
  });
  
  it('触发点击事件', async () => {
    const wrapper = mount(Button);
    await wrapper.trigger('click');
    expect(wrapper.emitted('click')).toBeTruthy();
  });
});
```

## 🔄 组件生命周期

### Composition API 生命周期

```typescript
<script setup lang="ts">
import { onMounted, onUpdated, onUnmounted } from 'vue';

// 组件初始化
onMounted(() => {
  loadData();
  setupEventListeners();
});

// DOM 更新后
onUpdated(() => {
  updateCharts();
});

// 清理
onUnmounted(() => {
  removeEventListeners();
  cancelRequests();
});
</script>
```

### 性能优化

- 使用 `v-memo` 优化昂贵渲染
- 大列表实现虚拟滚动
- 防抖用户输入
- 懒加载重型组件
- 适当时使用 `shallowRef`