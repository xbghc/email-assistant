#!/usr/bin/env tsx

/**
 * 环境检查脚本 - 在部署前运行以检查服务器环境
 */

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { platform, arch } from 'os';

// 颜色输出
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

// 安全执行命令
function safeExec(command: string): string | null {
  try {
    return execSync(command, { encoding: 'utf-8', stdio: 'pipe' }).trim();
  } catch {
    return null;
  }
}

// 检查命令是否存在
function commandExists(command: string): boolean {
  return safeExec(`command -v ${command}`) !== null;
}

// 系统信息检查
function checkSystemInfo(): void {
  console.log('📋 系统信息:');
  console.log(`   操作系统: ${platform()}`);
  console.log(`   架构: ${arch()}`);
  console.log(`   当前用户: ${process.env.USER || 'unknown'}`);
  console.log(`   当前目录: ${process.cwd()}`);
  console.log('');
}

// Node.js 检查
function checkNodeJS(): boolean {
  console.log('🟢 Node.js 检查:');
  
  const nodePaths = [
    '/usr/bin/node',
    '/usr/local/bin/node',
    '/opt/node/bin/node'
  ];
  
  // 添加 NVM 路径
  const homeDir = process.env.HOME;
  if (homeDir) {
    const nvmPaths = safeExec(`find ${homeDir}/.nvm/versions/node/*/bin/node 2>/dev/null || true`);
    if (nvmPaths) {
      nodePaths.push(...nvmPaths.split('\n').filter(p => p));
    }
  }
  
  // 检查当前 Node.js
  const currentNodeVersion = process.version;
  console.log(`   ✅ 当前 Node.js 版本: ${currentNodeVersion}`);
  console.log(`   路径: ${process.execPath}`);
  
  // 检查版本是否符合要求
  const majorVersion = parseInt(currentNodeVersion.substring(1).split('.')[0]);
  if (majorVersion >= 18) {
    console.log(`   ✅ Node.js 版本符合要求 (>= 18)`);
  } else {
    console.log(`   ⚠️  Node.js 版本偏低，建议升级到 18+ (当前: ${currentNodeVersion})`);
  }
  
  console.log('');
  return true;
}

// npm 检查
function checkNPM(): boolean {
  console.log('📦 npm 检查:');
  
  if (commandExists('npm')) {
    const version = safeExec('npm --version');
    console.log(`   ✅ npm 已安装: ${version}`);
    console.log('');
    return true;
  }
  
  console.log('   ❌ 未找到 npm');
  console.log('   📥 安装建议:');
  
  if (commandExists('apt-get')) {
    console.log('      sudo apt-get install -y npm');
  } else if (commandExists('yum')) {
    console.log('      sudo yum install -y nodejs-npm');
  } else if (commandExists('brew')) {
    console.log('      brew install npm');
  }
  
  console.log('');
  return false;
}

// Git 检查
function checkGit(): boolean {
  console.log('🌐 Git 检查:');
  
  if (commandExists('git')) {
    const version = safeExec('git --version');
    console.log(`   ✅ Git 已安装: ${version}`);
    console.log('');
    return true;
  }
  
  console.log('   ❌ 未找到 Git');
  console.log('   📥 安装建议:');
  
  if (commandExists('apt-get')) {
    console.log('      sudo apt-get install -y git');
  } else if (commandExists('yum')) {
    console.log('      sudo yum install -y git');
  } else if (commandExists('brew')) {
    console.log('      brew install git');
  }
  
  console.log('');
  return false;
}

// 权限检查
function checkPermissions(): void {
  console.log('🔐 权限检查:');
  
  const uid = process.getuid?.();
  if (uid === 0) {
    console.log('   ⚠️  当前以 root 用户运行');
    console.log('   建议创建普通用户运行应用');
  } else {
    console.log(`   ✅ 当前用户: ${process.env.USER}`);
    
    // 检查 sudo 权限
    const groups = safeExec('groups');
    if (groups?.includes('sudo') || groups?.includes('wheel')) {
      console.log('   ✅ 具有 sudo 权限');
    } else {
      console.log('   ⚠️  当前用户没有 sudo 权限');
      console.log('   部署脚本可能需要 sudo 权限配置系统服务');
    }
  }
  
  console.log('');
}

// 端口检查
function checkPorts(): void {
  console.log('🌐 端口检查:');
  
  if (commandExists('netstat')) {
    const portCheck = safeExec('netstat -tlnp 2>/dev/null | grep ":3000 "');
    if (portCheck) {
      console.log('   ⚠️  端口 3000 已被占用');
      const process = portCheck.split(/\s+/)[6] || 'unknown';
      console.log(`   占用进程: ${process}`);
    } else {
      console.log('   ✅ 端口 3000 可用');
    }
  } else if (commandExists('lsof')) {
    const portCheck = safeExec('lsof -i :3000');
    if (portCheck) {
      console.log('   ⚠️  端口 3000 已被占用');
      console.log(`   详情: ${portCheck.split('\n')[1] || 'unknown'}`);
    } else {
      console.log('   ✅ 端口 3000 可用');
    }
  } else {
    console.log('   ℹ️  无法检查端口状态 (未安装 netstat 或 lsof)');
  }
  
  console.log('');
}

