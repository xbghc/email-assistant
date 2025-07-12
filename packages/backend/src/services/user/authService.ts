import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { User, UserRole, SendCodeRequest, VerifyCodeRequest, RegisterRequest, AuthResponse, JWTPayload } from '../../models/User';
import UserService from './userService';
import { EmailService } from '../emailService';
import logger from '../../utils/logger';

export class AuthService {
  private userService: UserService;
  private emailService: EmailService;
  private jwtSecret: string;
  private jwtExpiresIn: string;
  private adminEmail: string;
  private maxCodeAttempts: number = 3;
  private codeValidityMinutes: number = 30;
  private resendCooldownMinutes: number = 1;

  constructor(userService: UserService, emailService: EmailService) {
    this.userService = userService;
    this.emailService = emailService;
    this.jwtSecret = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
    this.jwtExpiresIn = process.env.JWT_EXPIRES_IN || '15m';
    this.adminEmail = process.env.ADMIN_EMAIL || '';
    
    // 生产环境下强制要求设置必要的环境变量
    if (process.env.NODE_ENV === 'production') {
      if (this.jwtSecret === 'your-super-secret-jwt-key-change-in-production') {
        throw new Error('⚠️ SECURITY ERROR: Default JWT secret detected in production! Set JWT_SECRET environment variable.');
      }
      if (!this.adminEmail) {
        throw new Error('⚠️ SECURITY ERROR: ADMIN_EMAIL environment variable must be set in production.');
      }
    }
    
    if (!this.adminEmail) {
      logger.warn('⚠️  ADMIN_EMAIL environment variable not set. Admin functionality will be disabled.');
    }
    
    // 验证 JWT 密钥强度
    if (this.jwtSecret.length < 32) {
      logger.warn('⚠️  JWT secret is too short. Recommend at least 32 characters for security.');
    }
  }

  async register(registerData: RegisterRequest): Promise<User> {
    const { email, name, timezone } = registerData;

    // 检查用户是否已存在
    const existingUser = this.userService.getUserByEmail(email);
    if (existingUser) {
      throw new Error('User already exists with this email');
    }

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
    newUser.role = (email === this.adminEmail) ? UserRole.ADMIN : UserRole.USER;
    newUser.emailVerified = true;

    // 保存用户
    this.userService.addUser(newUser);

    logger.info(`New user registered: ${email}`);
    return newUser;
  }

  async sendVerificationCode(sendCodeData: SendCodeRequest): Promise<void> {
    const { email } = sendCodeData;

    // 查找用户
    const user = this.userService.getUserByEmail(email);
    if (!user) {
      throw new Error('User not found');
    }

    // 检查用户是否激活
    if (!user.isActive) {
      throw new Error('Account is deactivated');
    }

    // 检查重发冷却时间
    if (user.lastVerificationCodeSent) {
      const timeSinceLastSent = Date.now() - user.lastVerificationCodeSent.getTime();
      const cooldownMs = this.resendCooldownMinutes * 60 * 1000;
      if (timeSinceLastSent < cooldownMs) {
        const remainingSeconds = Math.ceil((cooldownMs - timeSinceLastSent) / 1000);
        throw new Error(`Please wait ${remainingSeconds} seconds before requesting a new code`);
      }
    }

    // 生成6位数字验证码
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiryTime = new Date(Date.now() + this.codeValidityMinutes * 60 * 1000);

    // 更新用户验证码信息
    this.userService.updateUser(user.id, {
      verificationCode,
      verificationCodeExpiry: expiryTime,
      verificationCodeAttempts: 0,
      lastVerificationCodeSent: new Date(),
      updatedAt: new Date()
    });

    // 发送验证码邮件
    await this.emailService.sendVerificationCode(email, verificationCode);

    logger.info(`Verification code sent to: ${email}`);
  }

  async verifyCodeAndLogin(verifyCodeData: VerifyCodeRequest): Promise<AuthResponse> {
    const { email, code } = verifyCodeData;

    // 查找用户
    const user = this.userService.getUserByEmail(email);
    if (!user) {
      throw new Error('User not found');
    }

    // 检查用户是否激活
    if (!user.isActive) {
      throw new Error('Account is deactivated');
    }

    // 检查验证码是否存在和是否过期
    if (!user.verificationCode || !user.verificationCodeExpiry) {
      throw new Error('No verification code found. Please request a new code.');
    }

    if (user.verificationCodeExpiry < new Date()) {
      throw new Error('Verification code has expired. Please request a new code.');
    }

    // 检查尝试次数
    const attempts = user.verificationCodeAttempts || 0;
    if (attempts >= this.maxCodeAttempts) {
      throw new Error('Too many verification attempts. Please request a new code.');
    }

    // 验证代码
    if (user.verificationCode !== code) {
      // 增加尝试次数
      this.userService.updateUser(user.id, {
        verificationCodeAttempts: attempts + 1,
        updatedAt: new Date()
      });
      throw new Error('Invalid verification code');
    }

    // 验证成功，清除验证码信息，更新登录时间
    this.userService.updateUser(user.id, {
      verificationCode: undefined,
      verificationCodeExpiry: undefined,
      verificationCodeAttempts: undefined,
      lastVerificationCodeSent: undefined,
      lastLoginAt: new Date(),
      updatedAt: new Date()
    });

    // 生成JWT token
    const token = this.generateToken(user);

    logger.info(`User logged in: ${email}`);

    const updatedUser = this.userService.getUserById(user.id)!;
    return {
      user: updatedUser,
      token,
      expiresIn: this.getTokenExpiryTime()
    };
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
      user: user,
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

  isAdminEmail(email: string): boolean {
    return email === this.adminEmail;
  }

  getAdminEmail(): string {
    return this.adminEmail;
  }
}

export default AuthService;