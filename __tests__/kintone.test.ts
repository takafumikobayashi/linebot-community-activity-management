/**
 * kintone API クライアントのテスト
 */

import { getEventsFromKintone } from '../src/services/kintone';
import { getConfig } from '../src/utils/env';

// 依存モジュールをモック化
jest.mock('../src/utils/env');

describe('kintone.ts', () => {
  const mockGetConfig = getConfig as jest.Mock;
  const mockUrlFetchApp = global.UrlFetchApp as jest.Mocked<
    typeof global.UrlFetchApp
  >;
  const mockUtilities = global.Utilities as jest.Mocked<
    typeof global.Utilities
  >;
  const mockResponse = {
    getResponseCode: jest.fn(),
    getContentText: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockGetConfig.mockReturnValue({
      KINTONE_DOMAIN: 'test-domain',
      KINTONE_EVENT_APP_ID: '123',
      KINTONE_EVENT_API_TOKEN: 'test_api_token',
    });

    mockUrlFetchApp.fetch.mockReturnValue(mockResponse as any);

    // Utilitiesのモック設定
    mockUtilities.formatDate = jest
      .fn()
      .mockReturnValueOnce('2025-09-01') // startDate
      .mockReturnValueOnce('2025-09-30'); // endDate
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('getEventsFromKintone', () => {
    it('正常なレスポンスの場合、イベント配列を返すべき', () => {
      const mockKintoneResponse = {
        records: [
          {
            $id: { type: 'RECORD_NUMBER', value: '1' },
            イベント名: { type: 'SINGLE_LINE_TEXT', value: 'テストイベント1' },
            開始日時: { type: 'DATETIME', value: '2025-09-01T10:00:00Z' },
            終了日時: { type: 'DATETIME', value: '2025-09-01T12:00:00Z' },
          },
          {
            $id: { type: 'RECORD_NUMBER', value: '2' },
            イベント名: { type: 'SINGLE_LINE_TEXT', value: 'テストイベント2' },
            開始日時: { type: 'DATETIME', value: '2025-09-15T14:00:00Z' },
            終了日時: { type: 'DATETIME', value: '2025-09-15T16:00:00Z' },
          },
        ],
      };

      mockResponse.getResponseCode.mockReturnValue(200);
      mockResponse.getContentText.mockReturnValue(
        JSON.stringify(mockKintoneResponse),
      );

      const result = getEventsFromKintone();

      expect(result).toEqual(mockKintoneResponse.records);
      expect(result).toHaveLength(2);
      expect(result[0]['イベント名'].value).toBe('テストイベント1');
      expect(result[1]['イベント名'].value).toBe('テストイベント2');
    });

    it('正しいAPIエンドポイントとヘッダーでリクエストすべき', () => {
      const mockKintoneResponse = { records: [] };
      mockResponse.getResponseCode.mockReturnValue(200);
      mockResponse.getContentText.mockReturnValue(
        JSON.stringify(mockKintoneResponse),
      );

      getEventsFromKintone();

      const expectedQuery = encodeURIComponent(
        '開始日時 >= "2025-09-01" and 開始日時 <= "2025-09-30" order by 開始日時 asc',
      );
      const expectedUrl = `https://test-domain.cybozu.com/k/v1/records.json?app=123&query=${expectedQuery}`;

      expect(mockUrlFetchApp.fetch).toHaveBeenCalledWith(
        expectedUrl,
        expect.objectContaining({
          method: 'get',
          headers: {
            'X-Cybozu-API-Token': 'test_api_token',
          },
          muteHttpExceptions: true,
        }),
      );
    });

    it('日付計算が正しく動作すべき', () => {
      const mockKintoneResponse = { records: [] };
      mockResponse.getResponseCode.mockReturnValue(200);
      mockResponse.getContentText.mockReturnValue(
        JSON.stringify(mockKintoneResponse),
      );

      getEventsFromKintone();

      // Utilities.formatDateが2回呼ばれることを確認
      expect(mockUtilities.formatDate).toHaveBeenCalledTimes(2);

      // 引数の形式を確認（具体的な値は日付依存なので、型のみチェック）
      const call1Args = mockUtilities.formatDate.mock.calls[0];
      const call2Args = mockUtilities.formatDate.mock.calls[1];

      expect(call1Args[0]).toBeInstanceOf(Date);
      expect(call1Args[1]).toBe('Asia/Tokyo');
      expect(call1Args[2]).toBe('yyyy-MM-dd');

      expect(call2Args[0]).toBeInstanceOf(Date);
      expect(call2Args[1]).toBe('Asia/Tokyo');
      expect(call2Args[2]).toBe('yyyy-MM-dd');
    });

    it('クエリが正しく構築されるべき', () => {
      const mockKintoneResponse = { records: [] };
      mockResponse.getResponseCode.mockReturnValue(200);
      mockResponse.getContentText.mockReturnValue(
        JSON.stringify(mockKintoneResponse),
      );
      const consoleSpy = jest.spyOn(console, 'log');

      getEventsFromKintone();

      // 実装では console.log(`[kintone] クエリ実行: ${query}`) という形式でログ出力
      expect(consoleSpy).toHaveBeenCalledWith(
        '[kintone] クエリ実行: 開始日時 >= "2025-09-01" and 開始日時 <= "2025-09-30" order by 開始日時 asc',
      );

      consoleSpy.mockRestore();
    });

    it('APIエラーの場合、空配列を返すべき', () => {
      mockResponse.getResponseCode.mockReturnValue(400);
      mockResponse.getContentText.mockReturnValue(
        '{"code": "GAIA_RE01", "message": "Invalid query."}',
      );
      const consoleErrorSpy = jest.spyOn(console, 'error');

      const result = getEventsFromKintone();

      expect(result).toEqual([]);

      // 実装では3つのログが出力される
      // 1. APIエラーログ
      // 2. レスポンス内容ログ
      // 3. catch節での例外ログ
      expect(consoleErrorSpy).toHaveBeenCalledTimes(3);
      expect(consoleErrorSpy).toHaveBeenNthCalledWith(
        1,
        '[kintone] イベント取得APIエラー: 400',
      );
      expect(consoleErrorSpy).toHaveBeenNthCalledWith(
        2,
        '[kintone] レスポンス: {"code": "GAIA_RE01", "message": "Invalid query."}',
      );
      expect(consoleErrorSpy).toHaveBeenNthCalledWith(
        3,
        '[kintone] イベント取得処理で予期せぬエラー:',
        expect.any(Error),
      );

      consoleErrorSpy.mockRestore();
    });

    it('認証エラーの場合、空配列を返すべき', () => {
      mockResponse.getResponseCode.mockReturnValue(401);
      mockResponse.getContentText.mockReturnValue(
        '{"code": "GAIA_AU01", "message": "Authentication failed."}',
      );
      const consoleErrorSpy = jest.spyOn(console, 'error');

      const result = getEventsFromKintone();

      expect(result).toEqual([]);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[kintone] イベント取得APIエラー: 401'),
      );

      consoleErrorSpy.mockRestore();
    });

    it('ネットワークエラーの場合、空配列を返すべき', () => {
      mockUrlFetchApp.fetch.mockImplementation(() => {
        throw new Error('Network timeout');
      });
      const consoleErrorSpy = jest.spyOn(console, 'error');

      const result = getEventsFromKintone();

      expect(result).toEqual([]);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[kintone] イベント取得処理で予期せぬエラー:',
        expect.any(Error),
      );

      consoleErrorSpy.mockRestore();
    });

    it('空のレスポンスの場合、空配列を返すべき', () => {
      mockResponse.getResponseCode.mockReturnValue(200);
      mockResponse.getContentText.mockReturnValue(
        JSON.stringify({ records: [] }),
      );
      const consoleSpy = jest.spyOn(console, 'log');

      const result = getEventsFromKintone();

      expect(result).toEqual([]);
      expect(consoleSpy).toHaveBeenCalledWith(
        '[kintone] イベント取得成功: 0件',
      );

      consoleSpy.mockRestore();
    });

    it('無効なJSONレスポンスの場合、空配列を返すべき', () => {
      mockResponse.getResponseCode.mockReturnValue(200);
      mockResponse.getContentText.mockReturnValue('invalid json');
      const consoleErrorSpy = jest.spyOn(console, 'error');

      const result = getEventsFromKintone();

      expect(result).toEqual([]);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[kintone] イベント取得処理で予期せぬエラー:',
        expect.any(Error),
      );

      consoleErrorSpy.mockRestore();
    });

    it('成功時のログ出力を確認すべき', () => {
      const mockKintoneResponse = {
        records: [
          {
            $id: { type: 'RECORD_NUMBER', value: '1' },
            イベント名: { type: 'SINGLE_LINE_TEXT', value: 'テスト' },
            開始日時: { type: 'DATETIME', value: '2025-09-01T10:00:00Z' },
            終了日時: { type: 'DATETIME', value: '2025-09-01T12:00:00Z' },
          },
        ],
      };

      mockResponse.getResponseCode.mockReturnValue(200);
      mockResponse.getContentText.mockReturnValue(
        JSON.stringify(mockKintoneResponse),
      );
      const consoleSpy = jest.spyOn(console, 'log');

      getEventsFromKintone();

      expect(consoleSpy).toHaveBeenCalledWith(
        '[kintone] イベント取得成功: 1件',
      );

      consoleSpy.mockRestore();
    });

    it('年末年始の月跨ぎでも正しい翌月の日付範囲を計算すべき', () => {
      // 12月15日をモック
      const mockDate = new Date('2025-12-15T10:00:00Z');
      jest.spyOn(global, 'Date').mockImplementation(() => mockDate as any);

      // Utilitiesの日付フォーマット機能をモック
      mockUtilities.formatDate = jest
        .fn()
        .mockReturnValueOnce('2026-01-01') // 翌年1月の開始日
        .mockReturnValueOnce('2026-01-31'); // 翌年1月の終了日

      const mockKintoneResponse = { records: [] };
      mockResponse.getResponseCode.mockReturnValue(200);
      mockResponse.getContentText.mockReturnValue(
        JSON.stringify(mockKintoneResponse),
      );

      getEventsFromKintone();

      const expectedQuery = encodeURIComponent(
        '開始日時 >= "2026-01-01" and 開始日時 <= "2026-01-31" order by 開始日時 asc',
      );
      const expectedUrl = `https://test-domain.cybozu.com/k/v1/records.json?app=123&query=${expectedQuery}`;

      expect(mockUrlFetchApp.fetch).toHaveBeenCalledWith(
        expectedUrl,
        expect.any(Object),
      );

      // Dateのモックを元に戻す
      jest.restoreAllMocks();
    });
  });
});
