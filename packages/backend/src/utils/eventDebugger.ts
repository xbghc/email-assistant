import { eventBus } from '../events/eventTypes';
import logger from './logger';

export interface EventDebugInfo {
  eventType: string;
  timestamp: number;
  metadata: {
    eventId: string;
    source: string;
    correlationId?: string;
    userId?: string;
  };
  payload: unknown;
}

export class EventDebugger {
  private static instance: EventDebugger;
  private eventHistory: EventDebugInfo[] = [];
  private readonly maxHistorySize = 1000;
  private isEnabled = false;

  private constructor() {}

  static getInstance(): EventDebugger {
    if (!EventDebugger.instance) {
      EventDebugger.instance = new EventDebugger();
    }
    return EventDebugger.instance;
  }

  enable(): void {
    if (this.isEnabled) {
      return;
    }

    this.isEnabled = true;
    this.setupEventListeners();
    logger.info('Event debugging enabled');
  }

  disable(): void {
    if (!this.isEnabled) {
      return;
    }

    this.isEnabled = false;
    this.cleanup();
    logger.info('Event debugging disabled');
  }

  private setupEventListeners(): void {
    // 监听所有事件
    const originalEmit = eventBus.emit.bind(eventBus);
    
    eventBus.emit = (eventType: string, ...args: unknown[]) => {
      if (this.isEnabled) {
        this.logEvent(eventType, args[0]);
      }
      return originalEmit(eventType, ...args);
    };

    logger.debug('Event debugging listeners set up');
  }

  private logEvent(eventType: string, eventData: unknown): void {
    const debugInfo: EventDebugInfo = {
      eventType,
      timestamp: Date.now(),
      metadata: (eventData as { metadata?: { eventId: string; source: string } })?.metadata || {
        eventId: 'unknown',
        source: 'unknown'
      },
      payload: (eventData as { payload?: unknown })?.payload || eventData
    };

    this.eventHistory.push(debugInfo);
    
    // 保持历史记录大小
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.shift();
    }

    // 输出调试信息
    logger.debug(`📡 Event: ${eventType}`, {
      eventId: debugInfo.metadata.eventId,
      source: debugInfo.metadata.source,
      correlationId: debugInfo.metadata.correlationId,
      userId: debugInfo.metadata.userId,
      payloadSize: JSON.stringify(debugInfo.payload).length
    });
  }

  getEventHistory(limit?: number): EventDebugInfo[] {
    if (limit) {
      return this.eventHistory.slice(-limit);
    }
    return [...this.eventHistory];
  }

  getEventsByType(eventType: string, limit?: number): EventDebugInfo[] {
    const filtered = this.eventHistory.filter(event => event.eventType === eventType);
    if (limit) {
      return filtered.slice(-limit);
    }
    return filtered;
  }

  getEventsByUser(userId: string, limit?: number): EventDebugInfo[] {
    const filtered = this.eventHistory.filter(event => event.metadata.userId === userId);
    if (limit) {
      return filtered.slice(-limit);
    }
    return filtered;
  }

  getEventsByCorrelationId(correlationId: string): EventDebugInfo[] {
    return this.eventHistory.filter(event => event.metadata.correlationId === correlationId);
  }

  getEventStatistics(): Record<string, number> {
    const stats: Record<string, number> = {};
    
    for (const event of this.eventHistory) {
      stats[event.eventType] = (stats[event.eventType] || 0) + 1;
    }
    
    return stats;
  }

  clearHistory(): void {
    this.eventHistory = [];
    logger.info('Event history cleared');
  }

  generateReport(): string {
    const stats = this.getEventStatistics();
    const totalEvents = this.eventHistory.length;
    const uniqueEventTypes = Object.keys(stats).length;
    
    let report = `📊 Event Debug Report\n`;
    report += `=====================================\n`;
    report += `Total Events: ${totalEvents}\n`;
    report += `Unique Event Types: ${uniqueEventTypes}\n`;
    report += `History Size: ${this.eventHistory.length}/${this.maxHistorySize}\n`;
    report += `Status: ${this.isEnabled ? 'Enabled' : 'Disabled'}\n\n`;
    
    report += `Event Type Statistics:\n`;
    report += `----------------------\n`;
    
    const sortedStats = Object.entries(stats)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10);
      
    for (const [eventType, count] of sortedStats) {
      const percentage = ((count / totalEvents) * 100).toFixed(1);
      report += `${eventType}: ${count} (${percentage}%)\n`;
    }
    
    if (this.eventHistory.length > 0) {
      const recentEvents = this.eventHistory.slice(-5);
      report += `\nRecent Events (last 5):\n`;
      report += `-----------------------\n`;
      
      for (const event of recentEvents) {
        const time = new Date(event.timestamp).toISOString();
        report += `${time} - ${event.eventType} (${event.metadata.source})\n`;
      }
    }
    
    return report;
  }

  private cleanup(): void {
    // 恢复原始的emit方法
    // 注意：这里可能需要更复杂的逻辑来完全恢复
    logger.debug('Event debugging cleanup completed');
  }
}

// 全局实例
export const eventDebugger = EventDebugger.getInstance();

// 便捷函数
export function enableEventDebugging(): void {
  eventDebugger.enable();
}

export function disableEventDebugging(): void {
  eventDebugger.disable();
}

export function getEventDebugReport(): string {
  return eventDebugger.generateReport();
}