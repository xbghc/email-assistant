#!/usr/bin/env tsx

/**
 * Email Assistant 健康检查脚本
 * 用于监控应用程序的运行状态
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

// 颜色输出
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

// 配置
interface Config {
  apiBaseUrl: string;
  timeout: number;
  maxRetries: number;
}

const config: Config = {
  apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:3000',
  timeout: parseInt(process.env.TIMEOUT || '10'),
  maxRetries: parseInt(process.env.MAX_RETRIES || '3')
};

// 日志函数
const log = {
  info: (message: string) => console.log(`${colors.blue}[INFO]${colors.reset} ${message}`),
  success: (message: string) => console.log(`${colors.green}[✓]${colors.reset} ${message}`),
  warning: (message: string) => console.log(`${colors.yellow}[!]${colors.reset} ${message}`),
  error: (message: string) => console.log(`${colors.red}[✗]${colors.reset} ${message}`)
};

// 健康检查函数
async function checkProcess(): Promise<boolean> {
  log.info('检查进程状态...');
  
  try {
    const result = execSync('pgrep -f "node.*dist/index.js|tsx.*src/index.ts"', { stdio: 'pipe' });
    if (result.length > 0) {
      log.success('应用进程正在运行');
      return true;
    }
  } catch {
    // pgrep failed or no match found
  }
  
  log.error('应用进程未运行');
  return false;
}

async function checkPort(port: number = 3000): Promise<boolean> {
  log.info(`检查端口 ${port}...`);
  
  try {
    const result = execSync(`netstat -ln 2>/dev/null | grep ":${port} " || lsof -i :${port} 2>/dev/null || true`, { stdio: 'pipe' });
    const output = result.toString().trim();
    if (output && output.length > 0) {
      log.success(`端口 ${port} 正在监听`);
      return true;
    }
  } catch {
    // Command failed, try alternative check
    try {
      // Try using ss command as fallback
      const result = execSync(`ss -ln | grep ":${port} " || true`, { stdio: 'pipe' });
      const output = result.toString().trim();
      if (output && output.length > 0) {
        log.success(`端口 ${port} 正在监听`);
        return true;
      }
    } catch {
      // All methods failed
    }
  }
  
  log.error(`端口 ${port} 未监听`);
  return false;
}

async function checkApiHealth(): Promise<boolean> {
  log.info('检查API健康状态...');
  
  for (let i = 1; i <= config.maxRetries; i++) {
    try {
      const response = await fetch(`${config.apiBaseUrl}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(config.timeout * 1000)
      });
      
      if (response.status === 200) {
        const body = await response.text();
        log.success(`API健康检查通过 (HTTP ${response.status})`);
        console.log(`    响应: ${body}`);
        return true;
      } else {
        log.warning(`API返回异常状态码: ${response.status} (尝试 ${i}/${config.maxRetries})`);
      }
    } catch (error) {
      log.warning(`API请求失败 (尝试 ${i}/${config.maxRetries})`);
    }
    
    if (i < config.maxRetries) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  log.error('API健康检查失败');
  return false;
}

async function checkMemoryUsage(): Promise<boolean> {
  log.info('检查内存使用情况...');
  
  try {
    const pidResult = execSync('pgrep -f "node.*email-assistant" | head -1', { stdio: 'pipe' });
    const pid = pidResult.toString().trim();
    
    if (!pid) {
      log.error('找不到应用进程');
      return false;
    }
    
    const memoryResult = execSync(`ps -o rss= -p ${pid}`, { stdio: 'pipe' });
    const memoryKb = parseInt(memoryResult.toString().trim());
    
    if (isNaN(memoryKb)) {
      log.error('无法获取内存使用信息');
      return false;
    }
    
    const memoryMb = Math.round(memoryKb / 1024);
    log.success(`进程内存使用: ${memoryMb}MB`);
    
    // 检查是否超过阈值 (500MB)
    if (memoryMb > 500) {
      log.warning(`内存使用过高: ${memoryMb}MB > 500MB`);
      return false;
    }
    
    return true;
  } catch {
    log.error('无法检查内存使用情况');
    return false;
  }
}

async function checkDiskSpace(): Promise<boolean> {
  log.info('检查磁盘空间...');
  
  try {
    const result = execSync('df . | awk \'NR==2 {print $5}\' | sed \'s/%//\'', { stdio: 'pipe' });
    const usage = parseInt(result.toString().trim());
    
    log.success(`磁盘使用率: ${usage}%`);
    
    if (usage > 90) {
      log.error(`磁盘空间不足: ${usage}% > 90%`);
      return false;
    } else if (usage > 80) {
      log.warning(`磁盘空间偏低: ${usage}% > 80%`);
    }
    
    return true;
  } catch {
    log.error('无法检查磁盘空间');
    return false;
  }
}

async function checkLogFiles(): Promise<boolean> {
  log.info('检查日志文件...');
  
  const logDir = './logs';
  if (!existsSync(logDir)) {
    log.warning(`日志目录不存在: ${logDir}`);
    return true; // 非关键检查
  }
  
  try {
    const result = execSync(
      `find "${logDir}" -name "*.log" -mtime -1 -exec grep -l "ERROR" {} \\; | wc -l`,
      { stdio: 'pipe' }
    );
    const errorCount = parseInt(result.toString().trim());
    
    if (errorCount > 0) {
      log.warning(`发现 ${errorCount} 个日志文件包含ERROR`);
    } else {
      log.success('最近24小时无ERROR日志');
    }
    
    return true;
  } catch {
    log.warning('无法检查日志文件');
    return true; // 非关键检查
  }
}

async function checkDatabaseFiles(): Promise<boolean> {
  log.info('检查数据文件...');
  
  const dataDir = './data';
  if (!existsSync(dataDir)) {
    log.error(`数据目录不存在: ${dataDir}`);
    return false;
  }
  
  const requiredFiles = ['users.json', 'schedule.json'];
  const missingFiles: string[] = [];
  
  for (const file of requiredFiles) {
    const filePath = join(dataDir, file);
    if (!existsSync(filePath)) {
      missingFiles.push(file);
    }
  }
  
  if (missingFiles.length === 0) {
    log.success('所有必要数据文件存在');
    return true;
  } else {
    log.error(`缺少数据文件: ${missingFiles.join(', ')}`);
    return false;
  }
}

// 生成健康报告
function generateReport(overallStatus: boolean): void {
  const timestamp = new Date().toLocaleString('zh-CN');
  
  console.log('');
  console.log('==================================================================');
  console.log('                    Email Assistant 健康报告');
  console.log('==================================================================');
  console.log(`检查时间: ${timestamp}`);
  console.log(`服务地址: ${config.apiBaseUrl}`);
  console.log('');
  
  if (overallStatus) {
    console.log(`总体状态: ${colors.green}健康${colors.reset} ✅`);
    console.log('');
    console.log('建议操作:');
    console.log('  • 继续监控服务状态');
    console.log('  • 定期检查日志文件');
    console.log('  • 保持系统更新');
  } else {
    console.log(`总体状态: ${colors.red}异常${colors.reset} ❌`);
    console.log('');
    console.log('建议操作:');
    console.log('  • 检查应用日志: tail -f logs/combined.log');
    console.log('  • 重启服务: npm run start');
    console.log('  • 检查系统资源使用情况');
    console.log('  • 联系系统管理员');
  }
  
  console.log('');
  console.log('==================================================================');
}

// 主函数
async function main(): Promise<void> {
  console.log('🏥 Email Assistant 健康检查');
  console.log(`时间: ${new Date().toLocaleString('zh-CN')}`);
  console.log('');
  
  let failedChecks = 0;
  
  // 执行各项检查
  if (!(await checkProcess())) failedChecks++;
  if (!(await checkPort(3000))) failedChecks++;
  if (!(await checkApiHealth())) failedChecks++;
  if (!(await checkMemoryUsage())) failedChecks++;
  if (!(await checkDiskSpace())) failedChecks++;
  await checkLogFiles(); // 非关键检查
  if (!(await checkDatabaseFiles())) failedChecks++;
  
  // 生成报告
  const overallStatus = failedChecks === 0;
  generateReport(overallStatus);
  
  process.exit(overallStatus ? 0 : 1);
}

// 显示帮助信息
function showHelp(): void {
  console.log('Email Assistant 健康检查脚本');
  console.log('');
  console.log('使用方法:');
  console.log('  tsx health-check.ts [选项]');
  console.log('');
  console.log('选项:');
  console.log('  -h, --help     显示帮助信息');
  console.log('  -u, --url URL  指定API基础URL (默认: http://localhost:3000)');
  console.log('  -t, --timeout  设置超时时间 (默认: 10秒)');
  console.log('  -r, --retries  设置重试次数 (默认: 3次)');
  console.log('');
  console.log('环境变量:');
  console.log('  API_BASE_URL   API基础URL');
  console.log('  TIMEOUT        超时时间');
  console.log('  MAX_RETRIES    最大重试次数');
  console.log('');
  console.log('示例:');
  console.log('  tsx health-check.ts');
  console.log('  tsx health-check.ts --url http://localhost:3000 --timeout 5');
  console.log('  API_BASE_URL=http://prod.example.com tsx health-check.ts');
}

// 解析命令行参数
function parseArgs(): void {
  const args = process.argv.slice(2);
  
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '-h':
      case '--help':
        showHelp();
        process.exit(0);
        break;
      case '-u':
      case '--url':
        if (i + 1 < args.length) {
          const url = args[++i];
          if (url) {
            config.apiBaseUrl = url;
          }
        } else {
          console.error('错误: --url 需要提供URL参数');
          process.exit(1);
        }
        break;
      case '-t':
      case '--timeout':
        if (i + 1 < args.length) {
          const timeoutStr = args[++i];
          if (timeoutStr) {
            config.timeout = parseInt(timeoutStr);
          }
        } else {
          console.error('错误: --timeout 需要提供数字参数');
          process.exit(1);
        }
        break;
      case '-r':
      case '--retries':
        if (i + 1 < args.length) {
          const retriesStr = args[++i];
          if (retriesStr) {
            config.maxRetries = parseInt(retriesStr);
          }
        } else {
          console.error('错误: --retries 需要提供数字参数');
          process.exit(1);
        }
        break;
      default:
        console.error(`未知选项: ${args[i]}`);
        showHelp();
        process.exit(1);
    }
  }
}

// 运行健康检查
if (import.meta.url === `file://${process.argv[1]}`) {
  parseArgs();
  main().catch(error => {
    console.error('健康检查执行失败:', error);
    process.exit(1);
  });
}