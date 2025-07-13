import express, { Router } from 'express';
import { AuthService } from '../services/user/authService';
import UserService from '../services/user/userService';
import EmailService from '../services/email/emailService';
import { authenticate, rateLimit } from '../middleware/authMiddleware';
import { SendCodeRequest, VerifyCodeRequest, RegisterRequest } from '../models/User';
import logger from '../utils/logger';

const router: Router = express.Router();

// 初始化服务
let authService: AuthService;
let userService: UserService;
let emailService: EmailService;

const initServices = async () => {
  if (!userService) {
    userService = new UserService();
    await userService.initialize();
  }
  if (!emailService) {
    emailService = new EmailService();
    await emailService.initialize();
  }
  if (!authService) {
    authService = new AuthService(userService, emailService);
  }
};

// 应用速率限制——基础限制
router.use(rateLimit(20, 15 * 60 * 1000)); // 15分钟内最多20次请求

// 用户注册（严格限制）
router.post('/register', rateLimit(3, 60 * 60 * 1000), async (req, res) => {
  try {
    await initServices();
    
    const { email, name, timezone }: RegisterRequest = req.body;

    // 验证输入
    if (!email || !name) {
      res.status(400).json({
        success: false,
        error: 'Email and name are required'
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

    const user = await authService.register({
      email,
      name,
      timezone: timezone || 'Asia/Shanghai'
    });

    logger.info(`User registered successfully: ${email}`);

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      }
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

// 发送验证码（严格限制）
router.post('/send-code', rateLimit(5, 15 * 60 * 1000), async (req, res) => {
  try {
    await initServices();
    
    const { email }: SendCodeRequest = req.body;

    // 验证输入
    if (!email) {
      res.status(400).json({
        success: false,
        error: 'Email is required'
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

    await authService.sendVerificationCode({ email });

    logger.info(`Verification code requested for: ${email}`);

    res.json({
      success: true,
      message: 'Verification code sent successfully'
    });
  } catch (error) {
    logger.error('Send code error:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('User not found') || 
          error.message.includes('Account is deactivated') ||
          error.message.includes('Please wait')) {
        res.status(400).json({
          success: false,
          error: error.message
        });
        return;
      }
    }

    res.status(500).json({
      success: false,
      error: 'Failed to send verification code'
    });
  }
});

// 验证码登录（严格限制）
router.post('/verify-code', rateLimit(5, 15 * 60 * 1000), async (req, res) => {
  try {
    await initServices();
    
    const { email, code }: VerifyCodeRequest = req.body;

    // 验证输入
    if (!email || !code) {
      res.status(400).json({
        success: false,
        error: 'Email and verification code are required'
      });
      return;
    }

    const authResponse = await authService.verifyCodeAndLogin({ email, code });

    logger.info(`User logged in successfully with code: ${email}`);

    res.json({
      success: true,
      message: 'Login successful',
      data: authResponse
    });
  } catch (error) {
    logger.error('Verify code error:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('User not found') || 
          error.message.includes('Account is deactivated') ||
          error.message.includes('verification code') ||
          error.message.includes('expired') ||
          error.message.includes('Invalid') ||
          error.message.includes('Too many')) {
        res.status(400).json({
          success: false,
          error: error.message
        });
        return;
      }
    }

    res.status(500).json({
      success: false,
      error: 'Verification failed'
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

    // 返回用户信息

    res.json({
      success: true,
      data: user
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


export default router;