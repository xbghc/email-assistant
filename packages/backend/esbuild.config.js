import esbuild from 'esbuild';
import { readFileSync } from 'fs';

// 从package.json读取依赖项
const packageJson = JSON.parse(readFileSync('./package.json', 'utf8'));
const dependencies = Object.keys(packageJson.dependencies || {});

// 判断是否为生产构建
const isProduction = process.env.NODE_ENV === 'production';

await esbuild.build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  outfile: 'dist/index.js',
  platform: 'node',
  target: 'esnext',
  format: 'esm',
  external: dependencies, // 自动外部化所有依赖项
  sourcemap: !isProduction,
  minify: isProduction
});

console.log(`Build completed successfully! ${isProduction ? '(Production)' : '(Development)'}`);