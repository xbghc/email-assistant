<template>
  <Layout>
    <div class="logs-page">
      <div class="page-header">
        <h2>系统日志</h2>
        <div class="header-controls">
          <select v-model="selectedLogLevel" @change="filterLogs" class="form-select">
            <option value="all">所有级别</option>
            <option value="error">错误</option>
            <option value="warn">警告</option>
            <option value="info">信息</option>
            <option value="debug">调试</option>
          </select>
          <button class="btn btn-outline" @click="refreshLogs" :disabled="isLoading">
            <i data-feather="refresh-cw"></i> 刷新
          </button>
        </div>
      </div>
      
      <div class="card">
        <div class="card-content">
          <div class="logs-viewer">
            <div v-if="isLoading" class="loading">
              加载日志中...
            </div>
            <div v-else-if="filteredLogs.length === 0" class="empty">
              暂无日志数据
            </div>
            <div v-else class="logs-list">
              <div 
                v-for="log in filteredLogs" 
                :key="log.id"
                class="log-entry"
                :class="log.level"
              >
                <div class="log-header">
                  <span class="log-level" :class="log.level">
                    {{ getLevelText(log.level) }}
                  </span>
                  <span class="log-timestamp">
                    {{ formatTimestamp(log.timestamp) }}
                  </span>
                </div>
                <div class="log-message">
                  {{ log.message }}
                </div>
                <div v-if="log.meta" class="log-meta">
                  <pre>{{ JSON.stringify(log.meta, null, 2) }}</pre>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Layout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue';
import Layout from '@/components/Layout.vue';

interface LogEntry {
  id: string;
  level: 'error' | 'warn' | 'info' | 'debug';
  message: string;
  timestamp: string;
  meta?: unknown;
}

const logs = ref<LogEntry[]>([]);
const isLoading = ref(false);
const selectedLogLevel = ref<string>('all');

const filteredLogs = computed(() => {
  if (selectedLogLevel.value === 'all') {
    return logs.value;
  }
  return logs.value.filter(log => log.level === selectedLogLevel.value);
});

const getLevelText = (level: string) => {
  const levelMap: Record<string, string> = {
    error: '错误',
    warn: '警告',
    info: '信息',
    debug: '调试'
  };
  return levelMap[level] || level;
};

const formatTimestamp = (timestamp: string) => {
  return new Date(timestamp).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
};

const filterLogs = () => {
  // 过滤逻辑已经在computed中实现
  console.log('Filter logs by level:', selectedLogLevel.value);
};

const refreshLogs = async () => {
  await loadLogs();
};

const loadLogs = async () => {
  isLoading.value = true;
  try {
    // 模拟API调用
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 模拟日志数据
    logs.value = [
      {
        id: '1',
        level: 'info',
        message: '邮件服务启动成功',
        timestamp: new Date(Date.now() - 60000).toISOString()
      },
      {
        id: '2',
        level: 'warn',
        message: 'AI服务响应时间较慢',
        timestamp: new Date(Date.now() - 120000).toISOString(),
        meta: { responseTime: 5000, threshold: 3000 }
      },
      {
        id: '3',
        level: 'error',
        message: 'SMTP连接失败',
        timestamp: new Date(Date.now() - 180000).toISOString(),
        meta: { 
          error: 'Connection refused',
          host: 'smtp.gmail.com',
          port: 587 
        }
      },
      {
        id: '4',
        level: 'debug',
        message: '用户认证检查',
        timestamp: new Date(Date.now() - 240000).toISOString(),
        meta: { userId: 'user123', result: 'success' }
      },
      {
        id: '5',
        level: 'info',
        message: '晨间提醒发送成功',
        timestamp: new Date(Date.now() - 300000).toISOString(),
        meta: { recipients: 5, template: 'morning_reminder' }
      }
    ];
  } catch (error) {
    console.error('Failed to load logs:', error);
  } finally {
    isLoading.value = false;
  }
};

onMounted(async () => {
  await loadLogs();
  
  // 初始化 Feather icons
  await nextTick();
  if (typeof window !== 'undefined' && window.feather) {
    window.feather.replace();
  }
});
</script>

<style scoped>
.logs-page {
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

.header-controls {
  display: flex;
  gap: 1rem;
  align-items: center;
}

.form-select {
  padding: 0.5rem 1rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 0.875rem;
  background: white;
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

.btn-outline {
  background: transparent;
  border: 1px solid #e2e8f0;
  color: #64748b;
}

.btn:hover:not(:disabled) {
  background: #f8fafc;
  border-color: #cbd5e1;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.card {
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  border: 1px solid #e2e8f0;
}

.card-content {
  padding: 0;
}

.logs-viewer {
  height: 600px;
  overflow-y: auto;
}

.loading,
.empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 200px;
  color: #9ca3af;
  font-style: italic;
}

.logs-list {
  display: flex;
  flex-direction: column;
}

.log-entry {
  padding: 1rem 1.5rem;
  border-bottom: 1px solid #f1f5f9;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 0.875rem;
}

.log-entry:hover {
  background: #f8fafc;
}

.log-entry.error {
  border-left: 4px solid #ef4444;
}

.log-entry.warn {
  border-left: 4px solid #f59e0b;
}

.log-entry.info {
  border-left: 4px solid #3b82f6;
}

.log-entry.debug {
  border-left: 4px solid #6b7280;
}

.log-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.log-level {
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
}

.log-level.error {
  background: #fee2e2;
  color: #991b1b;
}

.log-level.warn {
  background: #fef3c7;
  color: #92400e;
}

.log-level.info {
  background: #dbeafe;
  color: #1e40af;
}

.log-level.debug {
  background: #f3f4f6;
  color: #6b7280;
}

.log-timestamp {
  color: #6b7280;
  font-size: 0.75rem;
}

.log-message {
  color: #374151;
  margin-bottom: 0.5rem;
  line-height: 1.5;
}

.log-meta {
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 4px;
  padding: 0.75rem;
  margin-top: 0.5rem;
}

.log-meta pre {
  margin: 0;
  color: #6b7280;
  font-size: 0.75rem;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>