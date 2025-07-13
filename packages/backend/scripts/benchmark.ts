#!/usr/bin/env tsx

/**
 * 性能基准测试脚本
 * 
 * 使用方法：
 * npx tsx scripts/benchmark.ts
 * 
 * 示例：
 * npx tsx scripts/benchmark.ts --save --report
 */

import path from 'path';
import fs from 'fs';
import { pathToFileURL } from 'url';

// 基准测试结果接口
interface BenchmarkResult {
  name: string;
  iterations: number;
  averageTime: number;
  minTime: number;
  maxTime: number;
  memoryUsed: number;
}

interface BenchmarkSuite {
  results: BenchmarkResult[];
  totalDuration: number;
  startTime: Date;
  endTime: Date;
}

// 动态导入编译后的服务
async function runBenchmarks(): Promise<void> {
  try {
    console.log('🚀 启动性能基准测试...\n');

    // Compatible way to get the backend directory using process.cwd()
    const backendRoot = path.resolve(process.cwd(), 'packages/backend');
    const distPath = path.join(backendRoot, 'dist');
    
    if (!fs.existsSync(distPath)) {
      console.error('❌ 项目尚未构建，请先运行: pnpm build');
      console.error(`🔍 检查路径: ${distPath}`);
      process.exit(1);
    }
    
    // 动态导入基准测试服务
    // 构建服务的绝对路径，并转换为 import() 可靠��别的 URL 格式
    const benchmarkServicePath = path.join(distPath, 'services/system/benchmarkService.js');
    const { default: BenchmarkService } = await import(pathToFileURL(benchmarkServicePath).href);
    const benchmarkService = new BenchmarkService();
    
    console.log('📊 运行基准测试套件...\n');
    
    // 运行基准测试
    const suite: BenchmarkSuite = await benchmarkService.runBenchmarkSuite();

    
    // 显示结果
    console.log('\n📈 基准测试结果:');
    console.log('================');
    
    suite.results.forEach((result: BenchmarkResult) => {
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
      const report: string = benchmarkService.generateReport(suite);
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
    
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('❌ 基准测试失败:', message);
    console.error('\n🔍 故障排除:');
    console.error('1. 确保项目已构建: pnpm build');
    console.error('2. 确保依赖已安装: pnpm install');
    console.error('3. 检查Node.js版本 >= 18.0.0');
    process.exit(1);
  }
}

// 主函数
async function main(): Promise<void> {
  console.log('📋 Email Assistant 性能基准测试');
  console.log('================================');
  console.log(`Node.js 版本: ${process.version}`);
  console.log(`平台: ${process.platform}`);
  console.log(`架构: ${process.arch}`);
  console.log(`内存: ${Math.round(process.memoryUsage().rss / 1024 / 1024)}MB\n`);
  
  await runBenchmarks();
}

// 处理未捕获的异常
process.on('unhandledRejection', (reason: unknown, _promise: Promise<unknown>) => {
  console.error('❌ 未处理的Promise拒绝:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error: Error) => {
  console.error('❌ 未捕获的异常:', error);
  process.exit(1);
});

// 运行主函数
main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error('❌ 运行基准测试脚本失败:', message);
  process.exit(1);
});
