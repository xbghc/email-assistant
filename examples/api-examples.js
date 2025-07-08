#!/usr/bin/env node

/**
 * Email Assistant API 使用示例
 * 
 * 本文件展示了如何使用 Email Assistant 的各种 API 端点
 * 
 * 运行方法:
 * 1. 确保 Email Assistant 服务正在运行 (npm start)
 * 2. 创建管理员账户 (node scripts/create-admin.js admin@example.com password123)
 * 3. 运行示例: node examples/api-examples.js
 */

/* eslint-env node */

const https = require('https');
const http = require('http');

// 配置
const CONFIG = {
  baseUrl: 'http://localhost:3000',
  adminEmail: 'admin@example.com',
  adminPassword: 'password123'
};

/**
 * HTTP 请求工具函数
 */
function makeRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const protocol = options.protocol === 'https:' ? https : http;
    
    const req = protocol.request(options, (res) => {
      let body = '';
      
      res.on('data', chunk => {
        body += chunk;
      });
      
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(body);
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            data: jsonData
          });
        } catch {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            data: body
          });
        }
      });
    });
    
    req.on('error', reject);
    
    if (data) {
      req.write(typeof data === 'string' ? data : JSON.stringify(data));
    }
    
    req.end();
  });
}

/**
 * 解析URL
 */
function parseUrl(url) {
  const urlObj = new URL(url);
  return {
    protocol: urlObj.protocol,
    hostname: urlObj.hostname,
    port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
    path: urlObj.pathname + urlObj.search
  };
}

/**
 * API 客户端类
 */
