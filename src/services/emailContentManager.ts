import logger from '../utils/logger';
import { ContextEntry } from '../models';

interface ContentLimits {
  maxEmailLength: number;
  maxContextEntries: number;
  maxHelpSectionLength: number;
  summaryThreshold: number;
}

class EmailContentManager {
  private readonly limits: ContentLimits = {
    maxEmailLength: 3000,        // 邮件总长度限制
    maxContextEntries: 5,        // 上下文条目数限制
    maxHelpSectionLength: 800,   // 单个帮助节长度限制
    summaryThreshold: 2000       // 触发内容摘要的阈值
  };

  /**
   * 智能截断和优化邮件内容
   */
  optimizeEmailContent(content: string, type: 'help' | 'response' | 'notification'): string {
    if (content.length <= this.limits.maxEmailLength) {
      return content;
    }

    logger.info(`Email content too long (${content.length} chars), optimizing...`);

    switch (type) {
      case 'help':
        return this.optimizeHelpContent(content);
      case 'response':
        return this.optimizeResponseContent(content);
      case 'notification':
        return this.optimizeNotificationContent(content);
      default:
        return this.genericOptimize(content);
    }
  }

  /**
   * 优化上下文历史显示
   */
  optimizeContextForEmail(context: ContextEntry[]): string {
    // 限制条目数量
    const recentContext = context.slice(-this.limits.maxContextEntries);
    
    // 生成简化的上下文摘要
    if (recentContext.length === 0) {
      return '暂无历史记录';
    }

    const contextSummary = recentContext.map(entry => {
      const timeStr = entry.timestamp.toLocaleDateString();
      const shortContent = this.truncateText(entry.content, 100);
      
      return `• [${timeStr}] ${entry.type}: ${shortContent}`;
    }).join('\n');

    // 如果仍然太长，进一步压缩
    if (contextSummary.length > 500) {
      const count = recentContext.length;
      const latestEntry = recentContext[recentContext.length - 1];
      const shortLatest = this.truncateText(latestEntry.content, 150);
      
      return `📝 最近${count}条记录\n最新: ${shortLatest}\n\n💡 完整历史已保存，可随时查询`;
    }

    return contextSummary;
  }

  /**
   * 优化帮助内容
   */
  private optimizeHelpContent(content: string): string {
    const sections = content.split('\n\n');
    const optimizedSections: string[] = [];
    let currentLength = 0;

    for (const section of sections) {
      if (currentLength + section.length > this.limits.maxEmailLength) {
        optimizedSections.push('\n📖 内容较多，已截断。回复"更多帮助"获取完整信息。');
        break;
      }
      
      if (section.length > this.limits.maxHelpSectionLength) {
        const truncated = this.truncateText(section, this.limits.maxHelpSectionLength);
        optimizedSections.push(truncated + '\n...[内容已截断]');
      } else {
        optimizedSections.push(section);
      }
      
      currentLength += section.length;
    }

    return optimizedSections.join('\n\n');
  }

  /**
   * 优化AI响应内容
   */
  private optimizeResponseContent(content: string): string {
    if (content.length <= this.limits.summaryThreshold) {
      return content;
    }

    // 尝试保留关键信息
    const lines = content.split('\n');
    const importantLines: string[] = [];
    const detailLines: string[] = [];
    
    for (const line of lines) {
      const trimmed = line.trim();
      // 保留标题、重要提示、结果等
      if (trimmed.startsWith('•') || 
          trimmed.startsWith('📋') || 
          trimmed.startsWith('✅') || 
          trimmed.startsWith('🎯') ||
          trimmed.includes('成功') ||
          trimmed.includes('失败') ||
          trimmed.includes('错误')) {
        importantLines.push(line);
      } else if (trimmed.length > 0) {
        detailLines.push(line);
      }
    }

    // 构建优化后的内容
    let optimized = importantLines.join('\n');
    
    // 如果还有空间，添加部分详细信息
    const remainingSpace = this.limits.maxEmailLength - optimized.length - 200; // 预留200字符
    if (remainingSpace > 0 && detailLines.length > 0) {
      const additionalContent = detailLines.join('\n');
      if (additionalContent.length <= remainingSpace) {
        optimized += '\n\n' + additionalContent;
      } else {
        optimized += '\n\n' + this.truncateText(additionalContent, remainingSpace) + '\n\n💡 完整内容较长，已优化显示';
      }
    }

    return optimized;
  }

