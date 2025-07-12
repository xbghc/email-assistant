<template>
  <Layout>
    <div class="settings-page">
      <div class="page-header">
        <h2>系统配置</h2>
        <button class="btn btn-success" @click="saveSettings" :disabled="isSaving">
          <i data-feather="save"></i> 
          {{ isSaving ? '保存中...' : '保存配置' }}
        </button>
      </div>
      
      <div class="settings-grid">
        <!-- 邮件配置 -->
        <div class="card">
          <div class="card-header">
            <h3>邮件配置</h3>
          </div>
          <div class="card-content">
            <form class="form">
              <div class="form-group">
                <label for="smtp-host">SMTP主机</label>
                <input 
                  v-model="settings.email.smtpHost"
                  type="text" 
                  id="smtp-host" 
                  class="form-input" 
                  placeholder="smtp.example.com"
                >
              </div>
              <div class="form-group">
                <label for="smtp-port">SMTP端口</label>
                <input 
                  v-model="settings.email.smtpPort"
                  type="number" 
                  id="smtp-port" 
                  class="form-input" 
                  placeholder="587"
                >
              </div>
              <div class="form-group">
                <label for="email-user">邮箱用户名</label>
                <input 
                  v-model="settings.email.username"
                  type="email" 
                  id="email-user" 
                  class="form-input" 
                  placeholder="user@example.com"
                >
              </div>
              <div class="form-group">
                <label for="email-pass">邮箱密码</label>
                <input 
                  v-model="settings.email.password"
                  type="password" 
                  id="email-pass" 
                  class="form-input" 
                  placeholder="应用密码"
                >
              </div>
              <div class="form-group">
                <label class="checkbox-label">
                  <input 
                    v-model="settings.email.enableSSL"
                    type="checkbox"
                    class="form-checkbox"
                  >
                  启用SSL加密
                </label>
              </div>
            </form>
          </div>
        </div>

        <!-- AI配置 -->
        <div class="card">
          <div class="card-header">
            <h3>AI配置</h3>
          </div>
          <div class="card-content">
            <form class="form">
              <div class="form-group">
                <label for="ai-provider">AI提供商</label>
                <select v-model="settings.ai.provider" id="ai-provider" class="form-select">
                  <option value="openai">OpenAI</option>
                  <option value="deepseek">DeepSeek</option>
                  <option value="google">Google</option>
                  <option value="anthropic">Anthropic</option>
                  <option value="mock">Mock (测试)</option>
                </select>
              </div>
              <div class="form-group">
                <label for="ai-model">AI模型</label>
                <input 
                  v-model="settings.ai.model"
                  type="text" 
                  id="ai-model" 
                  class="form-input" 
                  placeholder="gpt-3.5-turbo"
                >
              </div>
              <div class="form-group">
                <label for="ai-api-key">API密钥</label>
                <input 
                  v-model="settings.ai.apiKey"
                  type="password" 
                  id="ai-api-key" 
                  class="form-input" 
                  placeholder="sk-..."
                >
              </div>
              <div class="form-group">
                <label for="ai-temperature">温度设置</label>
                <input 
                  v-model="settings.ai.temperature"
                  type="range" 
                  id="ai-temperature" 
                  class="form-range"
                  min="0"
                  max="1"
                  step="0.1"
                >
                <span class="range-value">{{ settings.ai.temperature }}</span>
              </div>
            </form>
          </div>
        </div>

        <!-- 调度配置 -->
        <div class="card">
          <div class="card-header">
            <h3>调度配置</h3>
          </div>
          <div class="card-content">
            <form class="form">
              <div class="form-group">
                <label class="checkbox-label">
                  <input 
                    v-model="settings.schedule.morningReminderEnabled"
                    type="checkbox"
                    class="form-checkbox"
                  >
                  启用晨间提醒
                </label>
              </div>
              <div class="form-group">
                <label for="morning-time">晨间提醒时间</label>
                <input 
                  v-model="settings.schedule.morningTime"
                  type="time" 
                  id="morning-time" 
                  class="form-input"
                  :disabled="!settings.schedule.morningReminderEnabled"
                >
              </div>
              <div class="form-group">
                <label class="checkbox-label">
                  <input 
                    v-model="settings.schedule.eveningReminderEnabled"
                    type="checkbox"
                    class="form-checkbox"
                  >
                  启用晚间提醒
                </label>
              </div>
              <div class="form-group">
                <label for="evening-time">晚间提醒时间</label>
                <input 
                  v-model="settings.schedule.eveningTime"
                  type="time" 
                  id="evening-time" 
                  class="form-input"
                  :disabled="!settings.schedule.eveningReminderEnabled"
                >
              </div>
              <div class="form-group">
                <label class="checkbox-label">
                  <input 
                    v-model="settings.schedule.weeklyReportEnabled"
                    type="checkbox"
                    class="form-checkbox"
                  >
                  启用周报
                </label>
              </div>
              <div class="form-group">
                <label for="weekly-day">周报发送日期</label>
                <select 
                  v-model="settings.schedule.weeklyDay" 
                  id="weekly-day" 
                  class="form-select"
                  :disabled="!settings.schedule.weeklyReportEnabled"
                >
                  <option value="0">星期日</option>
                  <option value="1">星期一</option>
                  <option value="2">星期二</option>
                  <option value="3">星期三</option>
                  <option value="4">星期四</option>
                  <option value="5">星期五</option>
                  <option value="6">星期六</option>
                </select>
              </div>
            </form>
          </div>
        </div>

        <!-- 系统配置 -->
        <div class="card">
          <div class="card-header">
            <h3>系统配置</h3>
          </div>
          <div class="card-content">
            <form class="form">
              <div class="form-group">
                <label for="log-level">日志级别</label>
                <select v-model="settings.system.logLevel" id="log-level" class="form-select">
                  <option value="debug">调试</option>
                  <option value="info">信息</option>
                  <option value="warn">警告</option>
                  <option value="error">错误</option>
                </select>
              </div>
              <div class="form-group">
                <label for="timezone">时区</label>
                <select v-model="settings.system.timezone" id="timezone" class="form-select">
                  <option value="Asia/Shanghai">亚洲/上海</option>
                  <option value="America/New_York">美国/纽约</option>
                  <option value="Europe/London">欧洲/伦敦</option>
                </select>
              </div>
              <div class="form-group">
                <label class="checkbox-label">
                  <input 
                    v-model="settings.system.enableMetrics"
                    type="checkbox"
                    class="form-checkbox"
                  >
                  启用性能监控
                </label>
              </div>
              <div class="form-group">
                <label class="checkbox-label">
                  <input 
                    v-model="settings.system.enableNotifications"
                    type="checkbox"
                    class="form-checkbox"
                  >
                  启用系统通知
                </label>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  </Layout>
