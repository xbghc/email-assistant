<template>
  <Layout>
    <div class="system-page">
      <div class="page-header">
        <h2>系统状态监控</h2>
      </div>
      
      <div class="system-grid">
        <!-- 服务状态 -->
        <div class="card">
          <div class="card-header">
            <h3>服务状态</h3>
          </div>
          <div class="card-content">
            <div class="services-list">
              <div 
                v-for="service in services" 
                :key="service.name"
                class="service-item"
              >
                <div class="service-info">
                  <h4>{{ service.name }}</h4>
                  <p>{{ service.description }}</p>
                </div>
                <div class="service-status" :class="service.status">
                  {{ getStatusText(service.status) }}
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <!-- 性能指标 -->
        <div class="card">
          <div class="card-header">
            <h3>性能指标</h3>
          </div>
          <div class="card-content">
            <div class="metrics-list">
              <div 
                v-for="metric in metrics" 
                :key="metric.name"
                class="metric-item"
              >
                <div class="metric-info">
                  <span class="metric-name">{{ metric.name }}</span>
                  <span class="metric-value">{{ metric.value }}</span>
                </div>
                <div class="metric-bar">
                  <div 
                    class="metric-fill" 
                    :style="{ width: metric.percentage + '%' }"
                    :class="getMetricClass(metric.percentage)"
                  ></div>
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
import { ref, onMounted } from 'vue';
import Layout from '@/components/Layout.vue';

const services = ref([
  {
    name: 'API服务',
    description: 'RESTful API服务器',
    status: 'healthy'
  },
  {
    name: '邮件服务',
    description: 'SMTP/IMAP邮件处理',
    status: 'healthy'
  },
  {
    name: 'AI服务',
    description: '人工智能内容生成',
    status: 'warning'
  },
  {
    name: '调度器',
    description: '定时任务调度',
    status: 'healthy'
  }
]);

const metrics = ref([
  {
    name: 'CPU使用率',
    value: '45%',
    percentage: 45
  },
  {
    name: '内存使用率',
    value: '67%',
    percentage: 67
  },
  {
    name: '磁盘使用率',
    value: '23%',
    percentage: 23
  },
  {
    name: '网络延迟',
    value: '12ms',
    percentage: 12
  }
]);

const getStatusText = (status: string) => {
  const statusMap: Record<string, string> = {
    healthy: '正常',
    warning: '警告',
    error: '错误',
    offline: '离线'
  };
  return statusMap[status] || '未知';
};

const getMetricClass = (percentage: number) => {
  if (percentage < 50) return 'good';
  if (percentage < 80) return 'warning';
  return 'danger';
};

onMounted(() => {
  // 模拟数据加载
  console.log('System monitoring loaded');
});
</script>

<style scoped>
.system-page {
  max-width: 1200px;
  margin: 0 auto;
}

.page-header {
  margin-bottom: 2rem;
}

.page-header h2 {
  font-size: 1.5rem;
  font-weight: 600;
  color: #1a202c;
  margin: 0;
}

.system-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(500px, 1fr));
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

.services-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.service-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  background: #f8fafc;
  border-radius: 8px;
}

.service-info h4 {
  font-size: 1rem;
  font-weight: 600;
  color: #1a202c;
  margin: 0 0 0.25rem 0;
}

.service-info p {
  font-size: 0.875rem;
  color: #64748b;
  margin: 0;
}

.service-status {
  padding: 0.5rem 1rem;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 600;
}

.service-status.healthy {
  background: #dcfce7;
  color: #166534;
}

.service-status.warning {
  background: #fef3c7;
  color: #92400e;
}

.service-status.error {
  background: #fee2e2;
  color: #991b1b;
}

.service-status.offline {
  background: #f3f4f6;
  color: #6b7280;
}

.metrics-list {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.metric-item {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.metric-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.metric-name {
  font-weight: 500;
  color: #374151;
}

.metric-value {
  font-weight: 600;
  color: #1a202c;
}

.metric-bar {
  width: 100%;
  height: 8px;
  background: #e5e7eb;
  border-radius: 4px;
  overflow: hidden;
}

.metric-fill {
  height: 100%;
  border-radius: 4px;
  transition: width 0.3s ease;
}

.metric-fill.good {
  background: #10b981;
}

.metric-fill.warning {
  background: #f59e0b;
}

.metric-fill.danger {
  background: #ef4444;
}
</style>