  /**
   * 优化通知内容
   */
  private optimizeNotificationContent(content: string): string {
    const sections = content.split('\n\n');
    const essentialSections: string[] = [];
    const optionalSections: string[] = [];
    
    for (const section of sections) {
      // 保留关键信息段
      if (section.includes('错误') || 
          section.includes('警告') || 
          section.includes('成功') ||
          section.includes('状态') ||
          section.includes('详情')) {
        essentialSections.push(section);
      } else {
        optionalSections.push(section);
      }
    }

    let optimized = essentialSections.join('\n\n');
    
    // 添加可选信息直到达到长度限制
    const remainingSpace = this.limits.maxEmailLength - optimized.length - 100;
    if (remainingSpace > 0) {
      for (const section of optionalSections) {
        if (optimized.length + section.length + 10 <= this.limits.maxEmailLength) {
          optimized += '\n\n' + section;
        } else {
          break;
        }
      }
    }

    return optimized;
  }

  /**
   * 通用优化方法
   */
  private genericOptimize(content: string): string {
    const truncated = this.truncateText(content, this.limits.maxEmailLength - 100);
    return truncated + '\n\n📧 内容已优化显示，完整信息已保存。';
  }

  /**
   * 智能截断文本，保持完整性
   */
  private truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) {
      return text;
    }

    // 尝试在句号、感叹号或问号处截断
    const sentenceEnders = ['。', '!', '?', '！', '？'];
    for (let i = maxLength - 1; i > maxLength * 0.8; i--) {
      if (sentenceEnders.includes(text[i])) {
        return text.substring(0, i + 1);
      }
    }

    // 尝试在逗号或分号处截断
    const clauseEnders = [',', '，', ';', '；'];
    for (let i = maxLength - 1; i > maxLength * 0.9; i--) {
      if (clauseEnders.includes(text[i])) {
        return text.substring(0, i + 1) + '...';
      }
    }

    // 尝试在空格处截断
    for (let i = maxLength - 1; i > maxLength * 0.95; i--) {
      if (text[i] === ' ' || text[i] === '\n') {
        return text.substring(0, i) + '...';
      }
    }

    // 最后直接截断
    return text.substring(0, maxLength - 3) + '...';
  }

  /**
   * 生成内容摘要
   */
  generateContentSummary(content: string, maxLength: number = 200): string {
    if (content.length <= maxLength) {
      return content;
    }

    // 提取关键句子
    const sentences = content.split(/[。！？.!?]/).filter(s => s.trim().length > 10);
    const importantSentences = sentences.filter(sentence => {
      return sentence.includes('成功') || 
             sentence.includes('失败') || 
             sentence.includes('完成') ||
             sentence.includes('错误') ||
             sentence.includes('提醒') ||
             sentence.includes('配置');
    });

    if (importantSentences.length > 0) {
      const summary = importantSentences.slice(0, 2).join('。') + '。';
      if (summary.length <= maxLength) {
        return summary;
      }
    }

    // 回退到简单截断
    return this.truncateText(content, maxLength);
  }

  /**
   * 分页显示长内容
   */
  paginateContent(content: string, pageSize: number = 1000): string[] {
    const pages: string[] = [];
    const sections = content.split('\n\n');
    let currentPage = '';
    
    for (const section of sections) {
      if (currentPage.length + section.length + 10 > pageSize) {
        if (currentPage) {
          pages.push(currentPage.trim());
          currentPage = section;
        } else {
          // 单个section太长，强制分割
          pages.push(this.truncateText(section, pageSize));
        }
      } else {
        currentPage += (currentPage ? '\n\n' : '') + section;
      }
    }
    
    if (currentPage) {
      pages.push(currentPage.trim());
    }
    
    return pages;
  }

  /**
   * 检查内容是否需要优化
   */
  needsOptimization(content: string): boolean {
    return content.length > this.limits.maxEmailLength;
  }

  /**
   * 获取内容统计信息
   */
  getContentStats(content: string): {
    length: number;
    lines: number;
    sections: number;
    needsOptimization: boolean;
  } {
    return {
      length: content.length,
      lines: content.split('\n').length,
      sections: content.split('\n\n').length,
      needsOptimization: this.needsOptimization(content)
    };
  }
}

export default EmailContentManager;