// @ts-check
import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import playwright from 'eslint-plugin-playwright';
import tseslint from 'typescript-eslint';

/** Playwright rules that also matter outside spec files (Page Objects, fixtures, support code). */
const playwrightSupportRules = {
  'playwright/missing-playwright-await': 'error',
  'playwright/no-wait-for-timeout': 'error',
  'playwright/no-wait-for-selector': 'error',
  'playwright/no-networkidle': 'error',
  'playwright/no-force-option': 'error',
  'playwright/no-element-handle': 'error',
  'playwright/no-eval': 'error',
  'playwright/no-page-pause': 'error',
};

export default defineConfig(
  globalIgnores([
    'node_modules/',
    'playwright-report/',
    'test-results/',
    'blob-report/',
    'playwright/.cache/',
    'reports/',
    'release-evidence/',
  ]),

  {
    name: 'project/typescript',
    files: ['**/*.ts', '**/*.mts'],
    extends: [js.configs.recommended, tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Async correctness (floating/misused promises and await-thenable come from recommendedTypeChecked).
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/return-await': ['error', 'in-try-catch'],
      '@typescript-eslint/no-unnecessary-type-assertion': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },

  {
    name: 'project/playwright-support',
    files: ['pages/**/*.ts', 'fixtures/**/*.ts', 'support/**/*.ts'],
    plugins: { playwright },
    rules: playwrightSupportRules,
  },

  {
    name: 'project/playwright-tests',
    files: ['tests/**/*.ts'],
    extends: [playwright.configs['flat/recommended']],
    rules: {
      ...playwrightSupportRules,
      // Committed focused/skipped tests would silently shrink CI coverage.
      'playwright/no-focused-test': 'error',
      'playwright/no-skipped-test': 'error',
      'playwright/no-commented-out-tests': 'error',
      'playwright/prefer-web-first-assertions': 'error',
      'playwright/no-useless-await': 'error',
      'playwright/no-useless-not': 'error',
      'playwright/prefer-to-have-count': 'error',
      'playwright/valid-title': 'error',
    },
  },
);
