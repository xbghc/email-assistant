#!/usr/bin/env tsx

/**
 * 邮件助手服务器防火墙配置脚本
 * 用于开放Web管理界面的远程访问端口
 */

import { execSync } from 'child_process';

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

// 执行sudo命令
function execSudo(command: string): boolean {
  try {
    execSync(command, { stdio: 'inherit' });
    return true;
  } catch {
    return false;
  }
}

// 配置UFW防火墙
function configureUFW(port: number): boolean {
  console.log('检测到 UFW 防火墙');
  
  try {
    // 检查防火墙状态
    const status = safeExec('sudo ufw status');
    const isActive = status?.includes('Status: active');
    
    if (!isActive) {
      console.log('⚠️  UFW防火墙未启用，将启用并配置基本规则...');
      
      // 首先允许SSH连接（防止锁定）
      if (!execSudo('sudo ufw allow ssh')) {
        console.error('❌ 无法配置SSH规则');
        return false;
      }
      
      if (!execSudo('sudo ufw allow 22/tcp')) {
        console.error('❌ 无法配置TCP 22端口');
        return false;
      }
      
      // 允许基本的出站连接并启用防火墙
      if (!execSudo('sudo ufw --force enable')) {
        console.error('❌ 无法启用UFW防火墙');
        return false;
      }
      
      console.log('✅ 已开放SSH端口以防止锁定');
    } else {
      console.log('ℹ️  UFW防火墙已启用');
    }
    
    // 开放应用端口
    if (!execSudo(`sudo ufw allow ${port}/tcp`)) {
      console.error(`❌ 无法开放端口 ${port}`);
      return false;
    }
    
    // 显示状态
    console.log('\n当前防火墙状态:');
    execSudo('sudo ufw status');
    
    return true;
  } catch (error) {
    console.error('配置UFW时出错:', error);
    return false;
  }
}

// 配置firewalld防火墙
function configureFirewalld(port: number): boolean {
  console.log('检测到 firewalld 防火墙');
  
  try {
    // 开放端口
    if (!execSudo(`sudo firewall-cmd --permanent --add-port=${port}/tcp`)) {
      console.error(`❌ 无法开放端口 ${port}`);
      return false;
    }
    
    if (!execSudo('sudo firewall-cmd --reload')) {
      console.error('❌ 无法重新加载防火墙规则');
      return false;
    }
    
    // 显示状态
    console.log('\n当前开放的端口:');
    execSudo('sudo firewall-cmd --list-ports');
    
    return true;
  } catch (error) {
    console.error('配置firewalld时出错:', error);
    return false;
  }
}

// 配置iptables防火墙
function configureIptables(port: number): boolean {
  console.log('检测到 iptables 防火墙');
  
  try {
    // 开放端口
    if (!execSudo(`sudo iptables -A INPUT -p tcp --dport ${port} -j ACCEPT`)) {
      console.error(`❌ 无法开放端口 ${port}`);
      return false;
    }
    
    // 保存规则（根据系统而定）
    if (commandExists('iptables-save')) {
      safeExec('sudo iptables-save > /etc/iptables/rules.v4 2>/dev/null || true');
    }
    
    // 显示状态
    console.log('\n当前iptables规则:');
    execSudo('sudo iptables -L | grep -A 5 -B 5 ${port} || sudo iptables -L');
    
    return true;
  } catch (error) {
    console.error('配置iptables时出错:', error);
    return false;
  }
}

// 主函数
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  let port = 3000;
  
  // 解析端口参数
  if (args.length > 0) {
    const portArg = parseInt(args[0]);
    if (isNaN(portArg) || portArg < 1 || portArg > 65535) {
      console.error('❌ 无效的端口号，请输入1-65535之间的数字');
      process.exit(1);
    }
    port = portArg;
  }
  
  console.log(`🔧 配置防火墙以开放端口 ${port}...\n`);
  
  let success = false;
  
  // 检测防火墙类型并配置
  if (commandExists('ufw')) {
    success = configureUFW(port);
  } else if (commandExists('firewall-cmd')) {
    success = configureFirewalld(port);
  } else if (commandExists('iptables')) {
    success = configureIptables(port);
  } else {
    console.log('⚠️  未检测到已知的防火墙工具');
    console.log(`请手动配置防火墙开放端口 ${port}`);
    
    console.log('\n手动配置示例:');
    console.log('UFW:        sudo ufw allow ${port}/tcp');
    console.log('firewalld:  sudo firewall-cmd --permanent --add-port=${port}/tcp && sudo firewall-cmd --reload');
    console.log('iptables:   sudo iptables -A INPUT -p tcp --dport ${port} -j ACCEPT');
  }
  
  if (success) {
    console.log('\n✅ 防火墙配置完成！');
  } else {
    console.log('\n❌ 防火墙配置失败，请检查sudo权限或手动配置');
  }
  
  console.log('\n📱 Web管理界面将在以下地址可用:');
  console.log(`   本地访问: http://localhost:${port}`);
  console.log(`   远程访问: http://YOUR_SERVER_IP:${port}`);
  console.log('\n⚠️  注意事项:');
  console.log('1. 请将 YOUR_SERVER_IP 替换为服务器的实际IP地址');
  console.log(`2. 确保云服务商的安全组也开放了端口 ${port}`);
  console.log('3. 考虑使用反向代理（如Nginx）和SSL证书提高安全性');
  console.log('4. 定期检查防火墙日志以监控安全状况');
  
  process.exit(success ? 0 : 1);
}

// 显示帮助信息
function showHelp(): void {
  console.log('邮件助手服务器防火墙配置脚本');
  console.log('');
  console.log('使用方法:');
  console.log('  tsx configure-firewall.ts [端口号]');
  console.log('');
  console.log('参数:');
  console.log('  端口号    要开放的端口号 (默认: 3000)');
  console.log('');
  console.log('选项:');
  console.log('  -h, --help     显示帮助信息');
  console.log('');
  console.log('示例:');
  console.log('  tsx configure-firewall.ts        # 开放端口3000');
  console.log('  tsx configure-firewall.ts 8080   # 开放端口8080');
  console.log('');
  console.log('支持的防火墙:');
  console.log('  • UFW (Ubuntu)');
  console.log('  • firewalld (CentOS/RHEL)');
  console.log('  • iptables (通用)');
}

// 解析命令行参数
function parseArgs(): void {
  const args = process.argv.slice(2);
  
  for (const arg of args) {
    if (arg === '-h' || arg === '--help') {
      showHelp();
      process.exit(0);
    }
  }
}

// 运行脚本
if (import.meta.url === `file://${process.argv[1]}`) {
  parseArgs();
  main().catch(error => {
    console.error('防火墙配置执行失败:', error);
    process.exit(1);
  });
}