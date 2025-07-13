import type { AppState, User } from '../types/index';

class StateManager {
  private state: AppState;
  private listeners: Array<(state: AppState) => void> = [];

  constructor() {
    this.state = {
      currentPage: 'dashboard',
      data: {
        users: [],
        systemStats: {
          services: [],
          metrics: {
            memoryUsage: { heapUsed: 0, heapTotal: 0 },
            cpuUsage: { user: 0, system: 0 },
            uptime: 0,
            version: '',
            emailsToday: 0,
            errorsLastHour: 0,
            warningsLastHour: 0
          },
          timestamp: '',
          overall: 'unknown'
        },
        logs: [],
        settings: {}
      },
      auth: {
        token: localStorage.getItem('authToken'),
        user: null
      }
    };
  }

  // 获取当前状态
  getState(): AppState {
    return { ...this.state };
  }

  // 订阅状态变化
  subscribe(listener: (state: AppState) => void): () => void {
    this.listeners.push(listener);
    
    // 返回取消订阅函数
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  // 更新状态
  private updateState(newState: Partial<AppState>): void {
    this.state = { ...this.state, ...newState };
    this.notifyListeners();
  }

  // 通知监听者
  private notifyListeners(): void {
    this.listeners.forEach(listener => listener(this.state));
  }

  // 设置当前页面
  setCurrentPage(page: string): void {
    this.updateState({ currentPage: page });
  }

  // 设置认证信息
  setAuth(token: string | null, user: User | null): void {
    this.updateState({
      auth: { token, user }
    });
  }

  // 设置用户数据
  setUsers(users: User[]): void {
    this.updateState({
      data: { ...this.state.data, users }
    });
  }

  // 添加用户
  addUser(user: User): void {
    const users = [...this.state.data.users, user];
    this.setUsers(users);
  }

  // 更新用户
  updateUser(userId: string, updatedUser: Partial<User>): void {
    const users = this.state.data.users.map(user =>
      user.id === userId ? { ...user, ...updatedUser } : user
    );
    this.setUsers(users);
  }

  // 删除用户
  removeUser(userId: string): void {
    const users = this.state.data.users.filter(user => user.id !== userId);
    this.setUsers(users);
  }

  // 设置系统统计
  setSystemStats(systemStats: any): void {
    this.updateState({
      data: { ...this.state.data, systemStats }
    });
  }

  // 设置日志
  setLogs(logs: any[]): void {
    this.updateState({
      data: { ...this.state.data, logs }
    });
  }

  // 设置设置
  setSettings(settings: any): void {
    this.updateState({
      data: { ...this.state.data, settings }
    });
  }

  // 清空所有数据
  clearData(): void {
    this.updateState({
      data: {
        users: [],
        systemStats: {
          services: [],
          metrics: {
            memoryUsage: { heapUsed: 0, heapTotal: 0 },
            cpuUsage: { user: 0, system: 0 },
            uptime: 0,
            version: '',
            emailsToday: 0,
            errorsLastHour: 0,
            warningsLastHour: 0
          },
          timestamp: '',
          overall: 'unknown'
        },
        logs: [],
        settings: {}
      },
      auth: {
        token: null,
        user: null
      }
    });
  }
}

// 导出单例实例
export const stateManager = new StateManager();
export default stateManager;