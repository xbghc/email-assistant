import { ref, readonly } from 'vue';

export interface Notification {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
  duration?: number;
}

const notifications = ref<Notification[]>([]);

let notificationId = 0;

export function useNotifications() {
  const addNotification = (
    message: string,
    type: 'success' | 'error' | 'info' = 'info',
    duration = 5000
  ) => {
    const id = notificationId++;
    notifications.value.push({ id, message, type, duration });

    if (duration) {
      setTimeout(() => {
        removeNotification(id);
      }, duration);
    }
  };

  const removeNotification = (id: number) => {
    const index = notifications.value.findIndex((n) => n.id === id);
    if (index !== -1) {
      notifications.value.splice(index, 1);
    }
  };

  return {
    notifications: readonly(notifications),
    addNotification,
    removeNotification,
  };
}
