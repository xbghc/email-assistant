#!/usr/bin/env tsx

/**
 * 紧急防火墙修复脚本
 * 用于恢复被锁定的SSH访问
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

// 修复UFW防火墙
function fixUFW(): boolean {
  console.log('🔧 修复UFW防火墙配置...');
  
  try {
    const commands = [
      'sudo ufw allow ssh',
      'sudo ufw allow 22/tcp',
      'sudo ufw allow 2222/tcp',  // 备用SSH端口
      'sudo ufw allow 80/tcp',    // HTTP
      'sudo ufw allow 443/tcp',   // HTTPS
      'sudo ufw allow 3000/tcp'   // 邮件助手
    ];
    
    let success = true;
    for (const command of commands) {
      if (!execSudo(command)) {
        console.error(`❌ 执行失败: ${command}`);
        success = false;
      }
    }
    
    if (success) {
      console.log('✅ SSH访问已恢复');
      console.log('\n当前UFW状态:');
      execSudo('sudo ufw status');
    }
    
    return success;
  } catch (error) {
    console.error('修复UFW时出错:', error);
    return false;
  }
}

// 修复firewalld防火墙
function fixFirewalld(): boolean {
  console.log('🔧 修复firewalld配置...');
  
  try {
    const commands = [
      'sudo firewall-cmd --permanent --add-service=ssh',
      'sudo firewall-cmd --permanent --add-port=22/tcp',
      'sudo firewall-cmd --permanent --add-port=2222/tcp',
      'sudo firewall-cmd --permanent --add-port=80/tcp',
      'sudo firewall-cmd --permanent --add-port=443/tcp',
      'sudo firewall-cmd --permanent --add-port=3000/tcp',
      'sudo firewall-cmd --reload'
    ];
    
    let success = true;
    for (const command of commands) {
      if (!execSudo(command)) {
        console.error(`❌ 执行失败: ${command}`);
        success = false;
      }
    }
    
    if (success) {
      console.log('✅ SSH访问已恢复');
      console.log('\n当前firewalld状态:');
      execSudo('sudo firewall-cmd --list-all');
    }
    
    return success;
  } catch (error) {
    console.error('修复firewalld时出错:', error);
    return false;
  }
}

// 修复iptables防火墙
function fixIptables(): boolean {
  console.log('🔧 修复iptables配置...');
  
  try {
    const commands = [
      'sudo iptables -I INPUT -p tcp --dport 22 -j ACCEPT',
      'sudo iptables -I INPUT -p tcp --dport 2222 -j ACCEPT',
      'sudo iptables -I INPUT -p tcp --dport 3000 -j ACCEPT',
      'sudo iptables -I INPUT -p tcp --dport 80 -j ACCEPT',
      'sudo iptables -I INPUT -p tcp --dport 443 -j ACCEPT'
    ];
    
    let success = true;
    for (const command of commands) {
      if (!execSudo(command)) {
        console.error(`❌ 执行失败: ${command}`);
        success = false;
      }
    }
    
    // 保存规则
    if (commandExists('iptables-save')) {
      safeExec('sudo iptables-save > /etc/iptables/rules.v4 2>/dev/null || true');
    }
    
    if (success) {
      console.log('✅ SSH访问已恢复');
      console.log('\n当前iptables规则:');
      execSudo('sudo iptables -L | head -20');
    }
    
    return success;
  } catch (error) {
    console.error('修复iptables时出错:', error);
    return false;
  }
}

// 主函数
async function main(): Promise<void> {
  console.log('🚨 紧急防火墙修复脚本');
  console.log('用于恢复SSH访问权限');
  console.log('================================\n');
  
  let success = false;
  
  // 检测防火墙类型并修复
  if (commandExists('ufw')) {
    success = fixUFW();
  } else if (commandExists('firewall-cmd')) {
    success = fixFirewalld();
  } else if (commandExists('iptables')) {
    success = fixIptables();
  } else {
    console.log('⚠️  未检测到防火墙，可能不是防火墙问题');
    console.log('\n可能的问题:');
    console.log('• SSH服务未运行');
    console.log('• 网络连接问题');
    console.log('• 云服务商安全组设置');
    console.log('• 用户权限问题');
  }
  
  console.log('\n🔗 如果仍无法SSH访问，请尝试:');
  console.log('1. 检查SSH服务状态: sudo systemctl status ssh');
  console.log('2. 检查云服务商安全组设置');
  console.log('3. 重启SSH服务: sudo systemctl restart ssh');
  console.log('4. 重启服务器');
  console.log('5. 通过云控制台VNC访问');
  console.log('6. 临时关闭防火墙测试:');
  console.log('   • UFW: sudo ufw disable');
  console.log('   • firewalld: sudo systemctl stop firewalld');
  console.log('   • iptables: sudo iptables -F');
  
  console.log('\n⚠️  注意: 临时关闭防火墙会降低安全性，修复后请重新启用');
  
  if (success) {
    console.log('\n✅ 防火墙修复完成，SSH访问应已恢复');
  } else {
    console.log('\n❌ 防火墙修复失败，请检查sudo权限或手动操作');
  }
  
  process.exit(success ? 0 : 1);
}

// 显示帮助信息
function showHelp(): void {
  console.log('紧急防火墙修复脚本');
  console.log('');
  console.log('使用方法:');
  console.log('  tsx emergency-firewall-fix.ts [选项]');
  console.log('');
  console.log('选项:');
  console.log('  -h, --help     显示帮助信息');
  console.log('');
  console.log('功能:');
  console.log('  • 自动检测防火墙类型');
  console.log('  • 恢复SSH访问端口 (22, 2222)');
  console.log('  • 开放常用服务端口 (80, 443, 3000)');
  console.log('  • 提供进一步的故障排除建议');
  console.log('');
  console.log('注意:');
  console.log('  此脚本需要sudo权限才能修改防火墙规则');
  console.log('  建议在确认网络问题后再运行此脚本');
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

// 运行脚本
if (import.meta.url === `file://${process.argv[1]}`) {
  parseArgs();
  main().catch(error => {
    console.error('紧急防火墙修复执行失败:', error);
    process.exit(1);
  });
}