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
        <strong>登录说明：</strong><br>
        请输入系统注册的邮箱地址，系统将发送验证码到您的邮箱<br>
        验证码有效期为30分钟
      </div>

      <!-- 第一步：输入邮箱发送验证码 -->
      <form v-if="!codeRequest.sent" @submit.prevent="handleSendCode" class="login-form">
        <div class="form-group">
          <label class="form-label" for="email">邮箱地址</label>
          <input 
            v-model="loginForm.email"
            type="email" 
            id="email"
            class="form-input" 
            placeholder="请输入已注册的邮箱地址"
            required
            autocomplete="email"
          >
        </div>

        <button type="submit" class="login-button" :disabled="isLoading">
          <div v-if="isLoading" class="loading-spinner"></div>
          <i v-else data-feather="send"></i>
          <span>{{ isLoading ? '发送中...' : '发送验证码' }}</span>
        </button>

        <div v-if="errorMessage" class="error-message show">
          {{ errorMessage }}
        </div>
      </form>

      <!-- 第二步：输入验证码登录 -->
      <form v-else @submit.prevent="handleVerifyCode" class="login-form">
        <div class="form-group">
          <label class="form-label">邮箱地址</label>
          <div class="email-display">{{ loginForm.email }}</div>
        </div>

        <div class="form-group">
          <label class="form-label" for="code">验证码</label>
          <input 
            v-model="loginForm.code"
            type="text" 
            id="code"
            class="form-input code-input" 
            placeholder="请输入6位验证码"
            required
            maxlength="6"
            autocomplete="one-time-code"
          >
        </div>

        <div class="code-info">
          <p>验证码已发送至您的邮箱，请查收</p>
          <button 
            type="button" 
            class="resend-button" 
            @click="handleResendCode"
            :disabled="resendCooldown > 0 || isLoading"
          >
            {{ resendCooldown > 0 ? `重新发送 (${resendCooldown}s)` : '重新发送验证码' }}
          </button>
        </div>

        <div class="button-group">
          <button type="button" class="back-button" @click="resetForm">
            <i data-feather="arrow-left"></i>
            <span>返回</span>
          </button>
          <button type="submit" class="login-button verify-button" :disabled="isLoading">
            <div v-if="isLoading" class="loading-spinner"></div>
            <i v-else data-feather="log-in"></i>
            <span>{{ isLoading ? '验证中...' : '验证登录' }}</span>
          </button>
        </div>

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
import { ref, reactive, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { authManager } from '@/utils/auth';

const router = useRouter();

const loginForm = reactive({
  email: '',
  code: ''
});

const codeRequest = reactive({
  sent: false
});

const isLoading = ref(false);
const errorMessage = ref('');
const resendCooldown = ref(0);

let cooldownTimer: ReturnType<typeof setTimeout> | null = null;

const handleSendCode = async () => {
  if (!loginForm.email) {
    errorMessage.value = '请输入邮箱地址';
    return;
  }

  isLoading.value = true;
  errorMessage.value = '';

  try {
    const result = await authManager.sendCode(loginForm.email);
    
    if (result.success) {
      codeRequest.sent = true;
      startCooldown();
    } else {
      errorMessage.value = result.error || '发送验证码失败';
    }
  } catch {
    errorMessage.value = '网络错误，请稍后重试';
  } finally {
    isLoading.value = false;
  }
};

const handleVerifyCode = async () => {
  if (!loginForm.email || !loginForm.code) {
    errorMessage.value = '请输入验证码';
    return;
  }

  isLoading.value = true;
  errorMessage.value = '';

  try {
    const result = await authManager.verifyCode(loginForm.email, loginForm.code);
    
    if (result.success) {
      // 登录成功，路由守卫会自动重定向
      router.push('/dashboard');
    } else {
      errorMessage.value = result.error || '验证码错误，请重试';
    }
  } catch {
    errorMessage.value = '网络错误，请稍后重试';
  } finally {
    isLoading.value = false;
  }
};

const handleResendCode = async () => {
  await handleSendCode();
};

const resetForm = () => {
  codeRequest.sent = false;
  loginForm.code = '';
  errorMessage.value = '';
  if (cooldownTimer) {
    clearInterval(cooldownTimer);
    cooldownTimer = null;
  }
  resendCooldown.value = 0;
};

const startCooldown = () => {
  resendCooldown.value = 60; // 60秒冷却时间
  cooldownTimer = setInterval(() => {
    resendCooldown.value--;
    if (resendCooldown.value <= 0) {
      clearInterval(cooldownTimer!);
      cooldownTimer = null;
    }
  }, 1000);
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

onUnmounted(() => {
  if (cooldownTimer) {
    clearInterval(cooldownTimer);
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

/* 验证码登录相关样式 */
.email-display {
  padding: 0.75rem 1rem;
  background: #f0f4f8;
  border: 2px solid #e2e8f0;
  border-radius: 8px;
  font-size: 1rem;
  color: #2d3748;
  font-weight: 500;
}

.code-input {
  text-align: center;
  font-size: 1.5rem;
  font-weight: 600;
  letter-spacing: 0.5em;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
}

.code-info {
  text-align: center;
  color: #718096;
  font-size: 0.875rem;
}

.code-info p {
  margin: 0 0 0.5rem 0;
}

.resend-button {
  background: none;
  border: none;
  color: #667eea;
  font-size: 0.875rem;
  cursor: pointer;
  text-decoration: underline;
  transition: color 0.2s;
}

.resend-button:hover:not(:disabled) {
  color: #5a67d8;
}

.resend-button:disabled {
  color: #a0aec0;
  cursor: not-allowed;
  text-decoration: none;
}

.button-group {
  display: flex;
  gap: 1rem;
}

.back-button {
  background: #f7fafc;
  color: #4a5568;
  border: 2px solid #e2e8f0;
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
  flex: 1;
}

.back-button:hover {
  background: #edf2f7;
  border-color: #cbd5e0;
}

.verify-button {
  flex: 2;
}
</style>