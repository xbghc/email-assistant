import js from '@eslint/js';
import globals from 'globals';

export default [
  js.configs.recommended,
  
  // 根目录配置文件
  {
    files: ['*.js', '*.mjs', '*.config.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.es2022
      }
    },
    rules: {
      'prefer-const': 'error',
      'no-console': 'off'
    }
  },
  
  {
    ignores: [
      'packages/**', // 各包有自己的配置
      '**/dist/**',
      '**/node_modules/**',
      '**/.env*',
      '**/coverage/**'
    ]
  }
];