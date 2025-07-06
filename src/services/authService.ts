import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { User, UserRole, LoginRequest, RegisterRequest, AuthResponse, JWTPayload } from '../models/User';
import UserService from './userService';
import logger from '../utils/logger';
import config from '../config';

export class AuthService {
  private userService: UserService;
  private jwtSecret: string;
  private jwtExpiresIn: string;
  private saltRounds: number = 12;

  constructor(userService: UserService) {
    this.userService = userService;
    this.jwtSecret = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
    this.jwtExpiresIn = process.env.JWT_EXPIRES_IN || '15m'; // 短期 token
    
    // 生产环境下强制要求设置 JWT 密钥
    if (this.jwtSecret === 'your-super-secret-jwt-key-change-in-production') {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('⚠️ SECURITY ERROR: Default JWT secret detected in production! Set JWT_SECRET environment variable.');
      }
      logger.warn('⚠️  Using default JWT secret. Please set JWT_SECRET environment variable in production');
    }
    
    // 验证 JWT 密钥强度
    if (this.jwtSecret.length < 32) {
      logger.warn('⚠️  JWT secret is too short. Recommend at least 32 characters for security.');
    }
  }

  async register(registerData: RegisterRequest): Promise<AuthResponse> {
    const { email, password, name, timezone } = registerData;

    // 检查用户是否已存在
    const existingUser = this.userService.getUserByEmail(email);
    if (existingUser) {
      throw new Error('User already exists with this email');
    }

    // 加密密码
    const hashedPassword = await bcrypt.hash(password, this.saltRounds);

    // 创建用户
    const newUser = this.userService.createUser(email, name, {
      schedule: {
        morningReminderTime: '09:00',
        eveningReminderTime: '18:00',
        timezone: timezone || 'Asia/Shanghai'
      },
      language: 'zh'
    });

    // 设置用户属性
    newUser.password = hashedPassword;
    newUser.role = this.userService.isAdmin(email) ? UserRole.ADMIN : UserRole.USER;
    newUser.emailVerified = true; // 简化起见，默认验证邮箱
    newUser.lastLoginAt = new Date();

    // 保存用户
    this.userService.addUser(newUser);

    // 生成JWT token
    const token = this.generateToken(newUser);

    logger.info(`New user registered: ${email}`);

    return {
      user: this.sanitizeUser(newUser),
      token,
      expiresIn: this.getTokenExpiryTime()
    };
  }

  async login(loginData: LoginRequest): Promise<AuthResponse> {
    const { email, password } = loginData;

    // 查找用户
    const user = this.userService.getUserByEmail(email);
    if (!user) {
      throw new Error('Invalid email or password');
    }

    // 检查用户是否激活
    if (!user.isActive) {
      throw new Error('Account is deactivated');
    }

    // 验证密码
    if (!user.password) {
      throw new Error('Account not set up properly. Please contact administrator.');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new Error('Invalid email or password');
    }

    // 更新最后登录时间
    user.lastLoginAt = new Date();
    this.userService.updateUser(user.id, { lastLoginAt: user.lastLoginAt });

    // 生成JWT token
    const token = this.generateToken(user);

    logger.info(`User logged in: ${email}`);

    return {
      user: this.sanitizeUser(user),
      token,
      expiresIn: this.getTokenExpiryTime()
    };
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = this.userService.getUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    if (!user.password) {
      throw new Error('Account not set up properly');
    }

    // 验证当前密码
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isCurrentPasswordValid) {
      throw new Error('Current password is incorrect');
    }

    // 加密新密码
    const hashedNewPassword = await bcrypt.hash(newPassword, this.saltRounds);

    // 更新密码
    this.userService.updateUser(userId, { 
      password: hashedNewPassword,
      updatedAt: new Date()
    });

    logger.info(`Password changed for user: ${user.email}`);
  }

  async generatePasswordResetToken(email: string): Promise<string | null> {
    const user = this.userService.getUserByEmail(email);
    if (!user) {
      // 为了安全，不透露用户是否存在
      return null;
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 3600000); // 1小时后过期

    this.userService.updateUser(user.id, {
      resetToken,
      resetTokenExpiry,
      updatedAt: new Date()
    });

    logger.info(`Password reset token generated for user: ${email}`);
    return resetToken;
  }

  async resetPassword(token: string, newPassword: string): Promise<boolean> {
    // 查找具有该重置令牌的用户
    const users = this.userService.getAllUsers();
    const user = users.find(u => u.resetToken === token);

    if (!user) {
      throw new Error('Invalid reset token');
    }

    // 检查令牌是否过期
    if (!user.resetTokenExpiry || user.resetTokenExpiry < new Date()) {
      throw new Error('Reset token has expired');
    }

    // 加密新密码
    const hashedPassword = await bcrypt.hash(newPassword, this.saltRounds);

    // 更新密码并清除重置令牌
    this.userService.updateUser(user.id, {
      password: hashedPassword,
      updatedAt: new Date()
    });
    
    // 单独清除重置令牌字段
    const updatedUser = this.userService.getUserById(user.id);
    if (updatedUser) {
      delete updatedUser.resetToken;
      delete updatedUser.resetTokenExpiry;
      this.userService.updateUser(user.id, updatedUser);
    }

    logger.info(`Password reset completed for user: ${user.email}`);
    return true;
  }

  verifyToken(token: string): JWTPayload | null {
    try {
      const decoded = jwt.verify(token, this.jwtSecret) as JWTPayload;
      return decoded;
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        logger.debug('Invalid JWT token:', error.message);
      } else if (error instanceof jwt.TokenExpiredError) {
        logger.debug('JWT token expired');
      }
      return null;
    }
  }

  async refreshToken(oldToken: string): Promise<AuthResponse | null> {
    const payload = this.verifyToken(oldToken);
    if (!payload) {
      return null;
    }

    const user = this.userService.getUserById(payload.userId);
    if (!user || !user.isActive) {
      return null;
    }

    const newToken = this.generateToken(user);

    return {
      user: this.sanitizeUser(user),
      token: newToken,
      expiresIn: this.getTokenExpiryTime()
    };
  }

  private generateToken(user: User): string {
    const payload: Omit<JWTPayload, 'iat' | 'exp'> = {
      userId: user.id,
      email: user.email,
      role: user.role
    };

    return jwt.sign(payload, this.jwtSecret, {
      expiresIn: this.jwtExpiresIn
    } as jwt.SignOptions);
  }

  private sanitizeUser(user: User): Omit<User, 'password'> {
    const { password, ...sanitizedUser } = user;
    return sanitizedUser;
  }

  private getTokenExpiryTime(): number {
    // 简单解析过期时间（假设格式为 '24h', '7d' 等）
    const timeUnit = this.jwtExpiresIn.slice(-1);
    const timeValue = parseInt(this.jwtExpiresIn.slice(0, -1));
    
    switch (timeUnit) {
      case 'h':
        return timeValue * 3600000; // 小时转毫秒
      case 'd':
        return timeValue * 86400000; // 天转毫秒
      case 'm':
        return timeValue * 60000; // 分钟转毫秒
      default:
        return 86400000; // 默认24小时
    }
  }

  async hasUsers(): Promise<boolean> {
    const users = this.userService.getAllUsers();
    return users.length > 0;
  }

  async createAdminUser(email: string, password: string, name: string): Promise<User> {
    const hashedPassword = await bcrypt.hash(password, this.saltRounds);
    
    const adminUser = this.userService.createUser(email, name);
    adminUser.password = hashedPassword;
    adminUser.role = UserRole.ADMIN;
    adminUser.emailVerified = true;
    
    this.userService.addUser(adminUser);
    
    logger.info(`Admin user created: ${email}`);
    return adminUser;
  }
}

export default AuthService;