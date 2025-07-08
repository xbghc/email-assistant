import express from 'express';
import { AuthService } from '../services/authService';
import UserService from '../services/userService';
import { authenticate, rateLimit } from '../middleware/authMiddleware';
import { LoginRequest, RegisterRequest } from '../models/User';
import logger from '../utils/logger';

const router = express.Router();

// 初始化服务
let authService: AuthService;
let userService: UserService;

const initServices = async () => {
  if (!userService) {
    userService = new UserService();
    await userService.initialize();
  }
  if (!authService) {
    authService = new AuthService(userService);
  }
};

// 应用速率限制——基础限制
router.use(rateLimit(20, 15 * 60 * 1000)); // 15分钟内最多20次请求

// 用户注册（严格限制）
router.post('/register', rateLimit(3, 60 * 60 * 1000), async (req, res) => {
  try {
    await initServices();
    
    const { email, password, name, timezone }: RegisterRequest = req.body;

    // 验证输入
    if (!email || !password || !name) {
      res.status(400).json({
        success: false,
        error: 'Email, password, and name are required'
      });
      return;
    }

    // 强化密码策略
    if (password.length < 12) {
      res.status(400).json({
        success: false,
        error: 'Password must be at least 12 characters long'
      });
      return;
    }
    
    // 检查密码复杂性
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    
    if (!hasUpperCase || !hasLowerCase || !hasNumbers || !hasSpecialChar) {
      res.status(400).json({
        success: false,
        error: 'Password must contain uppercase, lowercase, numbers, and special characters'
      });
      return;
    }

    // 检查邮箱格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      res.status(400).json({
        success: false,
        error: 'Invalid email format'
      });
      return;
    }

    const authResponse = await authService.register({
      email,
      password,
      name,
      timezone: timezone || 'Asia/Shanghai'
    });

    logger.info(`User registered successfully: ${email}`);

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: authResponse
    });
  } catch (error) {
    logger.error('Registration error:', error);
    
    if (error instanceof Error) {
      if (error.message === 'User already exists with this email') {
        res.status(409).json({
          success: false,
          error: error.message
        });
        return;
      }
    }

    res.status(500).json({
      success: false,
      error: 'Registration failed'
    });
  }
});

// 用户登录（严格限制）
router.post('/login', rateLimit(5, 15 * 60 * 1000), async (req, res) => {
  try {
    await initServices();
    
    const { email, password }: LoginRequest = req.body;

    // 验证输入
    if (!email || !password) {
      res.status(400).json({
        success: false,
        error: 'Email and password are required'
      });
      return;
    }

    const authResponse = await authService.login({ email, password });

    logger.info(`User logged in successfully: ${email}`);

    res.json({
      success: true,
      message: 'Login successful',
      data: authResponse
    });
  } catch (error) {
    logger.error('Login error:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('Invalid email or password') || 
          error.message.includes('Account is deactivated')) {
        res.status(401).json({
          success: false,
          error: error.message
        });
        return;
      }
    }

    res.status(500).json({
      success: false,
      error: 'Login failed'
    });
  }
});

// 刷新Token
router.post('/refresh-token', async (req, res) => {
  try {
    await initServices();
    
    const { token } = req.body;

    if (!token) {
      res.status(400).json({
        success: false,
        error: 'Token is required'
      });
      return;
    }

    const authResponse = await authService.refreshToken(token);

    if (!authResponse) {
      res.status(401).json({
        success: false,
        error: 'Invalid or expired token'
      });
      return;
    }

    res.json({
      success: true,
      message: 'Token refreshed successfully',
      data: authResponse
    });
  } catch (error) {
    logger.error('Token refresh error:', error);
    res.status(500).json({
      success: false,
      error: 'Token refresh failed'
    });
  }
});

// 修改密码（需要认证）
router.post('/change-password', authenticate, async (req, res) => {
  try {
    await initServices();
    
    const { currentPassword, newPassword } = req.body;
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    // 验证输入
    if (!currentPassword || !newPassword) {
      res.status(400).json({
        success: false,
        error: 'Current password and new password are required'
      });
      return;
    }

    // 强化密码策略
    if (newPassword.length < 12) {
      res.status(400).json({
        success: false,
        error: 'New password must be at least 12 characters long'
      });
      return;
    }
    
    // 检查密码复杂性
    const hasUpperCase = /[A-Z]/.test(newPassword);
    const hasLowerCase = /[a-z]/.test(newPassword);
    const hasNumbers = /\d/.test(newPassword);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(newPassword);
    
    if (!hasUpperCase || !hasLowerCase || !hasNumbers || !hasSpecialChar) {
      res.status(400).json({
        success: false,
        error: 'New password must contain uppercase, lowercase, numbers, and special characters'
      });
      return;
    }

    await authService.changePassword(userId, currentPassword, newPassword);

    logger.info(`Password changed for user: ${req.user?.email || 'unknown'}`);

    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    logger.error('Change password error:', error);
    
    if (error instanceof Error) {
      if (error.message === 'Current password is incorrect') {
        res.status(400).json({
          success: false,
          error: error.message
        });
        return;
      }
    }

    res.status(500).json({
      success: false,
      error: 'Password change failed'
    });
  }
});