class EmailAssistantAPIClient {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
    this.token = null;
  }
  
  /**
   * 发送请求
   */
  async request(method, endpoint, data = null, headers = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const urlOptions = parseUrl(url);
    
    const options = {
      ...urlOptions,
      method: method.toUpperCase(),
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'EmailAssistant-API-Client/1.0.0',
        ...headers
      }
    };
    
    // 添加认证头
    if (this.token) {
      options.headers.Authorization = `Bearer ${this.token}`;
    }
    
    console.log(`📡 ${method.toUpperCase()} ${endpoint}`);
    
    try {
      const response = await makeRequest(options, data);
      
      if (response.statusCode >= 200 && response.statusCode < 300) {
        console.log(`✅ ${response.statusCode} - 成功`);
        return response.data;
      } else {
        console.log(`❌ ${response.statusCode} - 失败`);
        console.log('响应:', response.data);
        throw new Error(`HTTP ${response.statusCode}: ${JSON.stringify(response.data)}`);
      }
    } catch (error) {
      console.log(`🚨 请求失败: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * 用户登录
   */
  async login(email, password) {
    console.log('\n🔐 用户登录...');
    const response = await this.request('POST', '/api/auth/login', {
      email,
      password
    });
    
    this.token = response.data.token;
    console.log(`✨ 登录成功，用户: ${response.data.user.email}`);
    return response.data;
  }
  
  /**
   * 健康检查
   */
  async healthCheck() {
    console.log('\n🏥 健康检查...');
    const response = await this.request('GET', '/health');
    console.log(`💚 系统状态: ${response.status}`);
    console.log(`⏰ 运行时间: ${response.uptime}秒`);
    return response;
  }
  
  /**
   * 获取当前用户信息
   */
  async getCurrentUser() {
    console.log('\n👤 获取当前用户信息...');
    const response = await this.request('GET', '/api/users/me');
    console.log(`👋 用户: ${response.data.name} (${response.data.email})`);
    console.log(`🎭 角色: ${response.data.role}`);
    return response.data;
  }
  
  /**
   * 获取今日日程
   */
  async getTodaySchedule() {
    console.log('\n📅 获取今日日程...');
    const response = await this.request('GET', '/api/schedule/today');
    
    if (response.data && response.data.events && response.data.events.length > 0) {
      console.log(`📋 今日共有 ${response.data.events.length} 个事件:`);
      response.data.events.forEach(event => {
        console.log(`  🕐 ${event.time} - ${event.title}`);
        if (event.description) {
          console.log(`      ${event.description}`);
        }
      });
    } else {
      console.log('📭 今日暂无日程安排');
    }
    
    return response.data;
  }
  
  /**
   * 创建日程
   */
  async createSchedule(date, events) {
    console.log(`\n📝 创建 ${date} 的日程...`);
    const response = await this.request('POST', '/api/schedule', {
      date,
      events
    });
    
    console.log(`✨ 成功创建 ${events.length} 个事件`);
    return response.data;
  }
  
  /**
   * 提交工作报告
   */
  async submitWorkReport(report) {
    console.log('\n📊 提交工作报告...');
    const response = await this.request('POST', '/api/work-report', {
      report,
      date: new Date().toISOString().split('T')[0],
      mood: 'good',
      productivity: 8
    });
    
    console.log('🤖 AI 分析结果:');
    console.log(`   📝 总结: ${response.data.aiSummary}`);
    
    if (response.data.suggestions && response.data.suggestions.length > 0) {
      console.log('   💡 建议:');
      response.data.suggestions.forEach(suggestion => {
        console.log(`      • ${suggestion}`);
      });
    }
    
    return response.data;
  }
  
  /**
   * 测试晨间提醒
   */
  async testMorningReminder() {
    console.log('\n🌅 测试晨间提醒...');
    const response = await this.request('POST', '/api/test/morning-reminder');
    console.log('📧 晨间提醒邮件发送成功');
    return response;
  }
  
  /**
   * 测试晚间提醒
   */
  async testEveningReminder() {
    console.log('\n🌙 测试晚间提醒...');
    const response = await this.request('POST', '/api/test/evening-reminder');
    console.log('📧 晚间提醒邮件发送成功');
    return response;
  }
  
  /**
   * 获取系统状态 (需要管理员权限)
   */
  async getSystemStatus() {
    console.log('\n📊 获取系统状态...');
    try {
      const response = await this.request('GET', '/api/admin/status');
      
      console.log('🖥️  系统信息:');
      console.log(`   ⏱️  运行时间: ${response.data.system.uptime}秒`);
      console.log(`   💾 内存使用: ${Math.round(response.data.system.memoryUsage.heapUsed / 1024 / 1024)}MB`);
      console.log(`   🔥 CPU使用率: ${response.data.system.cpuUsage}%`);
      
      console.log('📧 邮件服务:');
      console.log(`   📊 状态: ${response.data.email.status}`);
      console.log(`   📨 今日发送: ${response.data.email.sentToday}封`);
      
      console.log('🤖 AI服务:');
      console.log(`   🔌 提供商: ${response.data.ai.provider}`);
      console.log(`   📊 状态: ${response.data.ai.status}`);
      console.log(`   📈 今日请求: ${response.data.ai.requestsToday}次`);
      
      return response.data;
    } catch (error) {
      console.log('⚠️  无法获取系统状态 (可能需要管理员权限)');
      throw error;
    }
  }
  
  /**
   * 获取性能指标
   */
  async getMetrics() {
    console.log('\n📈 获取性能指标...');
    const response = await this.request('GET', '/api/metrics');
    
    console.log('💻 系统性能:');
    console.log(`   🔥 CPU使用率: ${response.data.cpu.usage}%`);
    console.log(`   💾 内存使用率: ${response.data.memory.usage}%`);
    console.log(`   ⏱️  平均响应时间: ${response.data.application.responseTime}ms`);
    console.log(`   📊 每分钟请求数: ${response.data.application.requestsPerMinute}`);
    console.log(`   ❌ 错误率: ${(response.data.application.errorRate * 100).toFixed(2)}%`);
    
    return response.data;
  }
}

/**
 * 演示完整的 API 使用流程
 */
async function demonstrateAPI() {
  console.log('🚀 Email Assistant API 演示');
  console.log('============================');
  
  const client = new EmailAssistantAPIClient(CONFIG.baseUrl);
  
  try {
    // 1. 健康检查
    await client.healthCheck();
    
    // 2. 用户登录
    await client.login(CONFIG.adminEmail, CONFIG.adminPassword);
    
    // 3. 获取用户信息
    await client.getCurrentUser();
    
    // 4. 获取今日日程
    await client.getTodaySchedule();
    
    // 5. 创建示例日程
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    
    await client.createSchedule(tomorrowStr, [
      {
        time: '09:00',
        title: 'API 演示会议',
        description: '展示 Email Assistant API 功能',
        priority: 'high'
      },
      {
        time: '14:00',
        title: '代码review',
        description: '审查新功能代码',
        priority: 'medium'
      }
    ]);
    
    // 6. 提交工作报告
    await client.submitWorkReport(
      '今天完成了 Email Assistant API 的演示文档编写，' +
      '包括各种端点的使用示例和错误处理。' +
      '明天计划进行API的性能优化和安全加固。'
    );
    
    // 7. 获取性能指标
    await client.getMetrics();
    
    // 8. 获取系统状态 (管理员功能)
    await client.getSystemStatus();
    
    // 9. 测试提醒功能 (可选，会发送邮件)
    const testReminders = process.argv.includes('--test-reminders');
    if (testReminders) {
      console.log('\n📧 测试邮件提醒功能 (将发送实际邮件)...');
      await client.testMorningReminder();
      await client.testEveningReminder();
    } else {
      console.log('\n💡 提示: 使用 --test-reminders 参数来测试邮件提醒功能');
    }
    
    console.log('\n🎉 API 演示完成!');
    console.log('\n📚 更多信息:');
    console.log('   📖 API文档: ./API_DOCUMENTATION.md');
    console.log('   🔗 健康检查: http://localhost:3000/health');
    console.log('   🌐 Web界面: http://localhost:3000/');
    
  } catch (error) {
    console.error('\n❌ 演示失败:', error.message);
    
    console.log('\n🔧 故障排除:');
    console.log('   1. 确保 Email Assistant 服务正在运行: npm start');
    console.log('   2. 检查服务地址: http://localhost:3000/health');
    console.log('   3. 确保管理员账户已创建: node scripts/create-admin.js admin@example.com password123');
    console.log('   4. 检查网络连接和防火墙设置');
    
    process.exit(1);
  }
}

/**
 * 显示帮助信息
 */
function showHelp() {
  console.log('Email Assistant API 演示脚本');
  console.log('');
  console.log('使用方法:');
  console.log('  node examples/api-examples.js [选项]');
  console.log('');
  console.log('选项:');
  console.log('  --test-reminders  测试邮件提醒功能 (会发送实际邮件)');
  console.log('  --help           显示此帮助信息');
  console.log('');
  console.log('示例:');
  console.log('  node examples/api-examples.js');
  console.log('  node examples/api-examples.js --test-reminders');
  console.log('');
  console.log('前置条件:');
  console.log('  1. Email Assistant 服务正在运行');
  console.log('  2. 已创建管理员账户');
  console.log('  3. 网络连接正常');
}

// 处理命令行参数
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  showHelp();
  process.exit(0);
}

// 处理未捕获的异常
process.on('unhandledRejection', (reason, _promise) => {
  console.error('❌ 未处理的Promise拒绝:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('❌ 未捕获的异常:', error);
  process.exit(1);
});

// 运行演示
if (require.main === module) {
  demonstrateAPI();
}

// 导出客户端类供其他模块使用
module.exports = {
  EmailAssistantAPIClient,
  CONFIG
};