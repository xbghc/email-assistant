import logger from '../../utils/logger';
import { eventBus } from '../../events/eventTypes';

export interface ServiceInterface {
  initialize?(): Promise<void>;
  start?(): Promise<void> | void;
  stop?(): Promise<void> | void;
  destroy?(): Promise<void> | void;
  sendStartupNotification?(): Promise<void>;
  sendShutdownNotification?(): Promise<void>;
}

export interface ServiceDefinition {
  name: string;
  instance: ServiceInterface;
  dependencies?: string[];
  priority?: number;
}

export class ServiceManager {
  private services: Map<string, ServiceDefinition> = new Map();
  private startOrder: string[] = [];
  private initialized = false;

  constructor() {
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    // 监听进程退出事件
    process.on('beforeExit', this.gracefulShutdown.bind(this));
    process.on('SIGINT', this.gracefulShutdown.bind(this));
    process.on('SIGTERM', this.gracefulShutdown.bind(this));
  }

  registerService(definition: ServiceDefinition): void {
    if (this.services.has(definition.name)) {
      logger.warn(`Service ${definition.name} already registered, replacing`);
    }
    
    this.services.set(definition.name, definition);
    logger.debug(`Service ${definition.name} registered`);
  }

  private calculateStartOrder(): string[] {
    const visited = new Set<string>();
    const visiting = new Set<string>();
    const order: string[] = [];

    const visit = (serviceName: string) => {
      if (visited.has(serviceName)) return;
      if (visiting.has(serviceName)) {
        throw new Error(`Circular dependency detected involving ${serviceName}`);
      }

      visiting.add(serviceName);
      const service = this.services.get(serviceName);
      
      if (service?.dependencies) {
        for (const dep of service.dependencies) {
          if (!this.services.has(dep)) {
            throw new Error(`Service ${serviceName} depends on ${dep} which is not registered`);
          }
          visit(dep);
        }
      }

      visiting.delete(serviceName);
      visited.add(serviceName);
      order.push(serviceName);
    };

    // 按优先级排序服务
    const serviceNames = Array.from(this.services.keys()).sort((a, b) => {
      const serviceA = this.services.get(a)!;
      const serviceB = this.services.get(b)!;
      return (serviceB.priority || 0) - (serviceA.priority || 0);
    });

    for (const serviceName of serviceNames) {
      visit(serviceName);
    }

    return order;
  }

  async initializeAll(): Promise<void> {
    if (this.initialized) {
      logger.warn('Services already initialized');
      return;
    }

    try {
      this.startOrder = this.calculateStartOrder();
      logger.info(`Service initialization order: ${this.startOrder.join(' -> ')}`);

      for (const serviceName of this.startOrder) {
        const service = this.services.get(serviceName)!;
        logger.info(`Initializing service: ${serviceName}`);
        
        const startTime = Date.now();
        
        if (service.instance.initialize) {
          await service.instance.initialize();
        }
        
        const duration = Date.now() - startTime;
        logger.info(`✅ Service ${serviceName} initialized in ${duration}ms`);
      }

      this.initialized = true;
      logger.info('✅ All services initialized successfully');
      
    } catch (error) {
      logger.error('Failed to initialize services:', error);
      await this.gracefulShutdown();
      throw error;
    }
  }

  async startAll(): Promise<void> {
    if (!this.initialized) {
      throw new Error('Services must be initialized before starting');
    }

    try {
      for (const serviceName of this.startOrder) {
        const service = this.services.get(serviceName)!;
        logger.info(`Starting service: ${serviceName}`);
        
        const startTime = Date.now();
        
        if (service.instance.start) {
          await service.instance.start();
        }
        
        const duration = Date.now() - startTime;
        logger.info(`✅ Service ${serviceName} started in ${duration}ms`);
      }

      logger.info('✅ All services started successfully');
      
    } catch (error) {
      logger.error('Failed to start services:', error);
      await this.gracefulShutdown();
      throw error;
    }
  }

  async stopService(serviceName: string): Promise<void> {
    const service = this.services.get(serviceName);
    if (!service) {
      logger.warn(`Service ${serviceName} not found`);
      return;
    }

    try {
      logger.info(`Stopping service: ${serviceName}`);
      
      if (service.instance.stop) {
        await service.instance.stop();
      }
      
      logger.info(`✅ Service ${serviceName} stopped`);
      
    } catch (error) {
      logger.error(`Failed to stop service ${serviceName}:`, error);
      throw error;
    }
  }

  async gracefulShutdown(): Promise<void> {
    if (!this.initialized) {
      return;
    }

    logger.info('🔄 Starting graceful shutdown...');
    
    try {
      // 按相反顺序停止服务
      const stopOrder = [...this.startOrder].reverse();
      
      for (const serviceName of stopOrder) {
        await this.stopService(serviceName);
      }

      // 销毁服务
      for (const serviceName of stopOrder) {
        const service = this.services.get(serviceName)!;
        if (service.instance.destroy) {
          try {
            await service.instance.destroy();
            logger.info(`✅ Service ${serviceName} destroyed`);
          } catch (error) {
            logger.error(`Failed to destroy service ${serviceName}:`, error);
          }
        }
      }

      // 清理事件总线
      eventBus.removeAllListeners();
      
      this.initialized = false;
      logger.info('✅ Graceful shutdown completed');
      
    } catch (error) {
      logger.error('Error during graceful shutdown:', error);
    }
  }

  getService<T extends ServiceInterface>(serviceName: string): T | undefined {
    const service = this.services.get(serviceName);
    return service?.instance as T;
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  getServiceNames(): string[] {
    return Array.from(this.services.keys());
  }

  getServiceStatus(): Record<string, { initialized: boolean; dependencies: string[] }> {
    const status: Record<string, { initialized: boolean; dependencies: string[] }> = {};
    
    for (const [name, service] of this.services) {
      status[name] = {
        initialized: this.initialized,
        dependencies: service.dependencies || []
      };
    }
    
    return status;
  }
}

// 全局服务管理器实例
export const serviceManager = new ServiceManager();