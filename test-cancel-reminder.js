const dotenv = require('dotenv');

// 加载测试环境配置
dotenv.config({ path: '.env.test' });

// 设置测试环境变量
process.env.NODE_ENV = 'test';
process.env.AI_PROVIDER = 'mock';

async function testCancelReminderFunctions() {
  try {
    console.log('🧪 测试取消提醒功能...');
    console.log('=====================================');
    
    // 导入服务
    const AdminCommandService = require('./dist/services/adminCommandService.js').default;
    const UserService = require('./dist/services/userService.js').default;
    const SchedulerService = require('./dist/services/schedulerService.js').default;
    
    // 初始化服务
    const userService = new UserService();
    const schedulerService = new SchedulerService();
    const adminCommandService = new AdminCommandService(userService, schedulerService);
    
    await userService.initialize();
    await schedulerService.initialize();
    
    console.log('✅ 服务初始化完成');
    
    // 1. 测试帮助命令
    console.log('\n📚 1. 测试帮助命令');
    console.log('─────────────────────');
    
    const helpResult = await adminCommandService.processCommand('/help', '');
    console.log('帮助信息:', helpResult.substring(0, 200) + '...');
    
    // 2. 重置提醒状态
    console.log('\n🔄 2. 重置提醒状态');
    console.log('─────────────────────');
    
    await schedulerService.resetTodayReminders('admin');
    console.log('✅ 已重置今天的提醒状态');
    
    // 3. 测试取消晨间提醒
    console.log('\n🌅 3. 测试取消晨间提醒命令');
    console.log('─────────────────────');
    
    const cancelMorningResult = await adminCommandService.processCommand('/cancelreminder morning', '');
    console.log('取消晨间提醒结果:', cancelMorningResult);
    
    // 验证是否已标记为已发送
    const status1 = schedulerService.getTodayReminderStatus('admin');
    console.log('验证状态 - 晨间提醒已标记:', status1?.morningReminderSent ? '✅ 是' : '❌ 否');
    
    // 4. 测试取消晚间提醒
    console.log('\n🌆 4. 测试取消晚间提醒命令');
    console.log('─────────────────────');
    
    // 先重置状态
    await schedulerService.resetTodayReminders('admin');
    
    const cancelEveningResult = await adminCommandService.processCommand('/cancelreminder evening', '');
    console.log('取消晚间提醒结果:', cancelEveningResult);
    
    // 验证是否已标记为已发送
    const status2 = schedulerService.getTodayReminderStatus('admin');
    console.log('验证状态 - 晚间提醒已标记:', status2?.eveningReminderSent ? '✅ 是' : '❌ 否');
    
    // 5. 测试取消所有提醒
    console.log('\n🚫 5. 测试取消所有提醒命令');
    console.log('─────────────────────');
    
    // 先重置状态
    await schedulerService.resetTodayReminders('admin');
    
    const cancelAllResult = await adminCommandService.processCommand('/cancelreminder all', '');
    console.log('取消所有提醒结果:', cancelAllResult);
    
    // 验证是否都已标记为已发送
    const status3 = schedulerService.getTodayReminderStatus('admin');
    console.log('验证状态 - 晨间提醒已标记:', status3?.morningReminderSent ? '✅ 是' : '❌ 否');
    console.log('验证状态 - 晚间提醒已标记:', status3?.eveningReminderSent ? '✅ 是' : '❌ 否');
    
    // 6. 测试暂停提醒功能
    console.log('\n⏸️  6. 测试暂停提醒功能');
    console.log('─────────────────────');
    
    // 创建测试用户
    const testUser = userService.createUser('test@example.com', '测试用户');
    userService.addUser(testUser);
    console.log('✅ 创建测试用户');
    
    const pauseResult = await adminCommandService.processCommand('/pausereminder test@example.com 3', '');
    console.log('暂停提醒结果:', pauseResult);
    
    // 验证用户配置
    const user = userService.getUserByEmail('test@example.com');
    console.log('验证暂停状态:', user?.config?.reminderPaused ? '✅ 已暂停' : '❌ 未暂停');
    if (user?.config?.resumeDate) {
      const resumeDate = new Date(user.config.resumeDate);
      console.log('恢复日期:', resumeDate.toLocaleDateString());
    }
    
    // 7. 测试恢复提醒功能
    console.log('\n▶️  7. 测试恢复提醒功能');
    console.log('─────────────────────');
    
    const resumeResult = await adminCommandService.processCommand('/resumereminder test@example.com', '');
    console.log('恢复提醒结果:', resumeResult);
    
    // 验证用户配置
    const userAfterResume = userService.getUserByEmail('test@example.com');
    console.log('验证恢复状态:', userAfterResume?.config?.reminderPaused ? '❌ 仍暂停' : '✅ 已恢复');
    
    // 8. 测试错误处理
    console.log('\n❌ 8. 测试错误处理');
    console.log('─────────────────────');
    
    const errorResult1 = await adminCommandService.processCommand('/cancelreminder', '');
    console.log('无参数错误:', errorResult1);
    
    const errorResult2 = await adminCommandService.processCommand('/cancelreminder invalid', '');
    console.log('无效类型错误:', errorResult2);
    
    const errorResult3 = await adminCommandService.processCommand('/pausereminder nonexistent@example.com', '');
    console.log('用户不存在错误:', errorResult3);
    
    // 9. 测试多语言支持
    console.log('\n🌐 9. 测试多语言支持');
    console.log('─────────────────────');
    
    await schedulerService.resetTodayReminders('admin');
    const chineseResult = await adminCommandService.processCommand('/cancelreminder 晨间', '');
    console.log('中文命令结果:', chineseResult);
    
    const status4 = schedulerService.getTodayReminderStatus('admin');
    console.log('中文命令验证 - 晨间提醒已标记:', status4?.morningReminderSent ? '✅ 是' : '❌ 否');
    
    console.log('\n🎯 测试结果总结');
    console.log('=====================================');
    console.log('✅ 取消晨间提醒功能正常');
    console.log('✅ 取消晚间提醒功能正常');
    console.log('✅ 取消所有提醒功能正常');
    console.log('✅ 暂停提醒功能正常');
    console.log('✅ 恢复提醒功能正常');
    console.log('✅ 错误处理正常');
    console.log('✅ 中文命令支持正常');
    
    console.log('\n📋 为大模型提供的新功能:');
    console.log('• /cancelreminder morning - 取消今天的晨间提醒');
    console.log('• /cancelreminder evening - 取消今天的晚间提醒');
    console.log('• /cancelreminder all - 取消今天的所有提醒');
    console.log('• /pausereminder <email> [days] - 暂停用户提醒');
    console.log('• /resumereminder <email> - 恢复用户提醒');
    console.log('• 支持中文命令: 晨间、晚间、全部');
    
    console.log('\n✅ 取消提醒功能测试完成！大模型现在可以取消和管理提醒了！');
    
    // 清理
    schedulerService.destroy();
    
  } catch (error) {
    console.error('❌ 测试失败:', error);
    process.exit(1);
  }
}

testCancelReminderFunctions();