// 忘记密码 - 生成重置令牌（严格限制）
router.post('/forgot-password', rateLimit(3, 60 * 60 * 1000), async (req, res) => {
  try {
    await initServices();
    
    const { email } = req.body;

    if (!email) {
      res.status(400).json({
        success: false,
        error: 'Email is required'
      });
      return;
    }

    const resetToken = await authService.generatePasswordResetToken(email);

    // 为了安全，总是返回成功消息
    res.json({
      success: true,
      message: 'If the email exists, a password reset link has been sent',
      // 出于安全考虑，不再暴露重置令牌
    });

    if (resetToken) {
      logger.info(`Password reset token generated for email: ${email}`);
    }
  } catch (error) {
    logger.error('Forgot password error:', error);
    res.status(500).json({
      success: false,
      error: 'Password reset request failed'
    });
  }
});

// 重置密码
router.post('/reset-password', async (req, res) => {
  try {
    await initServices();
    
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      res.status(400).json({
        success: false,
        error: 'Reset token and new password are required'
      });
      return;
    }

    // 强化密码策略
    if (newPassword.length < 12) {
      res.status(400).json({
        success: false,
        error: 'New password must be at least 12 characters long'
      });
      return;
    }
    
    // 检查密码复杂性
    const hasUpperCase = /[A-Z]/.test(newPassword);
    const hasLowerCase = /[a-z]/.test(newPassword);
    const hasNumbers = /\d/.test(newPassword);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(newPassword);
    
    if (!hasUpperCase || !hasLowerCase || !hasNumbers || !hasSpecialChar) {
      res.status(400).json({
        success: false,
        error: 'New password must contain uppercase, lowercase, numbers, and special characters'
      });
      return;
    }

    const success = await authService.resetPassword(token, newPassword);

    if (!success) {
      res.status(400).json({
        success: false,
        error: 'Invalid or expired reset token'
      });
      return;
    }

    logger.info('Password reset completed successfully');

    res.json({
      success: true,
      message: 'Password reset successfully'
    });
  } catch (error) {
    logger.error('Reset password error:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('Invalid reset token') || 
          error.message.includes('Reset token has expired')) {
        res.status(400).json({
          success: false,
          error: error.message
        });
        return;
      }
    }

    res.status(500).json({
      success: false,
      error: 'Password reset failed'
    });
  }
});

// 获取当前用户信息（需要认证）
router.get('/me', authenticate, async (req, res) => {
  try {
    await initServices();
    
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }
    const user = userService.getUserById(userId);

    if (!user) {
      res.status(404).json({
        success: false,
        error: 'User not found'
      });
      return;
    }

    // 返回用户信息（不包含密码）
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password: _, ...safeUser } = user;

    res.json({
      success: true,
      data: safeUser
    });
  } catch (error) {
    logger.error('Get user info error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get user information'
    });
  }
});

// 登出（可选 - 客户端删除token即可）
router.post('/logout', authenticate, async (req, res) => {
  try {
    // 在真实应用中，可能需要将token加入黑名单
    // 这里只是返回成功消息
    
    logger.info(`User logged out: ${req.user?.email || 'unknown'}`);

    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    logger.error('Logout error:', error);
    res.status(500).json({
      success: false,
      error: 'Logout failed'
    });
  }
});

// 验证token有效性
router.get('/validate-token', authenticate, async (req, res) => {
  res.json({
    success: true,
    message: 'Token is valid',
    data: {
      userId: req.userId,
      email: req.user?.email || 'unknown',
      role: req.user?.role || 'user'
    }
  });
});

// 初始化系统（创建第一个管理员用户）
router.post('/init', async (req, res) => {
  try {
    await initServices();
    
    // 检查是否已有用户
    const hasUsers = await authService.hasUsers();
    if (hasUsers) {
      res.status(400).json({
        success: false,
        error: 'System is already initialized'
      });
      return;
    }

    const { email, password, name } = req.body;

    if (!email || !password || !name) {
      res.status(400).json({
        success: false,
        error: 'Email, password, and name are required'
      });
      return;
    }

    // 强化密码策略
    if (password.length < 12) {
      res.status(400).json({
        success: false,
        error: 'Password must be at least 12 characters long'
      });
      return;
    }
    
    // 检查密码复杂性
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    
    if (!hasUpperCase || !hasLowerCase || !hasNumbers || !hasSpecialChar) {
      res.status(400).json({
        success: false,
        error: 'Password must contain uppercase, lowercase, numbers, and special characters'
      });
      return;
    }

    const adminUser = await authService.createAdminUser(email, password, name);

    logger.info(`System initialized with admin user: ${email}`);

    res.status(201).json({
      success: true,
      message: 'System initialized successfully',
      data: {
        id: adminUser.id,
        email: adminUser.email,
        name: adminUser.name,
        role: adminUser.role
      }
    });
  } catch (error) {
    logger.error('System initialization error:', error);
    res.status(500).json({
      success: false,
      error: 'System initialization failed'
    });
  }
});

export default router;