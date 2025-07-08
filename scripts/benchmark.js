#!/usr/bin/env node

/**
 * 性能基准测试脚本
 * 
 * 使用方法：
 * node scripts/benchmark.js
 * 
 * 示例：
 * node scripts/benchmark.js --save --report
 */

/* eslint-env node */

const path = require('path');

// 动态导入编译后的服务
async function runBenchmarks() {
  try {
    console.log('🚀 启动性能基准测试...\n');
    
    // 检查是否已构建
    const distPath = path.join(process.cwd(), 'dist');
    const fs = require('fs');
    
    if (!fs.existsSync(distPath)) {
      console.error('❌ 项目尚未构建，请先运行: npm run build');
      process.exit(1);
    }
    
    // 动态导入基准测试服务
    const BenchmarkService = require('../dist/services/benchmarkService.js').default;
    const benchmarkService = new BenchmarkService();
    
    console.log('📊 运行基准测试套件...\n');
    
    // 运行基准测试
    const suite = await benchmarkService.runBenchmarkSuite();
    
    // 显示结果
    console.log('\n📈 基准测试结果:');
    console.log('================');
    
    suite.results.forEach(result => {
      console.log(`\n🔧 ${result.name}:`);
      console.log(`   迭代次数: ${result.iterations}`);
      console.log(`   平均时间: ${result.averageTime.toFixed(2)}ms`);
      console.log(`   最短时间: ${result.minTime.toFixed(2)}ms`);
      console.log(`   最长时间: ${result.maxTime.toFixed(2)}ms`);
      console.log(`   内存使用: ${(result.memoryUsed / 1024 / 1024).toFixed(2)}MB`);
      console.log(`   吞吐量: ${(1000 / result.averageTime).toFixed(2)} ops/sec`);
    });
    
    // 生成报告
    if (process.argv.includes('--report')) {
      console.log('\n📄 生成基准测试报告...');
      const report = benchmarkService.generateReport(suite);
      console.log('\n' + report);
    }
    
    // 保存结果
    if (process.argv.includes('--save')) {
      console.log('\n💾 保存基准测试结果...');
      await benchmarkService.saveBenchmarkResults(suite);
      console.log('✅ 结果已保存到 benchmarks/ 目录');
    }
    
    // 总结
    const totalDuration = suite.totalDuration;
    const avgPerformance = suite.results.reduce((sum, r) => sum + r.averageTime, 0) / suite.results.length;
    
    console.log('\n📊 测试总结:');
    console.log('============');
    console.log(`总测试时间: ${totalDuration}ms`);
    console.log(`平均执行时间: ${avgPerformance.toFixed(2)}ms`);
    console.log(`测试项目数: ${suite.results.length}`);
    console.log(`开始时间: ${suite.startTime.toLocaleString()}`);
    console.log(`结束时间: ${suite.endTime.toLocaleString()}`);
    
    // 性能评级
    let grade = 'A+';
    if (avgPerformance > 100) grade = 'A';
    if (avgPerformance > 200) grade = 'B';
    if (avgPerformance > 500) grade = 'C';
    if (avgPerformance > 1000) grade = 'D';
    
    console.log(`\n🏆 性能评级: ${grade}`);
    
    if (grade === 'A+' || grade === 'A') {
      console.log('🎉 性能优秀！系统运行流畅');
    } else if (grade === 'B') {
      console.log('⚠️  性能良好，但有优化空间');
    } else {
      console.log('🚨 性能需要优化，建议检查系统配置');
    }
    
  } catch (error) {
    console.error('❌ 基准测试失败:', error.message);
    console.error('\n🔍 故障排除:');
    console.error('1. 确保项目已构建: npm run build');
    console.error('2. 确保依赖已安装: npm install');
    console.error('3. 检查Node.js版本 >= 18.0.0');
    process.exit(1);
  }
}

// 主函数
async function main() {
  console.log('📋 Email Assistant 性能基准测试');
  console.log('================================');
  console.log(`Node.js 版本: ${process.version}`);
  console.log(`平台: ${process.platform}`);
  console.log(`架构: ${process.arch}`);
  console.log(`内存: ${Math.round(process.memoryUsage().rss / 1024 / 1024)}MB\n`);
  
  await runBenchmarks();
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

// 运行主函数
main().catch(console.error);