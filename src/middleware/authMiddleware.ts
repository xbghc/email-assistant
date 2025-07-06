import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/authService';
import UserService from '../services/userService';
import { UserRole, JWTPayload } from '../models/User';
import logger from '../utils/logger';

// 扩展Express Request接口以包含用户信息
declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
      userId?: string;
      userRole?: UserRole;
    }
  }
}

export class AuthMiddleware {
  private authService: AuthService;

  constructor() {
    const userService = new UserService();
    this.authService = new AuthService(userService);
  }

  // 验证JWT token
  authenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // 为Web管理界面提供临时访问（localhost）
      if (this.isWebManagementRequest(req)) {
        req.user = { 
          userId: 'admin', 
          role: UserRole.ADMIN, 
          email: 'admin@localhost',
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 3600
        };
        req.userId = 'admin';
        req.userRole = UserRole.ADMIN;
        next();
        return;
      }
      
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({
          success: false,
          error: 'No token provided'
        });
        return;
      }

      const token = authHeader.substring(7); // 移除 'Bearer ' 前缀
      const payload = this.authService.verifyToken(token);

      if (!payload) {
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

  // 速率限制（简单版本）
  rateLimit = (maxRequests: number, windowMs: number) => {
    const requests = new Map<string, { count: number; resetTime: number }>();

    return (req: Request, res: Response, next: NextFunction): void => {
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
    const referer = req.headers.referer || '';
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