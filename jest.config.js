/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js', 'json', 'node'],
  // GASの組み込みサービスをモック化するための設定
  globals: {
    GoogleAppsScript: {},
    SpreadsheetApp: {},
    PropertiesService: {},
    UrlFetchApp: {},
    ContentService: {},
    Utilities: {},
    // 必要に応じて他のGASサービスも追加
  },
  setupFilesAfterEnv: ['./jest.setup.js'],
};
