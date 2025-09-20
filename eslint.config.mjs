import globals from 'globals';
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettierConfig from 'eslint-config-prettier';
import prettierPlugin from 'eslint-plugin-prettier';

export default [
  // グローバルな無視設定
  { ignores: ['dist/'] },

  // ESLintの推奨設定
  js.configs.recommended,

  // TypeScript-ESLintの推奨設定
  ...tseslint.configs.recommended,

  // すべてのファイルに適用するカスタム設定
  {
    plugins: {
      prettier: prettierPlugin,
    },
    rules: {
      'prettier/prettier': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
    },
    languageOptions: {
      globals: {
        ...globals.node, // Node.jsのグローバル変数を有効化
        ...globals.es2021, // ES2021のグローバル変数を有効化
        GoogleAppsScript: 'readonly', // GASのグローバルオブジェクト
      },
    },
  },

  // テストファイル用の設定上書き
  {
    files: ['__tests__/**/*.ts', 'jest.setup.js'],
    languageOptions: {
      globals: {
        ...globals.jest,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
    },
  },

  // Prettierとの競合ルールを無効化（必ず最後に配置）
  prettierConfig,
];
