<template>
  <Layout>
    <div class="reports-page">
      <div class="page-header">
        <h2>报告管理</h2>
        <div class="header-controls">
          <select v-model="selectedReportType" class="form-select">
            <option value="weekly">周报</option>
            <option value="suggestions">个性化建议</option>
          </select>
          <button class="btn btn-primary" @click="generateReports" :disabled="isGenerating">
            <i data-feather="play"></i> 
            {{ isGenerating ? '生成中...' : '生成报告' }}
          </button>
        </div>
      </div>
      
      <div class="card">
        <div class="card-content">
          <div class="reports-container">
            <div v-if="isLoading" class="loading">
              加载报告中...
            </div>
            <div v-else-if="reports.length === 0" class="empty">
              暂无报告数据
            </div>
            <div v-else class="reports-list">
              <div 
                v-for="report in reports" 
                :key="report.id"
                class="report-item"
              >
                <div class="report-header">
                  <h3>{{ report.title }}</h3>
                  <div class="report-meta">
                    <span class="report-type">{{ getReportTypeText(report.type) }}</span>
                    <span class="report-date">{{ formatDate(report.created_at) }}</span>
                  </div>
                </div>
                <div class="report-content">
                  <p>{{ report.summary }}</p>
                </div>
                <div class="report-actions">
                  <button class="btn btn-small btn-outline" @click="viewReport(report)">
                    <i data-feather="eye"></i> 查看
                  </button>
                  <button class="btn btn-small btn-outline" @click="downloadReport(report)">
                    <i data-feather="download"></i> 下载
                  </button>
                  <button class="btn btn-small btn-danger" @click="deleteReport(report)">
                    <i data-feather="trash"></i> 删除
                  </button>
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
import { ref, onMounted, nextTick } from 'vue';
import Layout from '@/components/Layout.vue';

interface Report {
  id: string;
  title: string;
  type: 'weekly' | 'suggestions';
  summary: string;
  created_at: string;
  content: string;
}

const reports = ref<Report[]>([]);
const isLoading = ref(false);
const isGenerating = ref(false);
const selectedReportType = ref<'weekly' | 'suggestions'>('weekly');

const getReportTypeText = (type: string) => {
  const typeMap: Record<string, string> = {
    weekly: '周报',
    suggestions: '个性化建议'
  };
  return typeMap[type] || type;
};

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const generateReports = async () => {
  if (isGenerating.value) return;
  
  isGenerating.value = true;
  try {
    // 模拟API调用
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 添加新报告到列表
    const newReport: Report = {
      id: Date.now().toString(),
      title: selectedReportType.value === 'weekly' ? '本周工作总结' : '个性化建议报告',
      type: selectedReportType.value,
      summary: '这是一个示例报告摘要...',
      created_at: new Date().toISOString(),
      content: '详细报告内容...'
    };
    
    reports.value.unshift(newReport);
    
    // 更新 Feather icons
    await nextTick();
    if (typeof window !== 'undefined' && window.feather) {
      window.feather.replace();
    }
  } catch (error) {
    console.error('Failed to generate report:', error);
  } finally {
    isGenerating.value = false;
  }
};

const viewReport = (report: Report) => {
  // TODO: 实现查看报告功能
  console.log('View report:', report);
};

const downloadReport = (report: Report) => {
  // TODO: 实现下载报告功能
  console.log('Download report:', report);
};

const deleteReport = async (report: Report) => {
  if (!confirm(`确定要删除报告 "${report.title}" 吗？`)) {
    return;
  }
  
  try {
    reports.value = reports.value.filter(r => r.id !== report.id);
  } catch (error) {
    console.error('Failed to delete report:', error);
  }
};

const loadReports = async () => {
  isLoading.value = true;
  try {
    // 模拟API调用
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 模拟数据
    reports.value = [
      {
        id: '1',
        title: '2024年第1周工作总结',
        type: 'weekly',
        summary: '本周完成了系统优化和用户体验改进工作...',
        created_at: '2024-01-07T10:00:00Z',
        content: '详细内容...'
      },
      {
        id: '2',
        title: '个性化建议报告',
        type: 'suggestions',
        summary: '基于用户行为分析，提供以下建议...',
        created_at: '2024-01-06T15:30:00Z',
        content: '详细内容...'
      }
    ];
  } catch (error) {
    console.error('Failed to load reports:', error);
  } finally {
    isLoading.value = false;
  }
};

onMounted(async () => {
  await loadReports();
  
  // 初始化 Feather icons
  await nextTick();
  if (typeof window !== 'undefined' && window.feather) {
    window.feather.replace();
  }
});
</script>

<style scoped>
.reports-page {
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

.btn-primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.btn-outline {
  background: transparent;
  border: 1px solid #e2e8f0;
  color: #64748b;
}

.btn-danger {
  background: #fee2e2;
  color: #991b1b;
  border: 1px solid #fecaca;
}

.btn-small {
  padding: 0.375rem 0.75rem;
  font-size: 0.75rem;
}

.btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.card {
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  border: 1px solid #e2e8f0;
}

.card-content {
  padding: 1.5rem;
}

.reports-container {
  min-height: 400px;
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

.reports-list {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.report-item {
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 1.5rem;
  background: #f8fafc;
}

.report-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1rem;
}

.report-header h3 {
  font-size: 1.125rem;
  font-weight: 600;
  color: #1a202c;
  margin: 0;
}

.report-meta {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  text-align: right;
}

.report-type {
  padding: 0.25rem 0.5rem;
  background: #e0e7ff;
  color: #3730a3;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 500;
}

.report-date {
  font-size: 0.75rem;
  color: #6b7280;
}

.report-content {
  margin-bottom: 1rem;
}

.report-content p {
  color: #64748b;
  margin: 0;
  line-height: 1.5;
}

.report-actions {
  display: flex;
  gap: 0.5rem;
}
</style>