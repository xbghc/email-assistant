import { createRouter, createWebHistory } from 'vue-router';
import { authManager } from '@/utils/auth';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      redirect: '/dashboard'
    },
    {
      path: '/login',
      name: 'Login',
      component: () => import('@/views/Login.vue'),
      meta: { requiresAuth: false }
    },
    {
      path: '/dashboard',
      name: 'Dashboard',
      component: () => import('@/views/Dashboard.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/users',
      name: 'Users',
      component: () => import('@/views/Users.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/system',
      name: 'System',
      component: () => import('@/views/System.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/reports',
      name: 'Reports',
      component: () => import('@/views/Reports.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/logs',
      name: 'Logs',
      component: () => import('@/views/Logs.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/settings',
      name: 'Settings',
      component: () => import('@/views/Settings.vue'),
      meta: { requiresAuth: true }
    }
  ]
});

// 路由守卫
router.beforeEach(async (to, from, next) => {
  const requiresAuth = to.meta.requiresAuth;
  const isAuthenticated = authManager.isAuthenticated();

  if (requiresAuth && !isAuthenticated) {
    // 需要认证但未登录，重定向到登录页
    next('/login');
  } else if (to.path === '/login' && isAuthenticated) {
    // 已登录但访问登录页，重定向到仪表板
    next('/dashboard');
  } else {
    next();
  }
});

export default router;