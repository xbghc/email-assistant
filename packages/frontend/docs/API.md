# API 集成指南

## 🌐 API 客户端

### 概述

前端使用类型安全的 API 客户端，具有自动错误处理、身份验证和请求/响应转换功能。

```typescript
// utils/api.ts
import type { ApiResponse, User, SystemHealth } from '@email-assistant/shared';

class ApiClient {
  private baseURL: string;
  private token: string | null = null;

  constructor(baseURL: string = '') {
    this.baseURL = baseURL;
    this.token = localStorage.getItem('authToken');
  }

  // HTTP 方法
  async get<T>(endpoint: string): Promise<ApiResponse<T>>
  async post<T>(endpoint: string, data?: any): Promise<ApiResponse<T>>
  async put<T>(endpoint: string, data?: any): Promise<ApiResponse<T>>
  async delete<T>(endpoint: string): Promise<ApiResponse<T>>
}

export const apiClient = new ApiClient(import.meta.env.VITE_API_BASE_URL);
```

### 配置

API 配置的环境变量：

```bash
# .env.local
VITE_API_BASE_URL=http://localhost:3000
VITE_API_TIMEOUT=10000
```

## 🔧 请求/响应处理

### 请求拦截器

自动请求增强：

```typescript
private async request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  // 添加身份验证头
  if (this.token) {
    headers['Authorization'] = `Bearer ${this.token}`;
  }

  // 添加请求 ID 用于跟踪
  headers['X-Request-ID'] = generateRequestId();

  try {
    const response = await fetch(url, { ...options, headers });
    return await this.handleResponse<T>(response);
  } catch (error) {
    throw this.handleError(error);
  }
}
```

### 错误处理

集中式错误处理，提供用户友好的消息：

```typescript
class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public data?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

private handleError(error: any): ApiError {
  if (error instanceof ApiError) {
    return error;
  }

  // 网络错误
  if (error.name === 'TypeError' && error.message.includes('fetch')) {
    return new ApiError('网络连接失败', 0);
  }

  // 超时错误
  if (error.name === 'AbortError') {
    return new ApiError('请求超时', 408);
  }

  return new ApiError('发生未知错误', 500, error);
}
```

## 🔐 身份验证

### Token 管理

自动 token 处理和刷新：

```typescript
// utils/auth.ts
export class AuthManager {
  setToken(token: string) {
    localStorage.setItem('authToken', token);
    apiClient.setToken(token);
  }

  getToken(): string | null {
    return localStorage.getItem('authToken');
  }

  removeToken() {
    localStorage.removeItem('authToken');
    apiClient.setToken(null);
  }

  isTokenExpired(): boolean {
    const token = this.getToken();
    if (!token) return true;

    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return Date.now() >= payload.exp * 1000;
    } catch {
      return true;
    }
  }
}
```

### 登录流程

```typescript
// composables/useAuth.ts
export function useAuth() {
  const user = ref<User | null>(null);
  const loading = ref(false);

  const login = async (email: string, password: string) => {
    loading.value = true;
    try {
      const response = await apiClient.post<{ token: string; user: User }>('/api/auth/login', {
        email,
        password
      });

      authManager.setToken(response.data.token);
      user.value = response.data.user;
      
      await router.push('/dashboard');
    } catch (error) {
      throw new Error(error.message || '登录失败');
    } finally {
      loading.value = false;
    }
  };

  const logout = async () => {
    try {
      await apiClient.post('/api/auth/logout');
    } catch (error) {
      console.warn('登出请求失败:', error);
    } finally {
      authManager.removeToken();
      user.value = null;
      await router.push('/login');
    }
  };

  return {
    user: readonly(user),
    loading: readonly(loading),
    login,
    logout
  };
}
```

## 📡 API 端点

### 身份验证端点

```typescript
// 认证 API
const authApi = {
  login: (credentials: LoginCredentials) => 
    apiClient.post<AuthResponse>('/api/auth/login', credentials),
    
  logout: () => 
    apiClient.post('/api/auth/logout'),
    
  refresh: () => 
    apiClient.post<AuthResponse>('/api/auth/refresh'),
    
  profile: () => 
    apiClient.get<User>('/api/auth/profile')
};
```

### 用户管理

```typescript
// 用户 API
const userApi = {
  list: (params?: UserListParams) => 
    apiClient.get<User[]>('/api/users', { params }),
    
  get: (id: string) => 
    apiClient.get<User>(`/api/users/${id}`),
    
  create: (userData: CreateUserData) => 
    apiClient.post<User>('/api/users', userData),
    
  update: (id: string, userData: UpdateUserData) => 
    apiClient.put<User>(`/api/users/${id}`, userData),
    
  delete: (id: string) => 
    apiClient.delete(`/api/users/${id}`)
};
```

### 系统管理

