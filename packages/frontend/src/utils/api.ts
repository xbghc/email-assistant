import type { ApiResponse, User, SystemHealth, AuthResponse, SendCodeRequest, VerifyCodeRequest } from '@email-assistant/shared';
import type { SystemStatus, LogEntry, Report } from '../types';

class ApiClient {
  private baseURL: string;
  private token: string | null = null;

  constructor(baseURL: string = '') {
    this.baseURL = baseURL;
    this.token = localStorage.getItem('authToken');
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseURL}${endpoint}`;
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  }

  // 认证相关
  async sendCode(email: string): Promise<ApiResponse<void>> {
    const request: SendCodeRequest = { email };
    return this.request<void>('/api/auth/send-code', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async verifyCode(email: string, code: string): Promise<ApiResponse<AuthResponse>> {
    const request: VerifyCodeRequest = { email, code };
    const response = await this.request<AuthResponse>('/api/auth/verify-code', {
      method: 'POST',
      body: JSON.stringify(request),
    });

    if (response.success && response.data) {
      this.token = response.data.token;
      localStorage.setItem('authToken', this.token || '');
    }

    return response;
  }

  logout(): void {
    this.token = null;
    localStorage.removeItem('authToken');
  }

  // 用户管理
  async getUsers(): Promise<ApiResponse<User[]>> {
    return this.request<User[]>('/api/users');
  }

  async createUser(userData: Partial<User>): Promise<ApiResponse<User>> {
    return this.request<User>('/api/users', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  }

  async updateUser(userId: string, userData: Partial<User>): Promise<ApiResponse<User>> {
    return this.request<User>(`/api/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(userData),
    });
  }

  async deleteUser(userId: string): Promise<ApiResponse<void>> {
    return this.request<void>(`/api/users/${userId}`, {
      method: 'DELETE',
    });
  }

  // 系统状态
  async getSystemHealth(): Promise<ApiResponse<SystemHealth>> {
    return this.request<SystemHealth>('/api/health');
  }

  async getDashboardStats(): Promise<ApiResponse<SystemStatus>> {
    return this.request<SystemStatus>('/api/dashboard/stats');
  }

  // 日志管理
  async getLogs(params?: {
    level?: string;
    limit?: number;
    search?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<ApiResponse<LogEntry[]>> {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.append(key, value.toString());
        }
      });
    }

    const endpoint = `/api/logs${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
    return this.request<LogEntry[]>(endpoint);
  }

  async getLogStats(hours: number = 24): Promise<ApiResponse<Record<string, number>>> {
    return this.request<Record<string, number>>(`/api/logs/stats?hours=${hours}`);
  }

  // 报告管理
  async getReports(params?: {
    type?: string;
    userId?: string;
    limit?: number;
  }): Promise<ApiResponse<Report[]>> {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.append(key, value.toString());
        }
      });
    }

    const endpoint = `/api/reports${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
    return this.request<Report[]>(endpoint);
  }

  async getReport(reportId: string): Promise<ApiResponse<Report>> {
    return this.request<Report>(`/api/reports/${reportId}`);
  }

  // 设置管理
  async getSettings(): Promise<ApiResponse<Record<string, unknown>>> {
    return this.request<Record<string, unknown>>('/api/settings');
  }

  async updateSettings(settings: Record<string, unknown>): Promise<ApiResponse<void>> {
    return this.request<void>('/api/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  }

  // 提醒状态
  async getReminderStatus(userId?: string): Promise<ApiResponse<Record<string, unknown>>> {
    const endpoint = userId ? `/api/reminder-status?userId=${userId}` : '/api/reminder-status';
    return this.request<Record<string, unknown>>(endpoint);
  }

  async resetReminderStatus(userId?: string): Promise<ApiResponse<void>> {
    return this.request<void>('/api/reminder-status/reset', {
      method: 'POST',
      body: JSON.stringify({ userId }),
    });
  }

  // 邮件趋势
  async getEmailTrends(days: number = 7): Promise<ApiResponse<Record<string, unknown>>> {
    return this.request<Record<string, unknown>>(`/api/email-trends?days=${days}`);
  }

  // 性能监控
  async getPerformanceMetrics(): Promise<ApiResponse<Record<string, unknown>>> {
    return this.request<Record<string, unknown>>('/api/performance/metrics');
  }

  async getPerformanceAlerts(): Promise<ApiResponse<Record<string, unknown>>> {
    return this.request<Record<string, unknown>>('/api/performance/alerts');
  }

  async resolveAlert(alertId: string): Promise<ApiResponse<void>> {
    return this.request<void>(`/api/performance/alerts/${alertId}/resolve`, {
      method: 'POST',
    });
  }

  // 快速操作API
  async testMorningReminder(): Promise<ApiResponse<void>> {
    return this.request<void>('/api/reminders/test/morning', {
      method: 'POST',
    });
  }

  async testEveningReminder(): Promise<ApiResponse<void>> {
    return this.request<void>('/api/reminders/test/evening', {
      method: 'POST',
    });
  }

  async generateWeeklyReport(): Promise<ApiResponse<void>> {
    return this.request<void>('/api/reports/generate/weekly', {
      method: 'POST',
    });
  }

  async generateSuggestions(): Promise<ApiResponse<void>> {
    return this.request<void>('/api/reports/generate/suggestions', {
      method: 'POST',
    });
  }
}

// 导出单例实例
export const apiClient = new ApiClient();
export default apiClient;