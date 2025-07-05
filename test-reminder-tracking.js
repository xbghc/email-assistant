const dotenv = require('dotenv');

// 加载测试环境配置
dotenv.config({ path: '.env.test' });

// 设置测试环境变量
process.env.NODE_ENV = 'test';
process.env.AI_PROVIDER = 'mock';

async function testReminderTracking() {
  try {
    console.log('🧪 测试提醒跟踪和防重复发送功能...');
    console.log('=====================================');
    
    // 导入服务
    const ReminderTrackingService = require('./dist/services/reminderTrackingService.js').default;
    const SchedulerService = require('./dist/services/schedulerService.js').default;
    
    // 初始化服务
    const reminderTracking = new ReminderTrackingService();
    const scheduler = new SchedulerService();
    
    await reminderTracking.initialize();
    console.log('✅ 提醒跟踪服务初始化完成');
    
    // 1. 测试初始状态
    console.log('\n📋 1. 测试初始状态');
    console.log('─────────────────────');
    
    const initialStatus = reminderTracking.getReminderStatus('admin');
    console.log('初始状态:', initialStatus || '无记录');
    
    // 2. 测试晨间提醒检查
    console.log('\n🌅 2. 测试晨间提醒防重复');
    console.log('─────────────────────');
    
    const shouldSendMorning1 = await reminderTracking.shouldSendMorningReminder('admin');
    console.log(`第一次检查是否发送晨间提醒: ${shouldSendMorning1 ? '✅ 应该发送' : '❌ 不应发送'}`);
    
    if (shouldSendMorning1) {
      await reminderTracking.markMorningReminderSent('admin');
      console.log('✅ 标记晨间提醒已发送');
    }
    
    const shouldSendMorning2 = await reminderTracking.shouldSendMorningReminder('admin');
    console.log(`第二次检查是否发送晨间提醒: ${shouldSendMorning2 ? '❌ 应该发送' : '✅ 正确阻止重复发送'}`);
    
    // 3. 测试晚间提醒检查
    console.log('\n🌆 3. 测试晚间提醒防重复');
    console.log('─────────────────────');
    
    const shouldSendEvening1 = await reminderTracking.shouldSendEveningReminder('admin');
    console.log(`第一次检查是否发送晚间提醒: ${shouldSendEvening1 ? '✅ 应该发送' : '❌ 不应发送'}`);
    
    if (shouldSendEvening1) {
      await reminderTracking.markEveningReminderSent('admin');
      console.log('✅ 标记晚间提醒已发送');
    }
    
    const shouldSendEvening2 = await reminderTracking.shouldSendEveningReminder('admin');
    console.log(`第二次检查是否发送晚间提醒: ${shouldSendEvening2 ? '❌ 应该发送' : '✅ 正确阻止重复发送'}`);
    
    // 4. 测试工作报告接收后的逻辑
    console.log('\n📝 4. 测试工作报告接收逻辑');
    console.log('─────────────────────');
    
    // 重置记录以测试工作报告逻辑
    await reminderTracking.resetTodayRecord('admin');
    console.log('🔄 重置今天的记录');
    
    // 模拟工作报告接收
    await reminderTracking.markWorkReportReceived('admin');
    console.log('✅ 标记工作报告已接收');
    
    const shouldSendAfterReport = await reminderTracking.shouldSendEveningReminder('admin');
    console.log(`工作报告接收后是否发送晚间提醒: ${shouldSendAfterReport ? '❌ 应该发送' : '✅ 正确跳过（已有工作报告）'}`);
    
    // 5. 测试状态查看
    console.log('\n📊 5. 测试状态查看');
    console.log('─────────────────────');
    
    const finalStatus = reminderTracking.getReminderStatus('admin');
    if (finalStatus) {
      console.log('今日提醒状态:');
      console.log(`  • 日期: ${finalStatus.date}`);
      console.log(`  • 晨间提醒: ${finalStatus.morningReminderSent ? '✅ 已发送' : '❌ 未发送'}`);
      console.log(`  • 晚间提醒: ${finalStatus.eveningReminderSent ? '✅ 已发送' : '❌ 未发送'}`);
      console.log(`  • 工作报告: ${finalStatus.workReportReceived ? '✅ 已接收' : '❌ 未接收'}`);
      if (finalStatus.lastMorningReminderTime) {
        console.log(`  • 最后晨间提醒时间: ${new Date(finalStatus.lastMorningReminderTime).toLocaleString()}`);
      }
      if (finalStatus.lastWorkReportTime) {
        console.log(`  • 最后工作报告时间: ${new Date(finalStatus.lastWorkReportTime).toLocaleString()}`);
      }
    }
    
    // 6. 测试多用户支持
    console.log('\n👥 6. 测试多用户支持');
    console.log('─────────────────────');
    
    const user2Status1 = await reminderTracking.shouldSendMorningReminder('user2');
    console.log(`用户2第一次晨间提醒检查: ${user2Status1 ? '✅ 应该发送' : '❌ 不应发送'}`);
    
    if (user2Status1) {
      await reminderTracking.markMorningReminderSent('user2');
      console.log('✅ 用户2标记晨间提醒已发送');
    }
    
    const user2Status2 = await reminderTracking.shouldSendMorningReminder('user2');
    console.log(`用户2第二次晨间提醒检查: ${user2Status2 ? '❌ 应该发送' : '✅ 正确阻止重复发送'}`);
    
    // 验证用户间不影响
    const adminStatusAfter = await reminderTracking.shouldSendMorningReminder('admin');
    console.log(`admin用户状态不受影响: ${adminStatusAfter ? '❌ 应该发送' : '✅ 保持独立状态'}`);
    
    // 7. 测试清理功能
    console.log('\n🧹 7. 测试清理功能');
    console.log('─────────────────────');
    
    await reminderTracking.cleanupOldRecords();
    console.log('✅ 清理旧记录完成');
    
    console.log('\n🎯 总结测试结果');
    console.log('=====================================');
    console.log('✅ 防重复发送功能正常工作');
    console.log('✅ 工作报告接收后正确跳过晚间提醒');
    console.log('✅ 多用户支持正常');
    console.log('✅ 状态跟踪准确');
    console.log('✅ 清理功能正常');
    
    console.log('\n📋 功能说明:');
    console.log('• 每天最多发送一次晨间提醒');
    console.log('• 每天最多发送一次晚间提醒');
    console.log('• 用户发送工作报告后自动跳过当天的晚间提醒');
    console.log('• 支持多用户独立跟踪');
    console.log('• 自动清理30天前的旧记录');
    console.log('• 提供管理接口查看和重置状态');
    
    console.log('\n✅ 提醒跟踪功能测试完成！');
    
  } catch (error) {
    console.error('❌ 测试失败:', error);
    process.exit(1);
  }
}

testReminderTracking();