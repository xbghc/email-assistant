#!/usr/bin/env tsx

/**
 * 生产环境就绪检查脚本
 * 用于确保没有mock数据或测试配置
 */

import { existsSync, readFileSync } from 'fs';
import { execSync } from 'child_process';

// 颜色定义
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  reset: '\x1b[0m'
};

// 环境变量检查结果
interface EnvCheckResult {
  name: string;
  value?: string;
  required: boolean;
  valid: boolean;
  message?: string;
}

// 安全执行命令
function safeExec(command: string): string | null {
  try {
    return execSync(command, { encoding: 'utf-8', stdio: 'pipe' }).trim();
  } catch {
    return null;
  }
}

// 检查环境变量
function checkEnvVar(name: string, required: boolean = false): EnvCheckResult {
  const value = process.env[name];
  
  if (!value) {
    return {
      name,
      required,
      valid: !required,
      message: required ? '未设置 (必需)' : '未设置 (可选)'
    };
  }
  
  // 检查是否为测试值
  const testPatterns = [
    /test@example\.com/,
    /localhost/,
    /mock/,
    /your-/,
    /CHANGE_THIS/,
    /example\.com/,
    /placeholder/i
  ];
  
  const isTestValue = testPatterns.some(pattern => pattern.test(value));
  
  if (isTestValue) {
    return {
      name,
      value,
      required,
      valid: false,
      message: `包含测试/占位符值: ${value}`
    };
  }
  
  return {
    name,
    value,
    required,
    valid: true,
    message: '已正确设置'
  };
}

// 检查必要的环境变量
function checkEnvironmentVariables(): number {
  console.log('📋 检查必要的环境变量...\n');
  
  const requiredVars = [
    'NODE_ENV',
    'AI_PROVIDER', 
    'SMTP_HOST',
    'SMTP_USER',
    'SMTP_PASS',
    'ADMIN_EMAIL', // 更新为新的变量名
    'JWT_SECRET'
  ];
  
  const optionalVars = [
    'PORT',
    'API_KEY',
    'LOG_LEVEL'
  ];
  
  let errors = 0;
  
  // 检查必需变量
  for (const varName of requiredVars) {
    const result = checkEnvVar(varName, true);
    const color = result.valid ? colors.green : colors.red;
    const icon = result.valid ? '✅' : '❌';
    
    console.log(`${color}${icon} ${result.name}: ${result.message}${colors.reset}`);
    
    if (!result.valid) {
      errors++;
    }
  }
  
  // 检查可选变量
  for (const varName of optionalVars) {
    const result = checkEnvVar(varName, false);
    const color = result.valid ? colors.green : colors.yellow;
    const icon = result.valid ? '✅' : '⚠️';
    
    console.log(`${color}${icon} ${result.name}: ${result.message}${colors.reset}`);
  }
  
  // 特殊检查
  const nodeEnv = process.env.NODE_ENV;
  if (nodeEnv && nodeEnv !== 'production') {
    console.log(`${colors.yellow}⚠️  NODE_ENV 不是 'production' (当前: ${nodeEnv})${colors.reset}`);
  }
  
  const aiProvider = process.env.AI_PROVIDER;
  if (aiProvider === 'mock') {
    console.log(`${colors.red}❌ AI_PROVIDER 设置为 'mock'，生产环境不应使用mock服务${colors.reset}`);
    errors++;
  }
  
  console.log('');
  return errors;
}

// 检查JSON文件
function checkJsonFile(filePath: string, testPatterns: string[]): { valid: boolean; message: string } {
  if (!existsSync(filePath)) {
    return { valid: true, message: '文件不存在 (正常)' };
  }
  
  try {
    const content = readFileSync(filePath, 'utf-8');
    
    // 检查是否为空数组
    if (content.trim() === '[]' || content.trim() === '{}') {
      return { valid: true, message: '已清空 (无测试数据)' };
    }
    
    // 检查测试模式
    const hasTestData = testPatterns.some(pattern => content.includes(pattern));
    if (hasTestData) {
      return { valid: false, message: '包含测试数据' };
    }
    
    // 尝试解析JSON并检查数量
    try {
      const data = JSON.parse(content);
      if (Array.isArray(data)) {
        if (data.length === 0) {
          return { valid: true, message: '已清空 (无测试数据)' };
        } else {
          return { valid: true, message: `包含 ${data.length} 个条目，请确认是否为真实数据` };
        }
      }
    } catch {
      return { valid: false, message: 'JSON格式无效' };
    }
    
    return { valid: true, message: '存在，请手动检查内容' };
  } catch {
    return { valid: false, message: '无法读取文件' };
  }
}

