// @ts-check
import js from '@eslint/js';
import tsEslint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import globals from 'globals';

/**
 * Flat-config ESLint setup for the EDSim React frontend.
 *
 * Tightened beyond defaults: unused vars and explicit `any` are errors so the
 * parser stays type-safe end to end.
 */
export default [
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'coverage/**',
      'playwright-report/**',
      'test-results/**',
      'maps/**'
    ]
  },
  js.configs.recommended,
  {
    // Node CLI scripts (not part of the React app build). The
    // generate-assets script runs half in Node and half in a
    // Playwright browser context via page.evaluate, so we whitelist
    // both sets of globals.
    files: ['scripts/**/*.{js,mjs,cjs}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.browser
      }
    }
  },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        ecmaFeatures: { jsx: true }
      },
      globals: {
        ...globals.browser,
        React: 'readonly',
        process: 'readonly'
      }
    },
    plugins: {
      '@typescript-eslint': tsEslint,
      react: reactPlugin,
      'react-hooks': reactHooksPlugin
    },
    settings: {
      react: { version: 'detect' }
    },
    rules: {
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      'react/jsx-uses-react': 'off',
      'react/react-in-jsx-scope': 'off',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn'
    }
  }
];