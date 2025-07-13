<template>
  <div class="notification-container">
    <transition-group name="notification" tag="div">
      <div
        v-for="notification in notifications"
        :key="notification.id"
        :class="['notification', `notification-${notification.type}`]"
      >
        <div class="notification-content">
          <i :data-feather="getIcon(notification.type)" class="notification-icon"></i>
          <span>{{ notification.message }}</span>
        </div>
        <button @click="removeNotification(notification.id)" class="close-button">
          <i data-feather="x"></i>
        </button>
      </div>
    </transition-group>
  </div>
</template>

<script setup lang="ts">
import { onMounted, watch, nextTick } from 'vue';
import { useNotifications } from '@/composables/useNotifications';

const { notifications, removeNotification } = useNotifications();

const getIcon = (type: 'success' | 'error' | 'info') => {
  switch (type) {
    case 'success':
      return 'check-circle';
    case 'error':
      return 'alert-circle';
    case 'info':
      return 'info';
    default:
      return 'info';
  }
};

const replaceFeatherIcons = () => {
  nextTick(() => {
    if (typeof window !== 'undefined' && window.feather) {
      window.feather.replace();
    }
  });
};

watch(notifications, replaceFeatherIcons, { deep: true });

onMounted(() => {
  replaceFeatherIcons();
});
</script>

<style scoped>
.notification-container {
  position: fixed;
  top: 1rem;
  right: 1rem;
  z-index: 1000;
  width: 350px;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.notification {
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem;
  border-left: 4px solid;
  transition: all 0.5s ease;
}

.notification-success {
  border-left-color: #4ade80; /* green-400 */
}
.notification-error {
  border-left-color: #f87171; /* red-400 */
}
.notification-info {
  border-left-color: #60a5fa; /* blue-400 */
}

.notification-content {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.notification-icon {
  width: 20px;
  height: 20px;
}

.notification-success .notification-icon {
  color: #22c55e; /* green-500 */
}
.notification-error .notification-icon {
  color: #ef4444; /* red-500 */
}
.notification-info .notification-icon {
  color: #3b82f6; /* blue-500 */
}

.close-button {
  background: transparent;
  border: none;
  cursor: pointer;
  color: #9ca3af; /* gray-400 */
  padding: 0;
}
.close-button:hover {
  color: #4b5563; /* gray-600 */
}
.close-button i {
  width: 16px;
  height: 16px;
}

.notification-enter-active,
.notification-leave-active {
  transition: all 0.5s ease;
}
.notification-enter-from,
.notification-leave-to {
  opacity: 0;
  transform: translateX(100%);
}
</style>
