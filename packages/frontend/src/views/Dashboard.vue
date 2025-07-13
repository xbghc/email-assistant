<template>
  <Layout>
    <div class="dashboard-page">
      <!-- 统计卡片 -->
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon">
            <i data-feather="users"></i>
          </div>
          <div class="stat-content">
            <h3>{{ stats.totalUsers }}</h3>
            <p>活跃用户</p>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">
            <i data-feather="mail"></i>
          </div>
          <div class="stat-content">
            <h3>{{ stats.emailsSent }}</h3>
            <p>今日邮件</p>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">
            <i data-feather="file-text"></i>
          </div>
          <div class="stat-content">
            <h3>{{ stats.reportsGenerated }}</h3>
            <p>本周报告</p>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">
            <i data-feather="cpu"></i>
          </div>
          <div class="stat-content">
            <h3>{{ stats.systemUptime }}</h3>
            <p>系统运行时间</p>
          </div>
        </div>
      </div>

      <div class="dashboard-grid">
        <!-- 快速操作 -->
        <div class="card">
          <div class="card-header">
            <h3>快速操作</h3>
          </div>
          <div class="card-content">
            <div class="quick-actions">
              <button 
                class="btn btn-primary" 
                @click="testMorningReminder"
                :disabled="isLoading"
              >
                <i data-feather="sunrise"></i> 测试晨间提醒
              </button>
              <button 
                class="btn btn-primary" 
                @click="testEveningReminder"
                :disabled="isLoading"
              >
                <i data-feather="sunset"></i> 测试晚间提醒
              </button>
              <button 
                class="btn btn-secondary" 
                @click="generateWeeklyReport"
                :disabled="isLoading"
              >
                <i data-feather="file-text"></i> 生成周报
              </button>
              <button 
                class="btn btn-secondary" 
                @click="generateSuggestions"
                :disabled="isLoading"
              >
                <i data-feather="lightbulb"></i> 生成建议
              </button>
            </div>
          </div>
        </div>

        <!-- 系统健康状况 -->
        <div class="card">
          <div class="card-header">
            <h3>系统健康状况</h3>
          </div>
          <div class="card-content">
            <div class="health-metrics">
              <div class="metric">
                <span class="metric-label">API服务</span>
                <span class="metric-value" :class="healthStatus.api">
                  {{ getStatusText(healthStatus.api) }}
                </span>
              </div>
              <div class="metric">
                <span class="metric-label">邮件服务</span>
                <span class="metric-value" :class="healthStatus.email">
                  {{ getStatusText(healthStatus.email) }}
                </span>
              </div>
              <div class="metric">
                <span class="metric-label">调度器</span>
                <span class="metric-value" :class="healthStatus.scheduler">
                  {{ getStatusText(healthStatus.scheduler) }}
                </span>
              </div>
              <div class="metric">
                <span class="metric-label">AI服务</span>
                <span class="metric-value" :class="healthStatus.ai">
                  {{ getStatusText(healthStatus.ai) }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- 今日提醒状态 -->
        <div class="card">
          <div class="card-header">
            <h3>今日提醒状态</h3>
            <button 
              class="btn btn-small btn-secondary" 
              @click="refreshReminderStatus"
              :disabled="isLoading"
            >
              <i data-feather="refresh-cw"></i> 刷新
            </button>
          </div>
          <div class="card-content">
            <div class="reminder-status">
              <div class="status-item">
                <span class="status-label">
                  <i data-feather="sunrise"></i> 晨间提醒
                </span>
                <span class="status-value" :class="reminderStatus.morning">
                  {{ getReminderStatusText(reminderStatus.morning) }}
                </span>
              </div>
              <div class="status-item">
                <span class="status-label">
                  <i data-feather="sunset"></i> 晚间提醒
                </span>
                <span class="status-value" :class="reminderStatus.evening">
                  {{ getReminderStatusText(reminderStatus.evening) }}
                </span>
              </div>
              <div class="status-item">
                <span class="status-label">
                  <i data-feather="file-text"></i> 工作报告
                </span>
                <span class="status-value" :class="reminderStatus.report">
                  {{ getReminderStatusText(reminderStatus.report) }}
                </span>
              </div>
              <div class="status-actions">
                <button 
                  class="btn btn-small btn-warning" 
                  @click="resetReminderStatus"
                  :disabled="isLoading"
                >
                  <i data-feather="rotate-ccw"></i> 重置状态
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Layout>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, nextTick } from 'vue';
import Layout from '@/components/Layout.vue';
import { apiClient } from '@/utils/api';

