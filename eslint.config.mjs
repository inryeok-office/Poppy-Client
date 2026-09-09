import queryPlugin from '@tanstack/eslint-plugin-query';
import { defineConfig, globalIgnores } from 'eslint/config';
import prettier from 'eslint-config-prettier';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  ...queryPlugin.configs['flat/recommended'],

  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      'no-console': ['error', { allow: ['warn', 'error'] }],
    },
  },

  // 포맷 관련 규칙을 끈다. 포맷은 Prettier가 담당한다. 반드시 마지막에 온다.
  prettier,

  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'coverage/**',
    'next-env.d.ts',
    // MSW가 생성하는 서비스 워커 스크립트 (vendored)
    'public/mockServiceWorker.js',
  ]),
]);

export default eslintConfig;
