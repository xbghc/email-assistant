<template>
  <div class="login-container">
    <div class="login-card">
      <div class="login-header">
        <div class="login-icon">
          <i data-feather="mail" size="32"></i>
        </div>
        <h1 class="login-title">邮件助手</h1>
        <p class="login-subtitle">管理界面登录</p>
      </div>

      <div class="demo-info">
        <strong>演示说明：</strong><br>
        管理员账号：请使用系统配置的管理员邮箱地址<br>
        密码：如果未设置密码，请先通过API注册账号
      </div>

      <form @submit.prevent="handleLogin" class="login-form">
        <div class="form-group">
          <label class="form-label" for="email">邮箱地址</label>
          <input 
            v-model="loginForm.email"
            type="email" 
            id="email"
            class="form-input" 
            placeholder="请输入管理员邮箱"
            required
            autocomplete="email"
          >
        </div>

        <div class="form-group">
          <label class="form-label" for="password">密码</label>
          <input 
            v-model="loginForm.password"
            type="password" 
            id="password"
            class="form-input" 
            placeholder="请输入密码"
            required
            autocomplete="current-password"
          >
        </div>

        <button type="submit" class="login-button" :disabled="isLoading">
          <div v-if="isLoading" class="loading-spinner"></div>
          <i v-else data-feather="log-in"></i>
          <span>{{ isLoading ? '登录中...' : '登录' }}</span>
        </button>

        <div v-if="errorMessage" class="error-message show">
          {{ errorMessage }}
        </div>
      </form>

      <div class="footer-text">
        邮件助手管理系统 © 2024
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { authManager } from '@/utils/auth';

const router = useRouter();

const loginForm = reactive({
  email: '',
  password: ''
});

const isLoading = ref(false);
const errorMessage = ref('');

const handleLogin = async () => {
  if (!loginForm.email || !loginForm.password) {
    errorMessage.value = '请填写完整的登录信息';
    return;
  }

  isLoading.value = true;
  errorMessage.value = '';

  try {
    const result = await authManager.login(loginForm.email, loginForm.password);
    
    if (result.success) {
      // 登录成功，路由守卫会自动重定向
      router.push('/dashboard');
    } else {
      errorMessage.value = result.error || '登录失败，请检查邮箱和密码';
    }
  } catch (error) {
    console.error('Login error:', error);
    errorMessage.value = '网络错误，请稍后重试';
  } finally {
    isLoading.value = false;
  }
};

onMounted(() => {
  // 检查是否已登录
  if (authManager.isAuthenticated()) {
    router.push('/dashboard');
  }
  
  // 初始化 Feather icons
  if (typeof window !== 'undefined' && window.feather) {
    window.feather.replace();
  }
});
</script>

<style scoped>
.login-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 1rem;
}

.login-card {
  background: white;
  border-radius: 16px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
  padding: 2.5rem;
  width: 100%;
  max-width: 400px;
  animation: slideUp 0.6s ease-out;
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.login-header {
  text-align: center;
  margin-bottom: 2rem;
}

.login-icon {
  width: 64px;
  height: 64px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 1rem;
  color: white;
}

.login-title {
  font-size: 1.75rem;
  font-weight: 600;
  color: #1a202c;
  margin: 0 0 0.5rem;
}

.login-subtitle {
  color: #718096;
  font-size: 0.875rem;
  margin: 0;
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-label {
  font-weight: 500;
  color: #2d3748;
  font-size: 0.875rem;
}

.form-input {
  padding: 0.75rem 1rem;
  border: 2px solid #e2e8f0;
  border-radius: 8px;
  font-size: 1rem;
  transition: all 0.2s;
  background: #f7fafc;
}

.form-input:focus {
  outline: none;
  border-color: #667eea;
  background: white;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.login-button {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  padding: 0.875rem 1.5rem;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.login-button:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.login-button:active {
  transform: translateY(0);
}

.login-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.error-message {
  color: #e53e3e;
  font-size: 0.875rem;
  padding: 0.75rem;
  background: #fed7d7;
  border-radius: 6px;
  border: 1px solid #feb2b2;
  animation: fadeIn 0.3s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.loading-spinner {
  width: 20px;
  height: 20px;
  border: 2px solid transparent;
  border-top: 2px solid currentColor;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.footer-text {
  text-align: center;
  margin-top: 2rem;
  color: #718096;
  font-size: 0.75rem;
}

.demo-info {
  background: #e6fffa;
  border: 1px solid #81e6d9;
  border-radius: 8px;
  padding: 1rem;
  margin-bottom: 1.5rem;
  font-size: 0.875rem;
  color: #234e52;
}

.demo-info strong {
  color: #1a202c;
}
</style>