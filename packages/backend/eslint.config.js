import js from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import globals from 'globals';

export default [
  js.configs.recommended,
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        project: './tsconfig.json',
      },
      globals: {
        ...globals.node,
        NodeJS: 'readonly', // TypeScript namespace，不在globals.node中
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      // 只保留必要的覆盖
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }], // 添加忽略下划线参数
      'no-undef': 'off', // TypeScript handles this
    },
  },
  {
    files: ['**/*.js', '**/*.mjs', 'scripts/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.node,
      },
    },
    rules: {
      'no-console': 'off',
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['**/*.test.ts', '**/*.spec.ts'],
    languageOptions: {
      globals: {
        ...globals.jest,
      },
    },
  },
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'logs/**',
      'data/**',
      'coverage/**',
      'src/public/**',
      '*.config.js',
      'test-*.js',
      'debug-*.js',
      'final-*.js',
    ],
  },
];