// 检查数据文件
function checkDataFiles(): number {
  console.log('📁 检查数据文件...\n');
  
  let errors = 0;
  
  // 检查用户文件
  const usersCheck = checkJsonFile('users.json', [
    'test@example.com',
    'mock',
    'sample',
    'demo'
  ]);
  
  const usersColor = usersCheck.valid ? colors.green : colors.red;
  const usersIcon = usersCheck.valid ? '✅' : '❌';
  console.log(`${usersColor}${usersIcon} users.json: ${usersCheck.message}${colors.reset}`);
  
  if (!usersCheck.valid) {
    errors++;
  }
  
  // 检查上下文数据
  const contextCheck = checkJsonFile('data/context.json', [
    '今天完成了',
    '测试',
    '模拟',
    'OAuth2.0实现',
    'test',
    'demo'
  ]);
  
  const contextColor = contextCheck.valid ? colors.green : colors.red;
  const contextIcon = contextCheck.valid ? '✅' : '❌';
  console.log(`${contextColor}${contextIcon} data/context.json: ${contextCheck.message}${colors.reset}`);
  
  if (!contextCheck.valid) {
    errors++;
  }
  
  console.log('');
  return errors;
}

// 检查源代码中的测试内容
function checkSourceCode(): void {
  console.log('🔍 检查源代码中的测试内容...\n');
  
  const testPatterns = [
    'test@example.com',
    'localhost.*smtp',
    'AI_PROVIDER.*mock'
  ];
  
  try {
    for (const pattern of testPatterns) {
      const result = safeExec(`grep -r "${pattern}" src/ --exclude-dir=__tests__ --exclude="*.test.ts" || true`);
      if (result && result.trim()) {
        console.log(`${colors.yellow}⚠️  源代码中发现测试相关内容:${colors.reset}`);
        console.log(result.split('\n').slice(0, 5).join('\n'));
        break;
      }
    }
  } catch {
    console.log(`${colors.yellow}⚠️  无法检查源代码 (可能是权限问题)${colors.reset}`);
  }
  
  console.log('');
}

// 检查配置文件
function checkConfigFiles(): number {
  console.log('⚙️  检查配置文件...\n');
  
  let errors = 0;
  
  if (existsSync('.env')) {
    try {
      const envContent = readFileSync('.env', 'utf-8');
      
      const testPatterns = [
        'AI_PROVIDER=mock',
        'test@example.com',
        'localhost',
        'your-secret-key',
        'CHANGE_THIS'
      ];
      
      const hasTestConfig = testPatterns.some(pattern => envContent.includes(pattern));
      
      if (hasTestConfig) {
        console.log(`${colors.red}❌ .env 文件包含测试配置${colors.reset}`);
        errors++;
      } else {
        console.log(`${colors.green}✅ .env 文件看起来正常${colors.reset}`);
      }
    } catch {
      console.log(`${colors.red}❌ 无法读取 .env 文件${colors.reset}`);
      errors++;
    }
  } else {
    console.log(`${colors.yellow}⚠️  .env 文件不存在，请从 .env.example 复制并配置${colors.reset}`);
  }
  
  console.log('');
  return errors;
}

// 主函数
async function main(): Promise<void> {
  console.log('🔍 检查生产环境配置...\n');
  
  let totalErrors = 0;
  
  // 执行各项检查
  totalErrors += checkEnvironmentVariables();
  totalErrors += checkDataFiles();
  checkSourceCode();
  totalErrors += checkConfigFiles();
  
  // 总结
  console.log('📊 检查结果汇总:\n');
  
  if (totalErrors === 0) {
    console.log(`${colors.green}✅ 所有检查通过！系统已准备好部署到生产环境。${colors.reset}`);
    process.exit(0);
  } else {
    console.log(`${colors.red}❌ 发现 ${totalErrors} 个问题需要修复后才能部署到生产环境。${colors.reset}\n`);
    
    console.log('🔧 建议的修复步骤:');
    console.log('1. 复制 .env.example 为 .env 并设置真实配置');
    console.log('2. 确保 AI_PROVIDER 不是 \'mock\'');
    console.log('3. 设置真实的 SMTP 邮件服务器配置');
    console.log('4. 设置强密码的 JWT_SECRET');
    console.log('5. 清理所有测试数据文件');
    console.log('6. 将 NODE_ENV 设置为 \'production\'');
    
    process.exit(1);
  }
}

// 显示帮助信息
function showHelp(): void {
  console.log('生产环境就绪检查脚本');
  console.log('');
  console.log('使用方法:');
  console.log('  tsx check-production-ready.ts [选项]');
  console.log('');
  console.log('选项:');
  console.log('  -h, --help     显示帮助信息');
  console.log('');
  console.log('功能:');
  console.log('  • 检查环境变量配置');
  console.log('  • 验证无测试数据');
  console.log('  • 检查配置文件安全性');
  console.log('  • 源代码测试内容扫描');
}

// 解析命令行参数
function parseArgs(): void {
  const args = process.argv.slice(2);
  
  for (const arg of args) {
    switch (arg) {
      case '-h':
      case '--help':
        showHelp();
        process.exit(0);
        break;
      default:
        console.error(`未知选项: ${arg}`);
        showHelp();
        process.exit(1);
    }
  }
}

// 运行检查
if (require.main === module) {
  parseArgs();
  main().catch(error => {
    console.error('生产环境检查执行失败:', error);
    process.exit(1);
  });
}