</template>

<script setup lang="ts">
import { reactive, ref, onMounted, nextTick } from 'vue';
import Layout from '@/components/Layout.vue';

const isSaving = ref(false);

const settings = reactive({
  email: {
    smtpHost: 'smtp.gmail.com',
    smtpPort: 587,
    username: '',
    password: '',
    enableSSL: true
  },
  ai: {
    provider: 'openai',
    model: 'gpt-3.5-turbo',
    apiKey: '',
    temperature: 0.7
  },
  schedule: {
    morningReminderEnabled: true,
    morningTime: '08:00',
    eveningReminderEnabled: true,
    eveningTime: '18:00',
    weeklyReportEnabled: true,
    weeklyDay: '1'
  },
  system: {
    logLevel: 'info',
    timezone: 'Asia/Shanghai',
    enableMetrics: true,
    enableNotifications: true
  }
});

const saveSettings = async () => {
  if (isSaving.value) return;
  
  isSaving.value = true;
  try {
    // 模拟API调用
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // TODO: 实际的API调用
    // await apiClient.updateSettings(settings);
    
    console.log('Settings saved:', settings);
    
    // 显示成功消息
    alert('配置保存成功！');
  } catch (error) {
    console.error('Failed to save settings:', error);
    alert('配置保存失败，请稍后重试。');
  } finally {
    isSaving.value = false;
  }
};

const loadSettings = async () => {
  try {
    // TODO: 从API加载配置
    // const response = await apiClient.getSettings();
    // if (response.success) {
    //   Object.assign(settings, response.data);
    // }
    
    console.log('Settings loaded');
  } catch (error) {
    console.error('Failed to load settings:', error);
  }
};

onMounted(async () => {
  await loadSettings();
  
  // 初始化 Feather icons
  await nextTick();
  if (typeof window !== 'undefined' && window.feather) {
    window.feather.replace();
  }
});
</script>

<style scoped>
.settings-page {
  max-width: 1200px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

.page-header h2 {
  font-size: 1.5rem;
  font-weight: 600;
  color: #1a202c;
  margin: 0;
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
  border: none;
}

.btn-success {
  background: #10b981;
  color: white;
}

.btn-success:hover:not(:disabled) {
  background: #059669;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.settings-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: 2rem;
}

.card {
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  border: 1px solid #e2e8f0;
}

.card-header {
  padding: 1.5rem;
  border-bottom: 1px solid #e2e8f0;
}

.card-header h3 {
  font-size: 1.125rem;
  font-weight: 600;
  color: #1a202c;
  margin: 0;
}

.card-content {
  padding: 1.5rem;
}

.form {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-group label {
  font-weight: 500;
  color: #374151;
  font-size: 0.875rem;
}

.form-input,
.form-select {
  padding: 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 0.875rem;
  transition: border-color 0.2s;
}

.form-input:focus,
.form-select:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.form-input:disabled,
.form-select:disabled {
  background: #f9fafb;
  color: #6b7280;
  cursor: not-allowed;
}

.form-range {
  width: 100%;
  height: 6px;
  background: #e5e7eb;
  border-radius: 3px;
  outline: none;
  cursor: pointer;
}

.form-range::-webkit-slider-thumb {
  appearance: none;
  width: 20px;
  height: 20px;
  background: #667eea;
  border-radius: 50%;
  cursor: pointer;
}

.form-range::-moz-range-thumb {
  width: 20px;
  height: 20px;
  background: #667eea;
  border-radius: 50%;
  cursor: pointer;
  border: none;
}

.range-value {
  font-size: 0.875rem;
  color: #6b7280;
  margin-left: 0.5rem;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
}

.form-checkbox {
  width: 1rem;
  height: 1rem;
  accent-color: #667eea;
}
</style>