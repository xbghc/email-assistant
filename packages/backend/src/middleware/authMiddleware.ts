import { Request, Response, NextFunction, RequestHandler } from 'express';
import { AuthService } from '../services/user/authService';
import UserService from '../services/user/userService';
import EmailService from '../services/email/emailService';
import { UserRole, JWTPayload } from '../models/User';
import logger from '../utils/logger';

// 扩展Express Request接口以包含用户信息
declare global {
  /* eslint-disable @typescript-eslint/no-namespace */
  namespace Express {
    interface Request {
      user?: JWTPayload;
      userId?: string;
      userRole?: UserRole;
    }
  }
  /* eslint-enable @typescript-eslint/no-namespace */
}

// 为速率限制中间件定义一个带有清理功能的新类型
interface RateLimitMiddleware extends RequestHandler {
  cleanup?: () => void;
}

export class AuthMiddleware {
  private authService: AuthService;

  constructor() {
    const userService = new UserService();
    const emailService = new EmailService();
    this.authService = new AuthService(userService, emailService);
  }

  // 验证JWT token
  authenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        // 如果是HTML页面请求，重定向到登录页面
        if (req.accepts('html') && !req.xhr && !req.path.startsWith('/api/')) {
          res.redirect('/login');
          return;
        }
        
        // API请求返回JSON错误
        res.status(401).json({
          success: false,
          error: 'No token provided'
        });
        return;
      }

      const token = authHeader.substring(7); // 移除 'Bearer ' 前缀
      const payload = this.authService.verifyToken(token);

      if (!payload) {
        // 如果是HTML页面请求，重定向到登录页面
        if (req.accepts('html') && !req.xhr && !req.path.startsWith('/api/')) {
          res.redirect('/login');
          return;
        }
        
        // API请求返回JSON错误
        res.status(401).json({
          success: false,
          error: 'Invalid or expired token'
        });
        return;
      }

      // 将用户信息添加到请求对象
      req.user = payload;
      req.userId = payload.userId;
      req.userRole = payload.role;

      next();
    } catch (error) {
      logger.error('Authentication error:', error);
      res.status(500).json({
        success: false,
        error: 'Authentication failed'
      });
    }
  };

  // 可选认证（允许匿名访问，但如果有token则验证）
  optionalAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authHeader = req.headers.authorization;
      
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        const payload = this.authService.verifyToken(token);
        
        if (payload) {
          req.user = payload;
          req.userId = payload.userId;
          req.userRole = payload.role;
        }
      }

      next();
    } catch (error) {
      logger.error('Optional authentication error:', error);
      next();
    }
  };

  // 需要管理员权限
  requireAdmin = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
      return;
    }

    if (req.user.role !== UserRole.ADMIN) {
      res.status(403).json({
        success: false,
        error: 'Admin access required'
      });
      return;
    }

    next();
  };

  // 需要特定角色
  requireRole = (allowedRoles: UserRole[]) => {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
        return;
      }

      if (!allowedRoles.includes(req.user.role)) {
        res.status(403).json({
          success: false,
          error: 'Insufficient permissions'
        });
        return;
      }

      next();
    };
  };

  // 只能访问自己的资源或管理员可以访问所有
  requireOwnershipOrAdmin = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
      return;
    }

    const resourceUserId = req.params.userId || req.body.userId || req.query.userId;
    
    // 管理员可以访问所有资源
    if (req.user.role === UserRole.ADMIN) {
      next();
      return;
    }

    // 用户只能访问自己的资源
    if (req.user.userId === resourceUserId) {
      next();
      return;
    }

    res.status(403).json({
      success: false,
      error: 'Access denied. You can only access your own resources.'
    });
  };

  // 速率限制（带内存清理版本）
  rateLimit = (maxRequests: number, windowMs: number): RateLimitMiddleware => {
    const requests = new Map<string, { count: number; resetTime: number }>();
    
    // 定期清理过期记录，防止内存泄漏
    const cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [key, value] of requests.entries()) {
        if (now > value.resetTime) {
          requests.delete(key);
        }
      }
    }, windowMs); // 每个窗口期清理一次

    // 添加清理方法以便在服务关闭时调用
    const cleanup = () => {
      clearInterval(cleanupInterval);
      requests.clear();
    };

    const middleware: RateLimitMiddleware = (req: Request, res: Response, next: NextFunction): void => {
      const identifier = req.ip || 'unknown';
      const now = Date.now();
      
      const userRequests = requests.get(identifier);
      
      if (!userRequests || now > userRequests.resetTime) {
        requests.set(identifier, {
          count: 1,
          resetTime: now + windowMs
        });
        next();
        return;
      }

      if (userRequests.count >= maxRequests) {
        res.status(429).json({
          success: false,
          error: 'Too many requests. Please try again later.'
        });
        return;
      }

      userRequests.count++;
      next();
    };

    // 将清理方法附加到中间件上
    middleware.cleanup = cleanup;
    return middleware;
  };

  // 验证API密钥（用于外部系统集成）
  validateApiKey = (req: Request, res: Response, next: NextFunction): void => {
    const apiKey = req.headers['x-api-key'] as string;
    const validApiKey = process.env.API_KEY;

    if (!validApiKey) {
      logger.warn('API_KEY not configured. Skipping API key validation.');
      next();
      return;
    }

    if (!apiKey || apiKey !== validApiKey) {
      res.status(401).json({
        success: false,
        error: 'Invalid API key'
      });
      return;
    }

    next();
  };
  
  // 检查是否是Web管理界面请求
  private isWebManagementRequest(req: Request): boolean {
    const userAgent = req.headers['user-agent'] || '';
    const host = req.headers.host || '';
    
    // 检查是否来自本地访问且是浏览器请求
    const isLocalhost = host.includes('localhost') || host.includes('127.0.0.1') || host.includes('0.0.0.0');
    const isBrowserRequest = userAgent.includes('Mozilla') || userAgent.includes('Chrome') || userAgent.includes('Safari');
    
    // 允许Web管理界面的API调用（开发和本地访问）
    if (isLocalhost && isBrowserRequest) {
      return true;
    }
    
    // 在开发环境中允许所有Web请求
    if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
      return isBrowserRequest;
    }
    
    return false;
  }
}

// 创建单例实例
const authMiddleware = new AuthMiddleware();

export default authMiddleware;

// 导出常用的中间件函数
export const authenticate = authMiddleware.authenticate;
export const optionalAuth = authMiddleware.optionalAuth;
export const requireAdmin = authMiddleware.requireAdmin;
export const requireRole = authMiddleware.requireRole;
export const requireOwnershipOrAdmin = authMiddleware.requireOwnershipOrAdmin;
export const rateLimit = authMiddleware.rateLimit;
export const validateApiKey = authMiddleware.validateApiKey;