const isLoading = ref(false);

const stats = reactive({
  totalUsers: '-',
  emailsSent: '-',
  reportsGenerated: '-',
  systemUptime: '-'
});

const healthStatus = reactive({
  api: 'checking',
  email: 'checking',
  scheduler: 'checking',
  ai: 'checking'
});

const reminderStatus = reactive({
  morning: 'checking',
  evening: 'checking',
  report: 'checking'
});

const getStatusText = (status: string) => {
  const statusMap: Record<string, string> = {
    checking: '检查中...',
    healthy: '正常',
    error: '异常',
    warning: '警告'
  };
  return statusMap[status] || '未知';
};

const getReminderStatusText = (status: string) => {
  const statusMap: Record<string, string> = {
    checking: '检查中...',
    sent: '已发送',
    pending: '待发送',
    failed: '发送失败',
    skipped: '已跳过'
  };
  return statusMap[status] || '未知';
};

const testMorningReminder = async () => {
  if (isLoading.value) return;
  
  isLoading.value = true;
  try {
    const response = await apiClient.testMorningReminder();
    if (response.success) {
      showNotification('晨间提醒测试成功', 'success');
    } else {
      showNotification('晨间提醒测试失败', 'error');
    }
  } catch (error) {
    console.error('晨间提醒测试失败:', error);
    showNotification('网络错误', 'error');
  } finally {
    isLoading.value = false;
  }
};

const testEveningReminder = async () => {
  if (isLoading.value) return;
  
  isLoading.value = true;
  try {
    const response = await apiClient.testEveningReminder();
    if (response.success) {
      showNotification('晚间提醒测试成功', 'success');
    } else {
      showNotification('晚间提醒测试失败', 'error');
    }
  } catch (error) {
    console.error('晚间提醒测试失败:', error);
    showNotification('网络错误', 'error');
  } finally {
    isLoading.value = false;
  }
};

const generateWeeklyReport = async () => {
  if (isLoading.value) return;
  
  isLoading.value = true;
  try {
    const response = await apiClient.generateWeeklyReport();
    if (response.success) {
      showNotification('周报生成成功', 'success');
    } else {
      showNotification('周报生成失败', 'error');
    }
  } catch (error) {
    console.error('周报生成失败:', error);
    showNotification('网络错误', 'error');
  } finally {
    isLoading.value = false;
  }
};

const generateSuggestions = async () => {
  if (isLoading.value) return;
  
  isLoading.value = true;
  try {
    const response = await apiClient.generateSuggestions();
    if (response.success) {
      showNotification('建议生成成功', 'success');
    } else {
      showNotification('建议生成失败', 'error');
    }
  } catch (error) {
    console.error('建议生成失败:', error);
    showNotification('网络错误', 'error');
  } finally {
    isLoading.value = false;
  }
};

const refreshReminderStatus = async () => {
  if (isLoading.value) return;
  
  isLoading.value = true;
  try {
    const response = await apiClient.getReminderStatus();
    if (response.success && response.data) {
      Object.assign(reminderStatus, response.data);
    }
  } catch (error) {
    console.error('Failed to refresh reminder status:', error);
  } finally {
    isLoading.value = false;
  }
};

