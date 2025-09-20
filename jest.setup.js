// GASの組み込みサービスをモック化
// これにより、ローカル環境でGASの関数を呼び出すコードをテストできるようになる

global.SpreadsheetApp = {
  openById: jest.fn(() => ({
    getSheetByName: jest.fn(() => ({
      getDataRange: jest.fn(() => ({
        getValues: jest.fn(),
      })),
      getRange: jest.fn(() => ({
        setValue: jest.fn(),
      })),
      appendRow: jest.fn(),
    })),
  })),
  flush: jest.fn(), // flushもモックに追加
};

global.PropertiesService = {
  getScriptProperties: jest.fn(() => ({
    getProperty: jest.fn((key) => {
      // テスト用の環境変数をここで定義
      switch (key) {
        case 'CHANNEL_ACCESS_TOKEN':
          return 'test_channel_access_token';
        case 'OPENAI_API_KEY':
          return 'test_openai_api_key';
        case 'SPREADSHEET_ID':
          return 'test_spreadsheet_id';
        case 'STAFF_USER_ID':
          return 'test_staff_user_id';
        default:
          return null;
      }
    }),
  })),
};

global.UrlFetchApp = {
  fetch: jest.fn(() => ({
    getResponseCode: jest.fn(() => 200),
    getContentText: jest.fn(() =>
      JSON.stringify({
        data: [{ embedding: Array(1536).fill(0.1) }],
        choices: [{ message: { content: 'Test GPT response' } }],
      }),
    ),
  })),
};

global.ContentService = {
  createTextOutput: jest.fn(() => ({
    setMimeType: jest.fn().mockReturnThis(),
    setEncoding: jest.fn().mockReturnThis(), // setEncodingもモックに追加
  })),
  MimeType: {
    JSON: 'application/json',
  },
};

global.Utilities = {
  sleep: jest.fn(),
};

// console.logをjest.fnでモック化して、テスト中にログ出力をキャプチャできるようにする
// ただし、これはテストの実行環境に依存するため、必要に応じて調整
global.console = {
  ...console,
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
};

// Logger.logもモック化
global.Logger = {
  log: jest.fn(),
};
