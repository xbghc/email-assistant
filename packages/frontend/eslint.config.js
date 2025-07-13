import js from '@eslint/js';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import vuePlugin from 'eslint-plugin-vue';
import vueParser from 'vue-eslint-parser';
import globals from 'globals';

export default [
  js.configs.recommended,
  
  // Vue 和 TypeScript 文件配置
  {
    files: ['src/**/*.{ts,vue}'],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        parser: tsParser,
        extraFileExtensions: ['.vue'],
        ecmaVersion: 'latest',
        sourceType: 'module',
        project: './tsconfig.json'
      },
      globals: {
        ...globals.browser,
        ...globals.es2022
      }
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      vue: vuePlugin
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      ...vuePlugin.configs.essential.rules,
      
      // 必要的覆盖
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      
      // Vue 语义规则
      'vue/multi-word-component-names': 'off', // 允许单词组件名
      
      'no-console': 'warn'
    }
  },
  
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'coverage/**'
    ]
  }
];