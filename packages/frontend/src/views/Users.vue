<template>
  <Layout>
    <div class="users-page">
      <div class="page-header">
        <h2>用户管理</h2>
        <button class="btn btn-primary" @click="showAddUserModal = true">
          <i data-feather="plus"></i> 添加用户
        </button>
      </div>
      
      <div class="card">
        <div class="card-content">
          <div class="table-container">
            <table class="data-table">
              <thead>
                <tr>
                  <th>用户ID</th>
                  <th>姓名</th>
                  <th>邮箱</th>
                  <th>状态</th>
                  <th>角色</th>
                  <th>创建时间</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="isLoading">
                  <td colspan="7" class="loading">加载中...</td>
                </tr>
                <tr v-else-if="users.length === 0">
                  <td colspan="7" class="empty">暂无用户数据</td>
                </tr>
                <tr v-else v-for="user in users" :key="user.id">
                  <td>{{ user.id }}</td>
                  <td>{{ user.name }}</td>
                  <td>{{ user.email }}</td>
                  <td>
                    <span 
                      class="status-badge" 
                      :class="getActiveStatusInfo(user.isActive).class"
                    >
                      {{ getActiveStatusInfo(user.isActive).text }}
                    </span>
                  </td>
                  <td>{{ user.role }}</td>
                  <td>{{ formatDate(user.createdAt) }}</td>
                  <td>
                    <div class="action-buttons">
                      <button class="btn btn-small btn-outline" @click="editUser(user)">
                        <i data-feather="edit"></i> 编辑
                      </button>
                      <button class="btn btn-small btn-danger" @click="deleteUser(user)">
                        <i data-feather="trash"></i> 删除
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

    <!-- 添加用户模态框 -->
    <Modal v-model="showAddUserModal" title="添加新用户">
      <form @submit.prevent="addUser" class="form">
        <div class="form-group">
          <label for="user-name">用户姓名</label>
          <input 
            v-model="newUser.name"
            type="text" 
            id="user-name" 
            class="form-input" 
            required
          >
        </div>
        <div class="form-group">
          <label for="user-email">邮箱地址</label>
          <input 
            v-model="newUser.email"
            type="email" 
            id="user-email" 
            class="form-input" 
            required
          >
        </div>
        <div class="form-group">
          <label for="user-role">用户角色</label>
          <select v-model="newUser.role" id="user-role" class="form-select">
            <option value="User">普通用户</option>
            <option value="Admin">管理员</option>
          </select>
        </div>
        <div class="form-group">
          <label for="user-timezone">时区</label>
          <select v-if="newUser.config" v-model="newUser.config.schedule.timezone" id="user-timezone" class="form-select">
            <option value="Asia/Shanghai">亚洲/上海</option>
            <option value="America/New_York">美国/纽约</option>
            <option value="Europe/London">欧洲/伦敦</option>
          </select>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-outline" @click="showAddUserModal = false">
            取消
          </button>
          <button type="submit" class="btn btn-primary" :disabled="isSubmitting">
            {{ isSubmitting ? '添加中...' : '添加用户' }}
          </button>
        </div>
      </form>
    </Modal>
  </Layout>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, nextTick } from 'vue';
import Layout from '@/components/Layout.vue';
import Modal from '@/components/Modal.vue';
import { apiClient } from '@/utils/api';
import type { User } from '@email-assistant/shared';
import { useNotifications } from '@/composables/useNotifications';

const { addNotification } = useNotifications();
const users = ref<User[]>([]);
const isLoading = ref(false);
const isSubmitting = ref(false);
const showAddUserModal = ref(false);

const createInitialNewUser = (): Partial<User> => ({
  name: '',
  email: '',
  role: 'user',
  config: {
    schedule: {
      morningReminderTime: '09:00',
      eveningReminderTime: '18:00',
      timezone: 'Asia/Shanghai'
    },
    language: 'zh'
  }
});

const newUser = reactive<Partial<User>>(createInitialNewUser());

const getActiveStatusInfo = (isActive: boolean) => {
  if (isActive) {
    return { text: '活跃', class: 'active' };
  }
  return { text: '非活跃', class: 'inactive' };
};

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('zh-CN');
};

const loadUsers = async () => {
  isLoading.value = true;
  try {
    const response = await apiClient.getUsers();
    if (response.success && response.data) {
      users.value = response.data;
    } else {
      addNotification(response.error || '加载用户列表失败', 'error');
    }
  } catch {
    addNotification('网络错��，无法加载用户', 'error');
  } finally {
    isLoading.value = false;
  }
};

const addUser = async () => {
  if (isSubmitting.value) return;
  
  isSubmitting.value = true;
  try {
    const response = await apiClient.createUser(newUser);
    if (response.success) {
      addNotification('用户添加成功', 'success');
      showAddUserModal.value = false;
      Object.assign(newUser, createInitialNewUser());
      await loadUsers();
    } else {
      addNotification(response.error || '添加用户失败', 'error');
    }
  } catch {
    addNotification('网络错误，无法添加用户', 'error');
  } finally {
    isSubmitting.value = false;
  }
};

const editUser = (user: User) => {
  // TODO: 实现编辑用户功能
  addNotification(`编辑功能待实现: ${user.name}`, 'info');
};

const deleteUser = async (user: User) => {
  if (!confirm(`确定要删除用户 ${user.name} (${user.email}) 吗？`)) {
    return;
  }
  
  try {
    const response = await apiClient.deleteUser(user.id);
    if (response.success) {
      addNotification('用户删除成功', 'success');
      await loadUsers();
    } else {
      addNotification(response.error || '删除用户失败', 'error');
    }
  } catch {
    addNotification('网络错误，无法删除用户', 'error');
  }
};

onMounted(async () => {
  await loadUsers();
  
  // 初始化 Feather icons
  await nextTick();
  if (typeof window !== 'undefined' && window.feather) {
    window.feather.replace();
  }
});
</script>

<style scoped>
.users-page {
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

.card {
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  border: 1px solid #e2e8f0;
}

.card-content {
  padding: 0;
}

.table-container {
  overflow-x: auto;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
}

.data-table th,
.data-table td {
  padding: 1rem;
  text-align: left;
  border-bottom: 1px solid #e2e8f0;
}

.data-table th {
  background: #f8fafc;
  font-weight: 600;
  color: #374151;
  font-size: 0.875rem;
}

.data-table td {
  color: #64748b;
  font-size: 0.875rem;
}

.data-table tr:hover {
  background: #f8fafc;
}

.loading,
.empty {
  text-align: center;
  color: #9ca3af;
  font-style: italic;
}

.status-badge {
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 500;
}

.status-badge.active {
  background: #dcfce7;
  color: #166534;
}

.status-badge.inactive {
  background: #f3f4f6;
  color: #6b7280;
}

.status-badge.suspended {
  background: #fee2e2;
  color: #991b1b;
}

.action-buttons {
  display: flex;
  gap: 0.5rem;
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

.form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
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

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
  margin-top: 1.5rem;
  padding-top: 1.5rem;
  border-top: 1px solid #e2e8f0;
}
</style>