const resetReminderStatus = async () => {
  if (isLoading.value) return;
  
  if (!confirm('确定要重置今日提醒状态吗？')) {
    return;
  }
  
  isLoading.value = true;
  try {
    const response = await apiClient.resetReminderStatus();
    if (response.success) {
      showNotification('提醒状态重置成功', 'success');
      await refreshReminderStatus();
    } else {
      showNotification('提醒状态重置失败', 'error');
    }
  } catch (error) {
    console.error('提醒状态重置失败:', error);
    showNotification('网络错误', 'error');
  } finally {
    isLoading.value = false;
  }
};

const showNotification = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
  // TODO: 实现通知系统
  console.log(`[${type}] ${message}`);
};

const loadDashboardData = async () => {
  try {
    // 加载统计数据
    const statsResponse = await apiClient.getDashboardStats();
    if (statsResponse.success && statsResponse.data) {
      Object.assign(stats, statsResponse.data);
    }
    
    // 加载健康状态
    const healthResponse = await apiClient.getSystemHealth();
    if (healthResponse.success && healthResponse.data) {
      Object.assign(healthStatus, healthResponse.data);
    }
    
    // 加载提醒状态
    const reminderResponse = await apiClient.getReminderStatus();
    if (reminderResponse.success && reminderResponse.data) {
      Object.assign(reminderStatus, reminderResponse.data);
    }
  } catch (error) {
    console.error('Failed to load dashboard data:', error);
  }
};

onMounted(async () => {
  await loadDashboardData();
  
  // 初始化 Feather icons
  await nextTick();
  if (typeof window !== 'undefined' && window.feather) {
    window.feather.replace();
  }
});
</script>

<style scoped>
.dashboard-page {
  max-width: 1200px;
  margin: 0 auto;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.stat-card {
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  border: 1px solid #e2e8f0;
  display: flex;
  align-items: center;
  gap: 1rem;
}

.stat-icon {
  width: 48px;
  height: 48px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  flex-shrink: 0;
}

.stat-content h3 {
  font-size: 1.875rem;
  font-weight: 700;
  color: #1a202c;
  margin: 0 0 0.25rem 0;
}

.stat-content p {
  color: #64748b;
  font-size: 0.875rem;
  margin: 0;
}

.dashboard-grid {
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
  display: flex;
  justify-content: space-between;
  align-items: center;
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

.quick-actions {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
}

.btn {
  padding: 0.75rem 1rem;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  text-decoration: none;
  border: none;
}

.btn-primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
}

.btn-secondary {
  background: #f8fafc;
  color: #64748b;
  border: 1px solid #e2e8f0;
}

.btn-secondary:hover:not(:disabled) {
  background: #f1f5f9;
  color: #475569;
}

.btn-small {
  padding: 0.5rem 0.75rem;
  font-size: 0.75rem;
}

.btn-warning {
  background: #fef3c7;
  color: #92400e;
  border: 1px solid #fde68a;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.health-metrics {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.metric {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 0;
  border-bottom: 1px solid #f1f5f9;
}

.metric:last-child {
  border-bottom: none;
}

.metric-label {
  font-weight: 500;
  color: #374151;
}

.metric-value {
  font-size: 0.875rem;
  font-weight: 600;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
}

.metric-value.healthy {
  background: #dcfce7;
  color: #166534;
}

.metric-value.error {
  background: #fee2e2;
  color: #991b1b;
}

.metric-value.warning {
  background: #fef3c7;
  color: #92400e;
}

.metric-value.checking {
  background: #f3f4f6;
  color: #6b7280;
}

.reminder-status {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.status-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 0;
  border-bottom: 1px solid #f1f5f9;
}

.status-item:last-child {
  border-bottom: none;
}

.status-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 500;
  color: #374151;
}

.status-value {
  font-size: 0.875rem;
  font-weight: 600;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
}

.status-value.sent {
  background: #dcfce7;
  color: #166534;
}

.status-value.pending {
  background: #fef3c7;
  color: #92400e;
}

.status-value.failed {
  background: #fee2e2;
  color: #991b1b;
}

.status-value.checking {
  background: #f3f4f6;
  color: #6b7280;
}

.status-actions {
  padding-top: 1rem;
  border-top: 1px solid #f1f5f9;
}
</style>