// 防火墙检查
function checkFirewall(): void {
  console.log('🔥 防火墙检查:');
  
  if (commandExists('ufw')) {
    console.log('   检测到 UFW 防火墙');
    const status = safeExec('sudo ufw status 2>/dev/null');
    if (status?.includes('Status: active')) {
      console.log('   ⚠️  UFW 防火墙已启用，需要开放端口 3000');
      console.log('   命令: sudo ufw allow 3000');
    } else {
      console.log('   ✅ UFW 防火墙未启用');
    }
  } else if (commandExists('firewall-cmd')) {
    console.log('   检测到 firewalld 防火墙');
    console.log('   可能需要开放端口: sudo firewall-cmd --permanent --add-port=3000/tcp');
  } else if (commandExists('iptables')) {
    console.log('   检测到 iptables 防火墙');
    console.log('   可能需要开放端口: sudo iptables -A INPUT -p tcp --dport 3000 -j ACCEPT');
  } else {
    console.log('   ℹ️  未检测到防火墙或无法检查');
  }
  
  console.log('');
}

// 项目文件检查
function checkProjectFiles(): boolean {
  console.log('📁 项目文件检查:');
  
  let allFilesExist = true;
  
  if (existsSync('package.json')) {
    console.log('   ✅ 找到 package.json');
  } else {
    console.log('   ❌ 未找到 package.json');
    console.log('   请确保在项目根目录运行');
    allFilesExist = false;
  }
  
  if (existsSync('scripts/server-deploy.ts') || existsSync('scripts/server-deploy.sh')) {
    console.log('   ✅ 找到部署脚本');
  } else {
    console.log('   ❌ 未找到部署脚本');
    allFilesExist = false;
  }
  
  if (existsSync('.env')) {
    console.log('   ✅ 找到配置文件 .env');
  } else if (existsSync('.env.example')) {
    console.log('   ⚠️  找到 .env.example 模板，需要复制为 .env');
    console.log('   命令: cp .env.example .env');
  } else {
    console.log('   ❌ 未找到配置文件');
    allFilesExist = false;
  }
  
  console.log('');
  return allFilesExist;
}

// PNPM 检查
function checkPNPM(): boolean {
  console.log('📦 PNPM 检查:');
  
  if (commandExists('pnpm')) {
    const version = safeExec('pnpm --version');
    console.log(`   ✅ PNPM 已安装: ${version}`);
    console.log('');
    return true;
  }
  
  console.log('   ⚠️  未找到 PNPM (推荐的包管理器)');
  console.log('   📥 安装建议:');
  console.log('      npm install -g pnpm');
  console.log('   或使用 npm 代替');
  console.log('');
  return false;
}

// 主函数
async function main(): Promise<void> {
  console.log('🔍 邮件助手环境检查工具');
  console.log('================================');
  console.log('');
  
  // 执行各项检查
  checkSystemInfo();
  const nodeOk = checkNodeJS();
  const npmOk = checkNPM();
  const pnpmOk = checkPNPM();
  const gitOk = checkGit();
  checkPermissions();
  checkPorts();
  checkFirewall();
  const filesOk = checkProjectFiles();
  
  // 总结
  console.log('📊 检查总结:');
  
  if (nodeOk && (npmOk || pnpmOk) && filesOk) {
    console.log('   ✅ 基础环境就绪，可以运行部署脚本');
    if (pnpmOk) {
      console.log('   💡 下一步: pnpm run build && pnpm start');
    } else {
      console.log('   💡 下一步: npm run build && npm start');
    }
    
    if (!gitOk) {
      console.log('   ⚠️  建议安装 Git 以便版本控制');
    }
  } else {
    console.log('   ❌ 环境不完整，请先安装缺失的组件');
    
    const missing: string[] = [];
    if (!nodeOk) missing.push('Node.js');
    if (!npmOk && !pnpmOk) missing.push('npm/pnpm');
    if (!gitOk) missing.push('Git');
    if (!filesOk) missing.push('项目文件');
    
    console.log(`   💡 需要安装: ${missing.join(', ')}`);
  }
  
  console.log('');
  console.log('🔗 更多帮助: 查看项目文档');
}

// 显示帮助信息
function showHelp(): void {
  console.log('邮件助手环境检查工具');
  console.log('');
  console.log('使用方法:');
  console.log('  tsx check-environment.ts [选项]');
  console.log('');
  console.log('选项:');
  console.log('  -h, --help     显示帮助信息');
  console.log('');
  console.log('功能:');
  console.log('  • 检查 Node.js 和 npm/pnpm 安装状态');
  console.log('  • 检查 Git 安装状态');
  console.log('  • 检查用户权限和端口可用性');
  console.log('  • 检查防火墙设置');
  console.log('  • 验证项目文件完整性');
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

// 运行环境检查
if (require.main === module) {
  parseArgs();
  main().catch(error => {
    console.error('环境检查执行失败:', error);
    process.exit(1);
  });
}