```typescript
// 系统 API
const systemApi = {
  health: () => 
    apiClient.get<SystemHealth>('/api/system/health'),
    
  status: () => 
    apiClient.get<SystemStatus>('/api/system/status'),
    
  logs: (params?: LogParams) => 
    apiClient.get<LogEntry[]>('/api/system/logs', { params }),
    
  config: () => 
    apiClient.get<SystemConfig>('/api/system/config'),
    
  updateConfig: (config: Partial<SystemConfig>) => 
    apiClient.put<SystemConfig>('/api/system/config', config)
};
```

## 🔄 实时更新

### WebSocket 连接

使用 WebSocket 进行实时数据更新：

```typescript
// utils/websocket.ts
export class WebSocketClient {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  connect(url: string) {
    this.ws = new WebSocket(url);
    
    this.ws.onopen = () => {
      console.log('WebSocket 已连接');
      this.reconnectAttempts = 0;
    };

    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      this.handleMessage(data);
    };

    this.ws.onclose = () => {
      console.log('WebSocket 已断开');
      this.reconnect();
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket 错误:', error);
    };
  }

  private reconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      setTimeout(() => this.connect(this.url), 1000 * this.reconnectAttempts);
    }
  }
}
```

## 📊 数据获取模式

### 基于 Composable 的数据获取

```typescript
// composables/useUsers.ts
export function useUsers() {
  const users = ref<User[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  const fetchUsers = async (params?: UserListParams) => {
    loading.value = true;
    error.value = null;
    
    try {
      const response = await userApi.list(params);
      users.value = response.data;
    } catch (err) {
      error.value = err.message;
      console.error('获取用户失败:', err);
    } finally {
      loading.value = false;
    }
  };

  const createUser = async (userData: CreateUserData) => {
    try {
      const response = await userApi.create(userData);
      users.value.push(response.data);
      return response.data;
    } catch (err) {
      error.value = err.message;
      throw err;
    }
  };

  return {
    users: readonly(users),
    loading: readonly(loading),
    error: readonly(error),
    fetchUsers,
    createUser
  };
}
```

## 🚨 错误处理

### 全局错误处理器

```typescript
// utils/errorHandler.ts
export class ErrorHandler {
  static handle(error: ApiError) {
    switch (error.status) {
      case 401:
        // 未授权 - 重定向到登录
        authManager.logout();
        router.push('/login');
        break;
        
      case 403:
        // 禁止访问
        this.showError('访问被拒绝');
        break;
        
      case 404:
        // 未找到
        this.showError('资源未找到');
        break;
        
      case 422:
        // 验证错误
        this.showValidationErrors(error.data.errors);
        break;
        
      case 500:
        // 服务器错误
        this.showError('服务器错误');
        break;
        
      default:
        this.showError(error.message || '发生错误');
    }
  }

  static showError(message: string) {
    // 显示提示通知或模态框
    notificationManager.error(message);
  }
}
```

## 🧪 测试 API 集成

### Mock API 客户端

```typescript
// __tests__/mocks/apiClient.ts
export const mockApiClient = {
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
  setToken: vi.fn()
};

// 测试设置
beforeEach(() => {
  vi.clearAllMocks();
});
```

### API 集成测试

```typescript
// __tests__/api/users.test.ts
describe('用户 API 集成', () => {
  it('应该成功获取用户', async () => {
    const mockUsers = [{ id: '1', name: 'John' }];
    mockApiClient.get.mockResolvedValue({ data: mockUsers });

    const { fetchUsers, users } = useUsers();
    await fetchUsers();

    expect(users.value).toEqual(mockUsers);
    expect(mockApiClient.get).toHaveBeenCalledWith('/api/users');
  });

  it('应该处理 API 错误', async () => {
    const errorMessage = '获取失败';
    mockApiClient.get.mockRejectedValue(new ApiError(errorMessage, 500));

    const { fetchUsers, error } = useUsers();
    await fetchUsers();

    expect(error.value).toBe(errorMessage);
  });
});
```

## 📈 性能优化

### 请求缓存

```typescript
// utils/cache.ts
class RequestCache {
  private cache = new Map<string, { data: any; timestamp: number }>();
  private ttl = 5 * 60 * 1000; // 5 分钟

  get(key: string) {
    const item = this.cache.get(key);
    if (!item) return null;

    if (Date.now() - item.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }

    return item.data;
  }

  set(key: string, data: any) {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }
}
```

### 请求去重

```typescript
// 防止重复的并发请求
const pendingRequests = new Map<string, Promise<any>>();

async function dedupedRequest<T>(key: string, requestFn: () => Promise<T>): Promise<T> {
  if (pendingRequests.has(key)) {
    return pendingRequests.get(key);
  }

  const promise = requestFn().finally(() => {
    pendingRequests.delete(key);
  });

  pendingRequests.set(key, promise);
  return promise;
}
```