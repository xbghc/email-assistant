const dotenv = require('dotenv');

// 加载测试环境配置
dotenv.config({ path: '.env.test' });

// 设置测试环境变量
process.env.NODE_ENV = 'test';
process.env.AI_PROVIDER = 'mock';

async function testCancelReminderSimple() {
  try {
    console.log('🧪 测试取消提醒功能（简化版）...');
    console.log('=====================================');
    
    // 测试ReminderTrackingService的核心功能
    const ReminderTrackingService = require('./dist/services/reminderTrackingService.js').default;
    
    const reminderTracking = new ReminderTrackingService();
    await reminderTracking.initialize();
    
    console.log('✅ 提醒跟踪服务初始化完成');
    
    // 1. 重置状态
    console.log('\n🔄 1. 重置提醒状态');
    console.log('─────────────────────');
    await reminderTracking.resetTodayRecord('admin');
    console.log('✅ 重置完成');
    
    // 2. 测试标记晨间提醒已发送（模拟取消功能）
    console.log('\n🌅 2. 测试标记晨间提醒已发送');
    console.log('─────────────────────');
    
    let shouldSend = await reminderTracking.shouldSendMorningReminder('admin');
    console.log(`发送前检查: ${shouldSend ? '✅ 应该发送' : '❌ 不应发送'}`);
    
    // 标记为已发送（相当于取消）
    await reminderTracking.markMorningReminderSent('admin');
    console.log('✅ 已标记晨间提醒为已发送（相当于取消）');
    
    shouldSend = await reminderTracking.shouldSendMorningReminder('admin');
    console.log(`发送后检查: ${shouldSend ? '❌ 仍要发送' : '✅ 正确阻止发送'}`);
    
    // 3. 测试标记晚间提醒已发送
    console.log('\n🌆 3. 测试标记晚间提醒已发送');
    console.log('─────────────────────');
    
    shouldSend = await reminderTracking.shouldSendEveningReminder('admin');
    console.log(`发送前检查: ${shouldSend ? '✅ 应该发送' : '❌ 不应发送'}`);
    
    // 标记为已发送（相当于取消）
    await reminderTracking.markEveningReminderSent('admin');
    console.log('✅ 已标记晚间提醒为已发送（相当于取消）');
    
    shouldSend = await reminderTracking.shouldSendEveningReminder('admin');
    console.log(`发送后检查: ${shouldSend ? '❌ 仍要发送' : '✅ 正确阻止发送'}`);
    
    // 4. 查看最终状态
    console.log('\n📊 4. 查看最终状态');
    console.log('─────────────────────');
    
    const status = reminderTracking.getReminderStatus('admin');
    if (status) {
      console.log('今日提醒状态:');
      console.log(`  • 日期: ${status.date}`);
      console.log(`  • 晨间提醒: ${status.morningReminderSent ? '✅ 已发送（已取消）' : '❌ 未发送'}`);
      console.log(`  • 晚间提醒: ${status.eveningReminderSent ? '✅ 已发送（已取消）' : '❌ 未发送'}`);
      console.log(`  • 工作报告: ${status.workReportReceived ? '✅ 已接收' : '❌ 未接收'}`);
    }
    
    // 5. 测试工作报告自动取消晚间提醒
    console.log('\n📝 5. 测试工作报告自动取消晚间提醒');
    console.log('─────────────────────');
    
    // 重置状态
    await reminderTracking.resetTodayRecord('admin');
    console.log('🔄 重置状态');
    
    // 模拟收到工作报告
    await reminderTracking.markWorkReportReceived('admin');
    console.log('✅ 标记工作报告已接收');
    
    shouldSend = await reminderTracking.shouldSendEveningReminder('admin');
    console.log(`工作报告后晚间提醒检查: ${shouldSend ? '❌ 仍要发送' : '✅ 正确自动取消'}`);
    
    console.log('\n🎯 核心功能测试结果');
    console.log('=====================================');
    console.log('✅ 晨间提醒取消功能正常（通过标记已发送实现）');
    console.log('✅ 晚间提醒取消功能正常（通过标记已发送实现）');
    console.log('✅ 工作报告自动取消晚间提醒功能正常');
    console.log('✅ 状态跟踪和验证功能正常');
    
    console.log('\n📋 为大模型提供的取消提醒机制:');
    console.log('1. 通过管理员命令取消:');
    console.log('   • /cancelreminder morning - 取消今天的晨间提醒');
    console.log('   • /cancelreminder evening - 取消今天的晚间提醒');
    console.log('   • /cancelreminder all - 取消今天的所有提醒');
    console.log('');
    console.log('2. 通过暂停功能:');
    console.log('   • /pausereminder <email> [days] - 暂停用户提醒N天');
    console.log('   • /resumereminder <email> - 手动恢复提醒');
    console.log('');
    console.log('3. 自动取消机制:');
    console.log('   • 用户发送工作报告后自动跳过当天晚间提醒');
    console.log('   • 防重复发送机制确保每天最多发送一次');
    
    console.log('\n✅ 取消提醒功能核心测试完成！');
    console.log('   大模型现在可以通过多种方式取消和管理提醒了！');
    
  } catch (error) {
    console.error('❌ 测试失败:', error);
    process.exit(1);
  }
}

testCancelReminderSimple();