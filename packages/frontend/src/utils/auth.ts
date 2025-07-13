import { apiClient } from './api';
import type { User, AuthResponse } from '@email-assistant/shared';

class AuthManager {
  constructor() {
    this.initializeAuth();
  }

  private user: User | null = null;

  // 初始化认证状态
  private initializeAuth(): void {
    const token = localStorage.getItem('authToken');
    if (token) {
      // 可以在这里验证token有效性
    }
  }

  // 检查是否已认证
  isAuthenticated(): boolean {
    return !!localStorage.getItem('authToken');
  }

  // 获取当前用户
  getCurrentUser(): User | null {
    return this.user;
  }

  // 发送验证码
  async sendCode(email: string): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await apiClient.sendCode(email);

      if (response.success) {
        return { success: true };
      } else {
        return { success: false, error: response.error || 'Failed to send verification code' };
      }
    } catch {
      return { success: false, error: 'Network error' };
    }
  }

  // 验证码登录
  async verifyCode(email: string, code: string): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await apiClient.verifyCode(email, code);

      if (response.success && response.data) {
        const authData = response.data as AuthResponse;
        this.user = authData.user;
        localStorage.setItem('authToken', authData.token);
        return { success: true };
      } else {
        return { success: false, error: response.error || 'Verification failed' };
      }
    } catch {
      return { success: false, error: 'Network error' };
    }
  }

  // 登出
  logout(): void {
    apiClient.logout();
    this.user = null;
    this.redirectToLogin();
  }

  // 重定向到登录页
  redirectToLogin(): void {
    window.location.href = '/login';
  }

  // 检查认证状态，如果未认证则重定向
  requireAuth(): boolean {
    if (!this.isAuthenticated()) {
      this.redirectToLogin();
      return false;
    }
    return true;
  }

  // 获取当前token
  getToken(): string | null {
    return localStorage.getItem('authToken');
  }

  // 验证token有效性
  async validateToken(): Promise<boolean> {
    try {
      // 通过调用需要认证的API来验证token
      const response = await apiClient.getDashboardStats();
      return response.success;
    } catch {
      this.logout();
      return false;
    }
  }
}

// 导出单例实例
export const authManager = new AuthManager();
export const AuthService = AuthManager;
export default authManager;
