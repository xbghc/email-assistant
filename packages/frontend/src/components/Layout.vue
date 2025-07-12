<template>
  <div class="app">
    <!-- 侧边栏导航 -->
    <nav class="sidebar">
      <div class="sidebar-header">
        <h2><i data-feather="mail"></i>邮件助手</h2>
      </div>
      <ul class="nav-menu">
        <li class="nav-item" :class="{ active: currentRoute === 'dashboard' }">
          <router-link to="/dashboard">
            <i data-feather="home"></i>仪表板
          </router-link>
        </li>
        <li class="nav-item" :class="{ active: currentRoute === 'users' }">
          <router-link to="/users">
            <i data-feather="users"></i>用户管理
          </router-link>
        </li>
        <li class="nav-item" :class="{ active: currentRoute === 'system' }">
          <router-link to="/system">
            <i data-feather="activity"></i>系统状态
          </router-link>
        </li>
        <li class="nav-item" :class="{ active: currentRoute === 'reports' }">
          <router-link to="/reports">
            <i data-feather="file-text"></i>报告管理
          </router-link>
        </li>
        <li class="nav-item" :class="{ active: currentRoute === 'logs' }">
          <router-link to="/logs">
            <i data-feather="list"></i>日志查看
          </router-link>
        </li>
        <li class="nav-item" :class="{ active: currentRoute === 'settings' }">
          <router-link to="/settings">
            <i data-feather="settings"></i>系统配置
          </router-link>
        </li>
      </ul>
    </nav>

    <!-- 主内容区域 -->
    <main class="main-content">
      <!-- 头部 -->
      <header class="header">
        <h1>{{ pageTitle }}</h1>
        <div class="header-actions">
          <button class="btn btn-outline" @click="refresh">
            <i data-feather="refresh-cw"></i> 刷新
          </button>
          <div class="status-indicator">
            <span class="status-dot" :class="systemStatus"></span>
            <span>{{ statusText }}</span>
          </div>
          <button class="btn btn-outline" @click="logout" title="登出">
            <i data-feather="log-out"></i> 登出
          </button>
        </div>
      </header>

      <!-- 页面内容 -->
      <div class="content">
        <slot />
      </div>
    </main>
  </div>

  <!-- 通知容器 -->
  <div class="notifications-container">
    <div
      v-for="notification in notifications"
      :key="notification.id"
      class="notification"
      :class="notification.type"
    >
      {{ notification.message }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { authManager } from '@/utils/auth';

const route = useRoute();
const router = useRouter();

const notifications = ref<Array<{
  id: number;
  type: string;
  message: string;
}>>([]);

const systemStatus = ref('checking');
const statusText = ref('检查中...');

const currentRoute = computed(() => route.name?.toString().toLowerCase());

const pageTitle = computed(() => {
  const titles: Record<string, string> = {
    dashboard: '仪表板',
    users: '用户管理',
    system: '系统状态',
    reports: '报告管理',
    logs: '日志查看',
    settings: '系统配置'
  };
  return titles[currentRoute.value] || '邮件助手';
});

const refresh = () => {
  window.location.reload();
};

const logout = () => {
  authManager.logout();
  router.push('/login');
};

onMounted(() => {
  // 初始化 Feather icons
  if (typeof window !== 'undefined' && window.feather) {
    window.feather.replace();
  }
  
  // 检查系统状态
  checkSystemStatus();
});

const checkSystemStatus = async () => {
  try {
    // 这里可以调用API检查系统状态
    // const response = await apiClient.getSystemHealth();
    systemStatus.value = 'healthy';
    statusText.value = '系统正常';
  } catch (error) {
    systemStatus.value = 'error';
    statusText.value = '系统异常';
  }
};
</script>

<style scoped>
.app {
  display: flex;
  min-height: 100vh;
  background: #f8fafc;
}

.sidebar {
  width: 260px;
  background: white;
  border-right: 1px solid #e2e8f0;
  flex-shrink: 0;
}

.sidebar-header {
  padding: 1.5rem;
  border-bottom: 1px solid #e2e8f0;
}

.sidebar-header h2 {
  font-size: 1.25rem;
  font-weight: 600;
  color: #1a202c;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.nav-menu {
  list-style: none;
  padding: 0;
  margin: 0;
}

.nav-item {
  border-bottom: 1px solid #f1f5f9;
}

.nav-item a {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem 1.5rem;
  color: #64748b;
  text-decoration: none;
  transition: all 0.2s;
}

.nav-item:hover a,
.nav-item.active a {
  background: #f8fafc;
  color: #667eea;
}

.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.header {
  background: white;
  border-bottom: 1px solid #e2e8f0;
  padding: 1rem 2rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header h1 {
  font-size: 1.5rem;
  font-weight: 600;
  color: #1a202c;
  margin: 0;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.btn {
  padding: 0.5rem 1rem;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  text-decoration: none;
}

.btn-outline {
  background: transparent;
  border: 1px solid #e2e8f0;
  color: #64748b;
}

.btn-outline:hover {
  background: #f8fafc;
  border-color: #cbd5e1;
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: #64748b;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #cbd5e1;
}

.status-dot.healthy {
  background: #10b981;
}

.status-dot.error {
  background: #ef4444;
}

.status-dot.checking {
  background: #f59e0b;
  animation: pulse 1s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.content {
  flex: 1;
  padding: 2rem;
}

.notifications-container {
  position: fixed;
  top: 1rem;
  right: 1rem;
  z-index: 1000;
  pointer-events: none;
}

.notification {
  background: white;
  border-radius: 8px;
  padding: 1rem;
  margin-bottom: 0.5rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  border-left: 4px solid #667eea;
  animation: slideIn 0.3s ease-out;
}

@keyframes slideIn {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}
</style>