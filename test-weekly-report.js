const dotenv = require('dotenv');

// 加载测试环境配置
dotenv.config({ path: '.env.test' });

// 设置测试环境变量
process.env.NODE_ENV = 'test';
process.env.AI_PROVIDER = 'mock';

async function testWeeklyReport() {
  try {
    console.log('🧪 开始测试周报功能...');
    
    // 使用require导入服务
    const WeeklyReportService = require('./dist/services/weeklyReportService.js').default;
    const ContextService = require('./dist/services/contextService.js').default;
    const UserService = require('./dist/services/userService.js').default;
    
    // 初始化服务
    const weeklyService = new WeeklyReportService();
    const contextService = new ContextService();
    const userService = new UserService();
    
    await weeklyService.initialize();
    await contextService.initialize();
    await userService.initialize();
    
    console.log('✅ 服务初始化完成');
    
    // 添加一些测试数据
    console.log('📝 添加测试工作记录...');
    
    const testEntries = [
      {
        type: 'work_summary',
        content: '今天完成了用户认证模块的开发，包括登录、注册和密码重置功能。代码已提交并通过了单元测试。',
        metadata: { date: '2025-01-06' }
      },
      {
        type: 'work_summary', 
        content: '优化了数据库查询性能，将响应时间从200ms降低到50ms。重构了用户服务的代码结构。',
        metadata: { date: '2025-01-07' }
      },
      {
        type: 'work_summary',
        content: '完成了API文档的编写，修复了3个已知bug。参与了技术方案评审会议。',
        metadata: { date: '2025-01-08' }
      },
      {
        type: 'work_summary',
        content: '实现了邮件通知功能，集成了第三方短信服务。进行了代码review并优化了错误处理。',
        metadata: { date: '2025-01-09' }
      },
      {
        type: 'work_summary',
        content: '部署了测试环境，完成了端到端测试。编写了用户操作手册，准备下周的产品演示。',
        metadata: { date: '2025-01-10' }
      }
    ];
    
    for (const entry of testEntries) {
      await contextService.addEntry(entry.type, entry.content, entry.metadata, 'admin');
    }
    
    console.log('✅ 测试数据添加完成');
    
    // 生成周报
    console.log('📊 生成周报...');
    const report = await weeklyService.generateWeeklyReport('admin', 0);
    
    console.log('\n📈 周报生成成功！');
    console.log('=====================================');
    console.log(`标题: ${report.title}`);
    console.log(`概述: ${report.summary}`);
    console.log('\n🎯 主要成就:');
    report.achievements.forEach((item, index) => {
      console.log(`${index + 1}. ${item}`);
    });
    console.log('\n🚧 遇到的挑战:');
    report.challenges.forEach((item, index) => {
      console.log(`${index + 1}. ${item}`);
    });
    console.log('\n💡 深度洞察:');
    report.insights.forEach((item, index) => {
      console.log(`${index + 1}. ${item}`);
    });
    console.log('\n🔧 改进建议:');
    report.recommendations.forEach((item, index) => {
      console.log(`${index + 1}. ${item}`);
    });
    console.log('\n📊 工作指标:');
    console.log(`- 活跃工作天数: ${report.metrics.activeDays}/7 天`);
    console.log(`- 工作记录总数: ${report.metrics.totalReports} 条`);
    console.log(`- 生产力趋势: ${report.metrics.productivityTrend}`);
    console.log('\n🎯 下周目标:');
    report.nextWeekGoals.forEach((item, index) => {
      console.log(`${index + 1}. ${item}`);
    });
    console.log('=====================================');
    
    console.log('\n✅ 周报功能测试完成！');
    
  } catch (error) {
    console.error('❌ 测试失败:', error);
    process.exit(1);
  }
}

testWeeklyReport();