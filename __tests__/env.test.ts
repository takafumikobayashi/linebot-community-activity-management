/**
 * 環境変数・設定管理のテスト
 */

import { getConfig, validateConfig } from '../src/utils/env';

describe('env.ts', () => {
  const mockPropertiesService = global.PropertiesService as jest.Mocked<
    typeof global.PropertiesService
  >;
  const mockProperties = {
    getProperty: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockPropertiesService.getScriptProperties.mockReturnValue(
      mockProperties as any,
    );
  });

  describe('getConfig', () => {
    it('すべての必須設定が揃っている場合、設定オブジェクトを返すべき', () => {
      mockProperties.getProperty.mockImplementation((key: string) => {
        const mockValues: { [key: string]: string } = {
          CHANNEL_ACCESS_TOKEN: 'test_channel_token',
          OPENAI_API_KEY: 'test_openai_key',
          SPREADSHEET_ID: 'test_spreadsheet_id',
          STAFF_USER_ID: 'U123456,U789012',
          SIMILARITY_THRESHOLD: '0.8',
        };
        return mockValues[key] || null;
      });

      const config = getConfig();

      expect(config).toEqual({
        CHANNEL_ACCESS_TOKEN: 'test_channel_token',
        OPENAI_API_KEY: 'test_openai_key',
        SPREADSHEET_ID: 'test_spreadsheet_id',
        STAFF_USER_ID: 'U123456,U789012',
        SIMILARITY_THRESHOLD: 0.8,
      });
    });

    it('SIMILARITY_THRESHOLDのデフォルト値が適用されるべき', () => {
      mockProperties.getProperty.mockImplementation((key: string) => {
        const mockValues: { [key: string]: string } = {
          CHANNEL_ACCESS_TOKEN: 'test_channel_token',
          OPENAI_API_KEY: 'test_openai_key',
          SPREADSHEET_ID: 'test_spreadsheet_id',
          STAFF_USER_ID: 'U123456',
          // SIMILARITY_THRESHOLD を設定しない
        };
        return mockValues[key] || null;
      });

      const config = getConfig();

      expect(config.SIMILARITY_THRESHOLD).toBe(0.75); // デフォルト値
    });

    it('CHANNEL_ACCESS_TOKENが未設定の場合、エラーをスローすべき', () => {
      mockProperties.getProperty.mockImplementation((key: string) => {
        if (key === 'CHANNEL_ACCESS_TOKEN') return null;
        return 'test_value';
      });

      expect(() => getConfig()).toThrow(
        'LINE Channel Access Tokenが設定されていません',
      );
    });

    it('OPENAI_API_KEYが未設定の場合、エラーをスローすべき', () => {
      mockProperties.getProperty.mockImplementation((key: string) => {
        if (key === 'OPENAI_API_KEY') return null;
        return 'test_value';
      });

      expect(() => getConfig()).toThrow('OpenAI API Keyが設定されていません');
    });

    it('SPREADSHEET_IDが未設定の場合、エラーをスローすべき', () => {
      mockProperties.getProperty.mockImplementation((key: string) => {
        if (key === 'SPREADSHEET_ID') return null;
        return 'test_value';
      });

      expect(() => getConfig()).toThrow('Spreadsheet IDが設定されていません');
    });

    it('STAFF_USER_IDが未設定の場合、エラーをスローすべき', () => {
      mockProperties.getProperty.mockImplementation((key: string) => {
        if (key === 'STAFF_USER_ID') return null;
        return 'test_value';
      });

      expect(() => getConfig()).toThrow(
        'LINE通知先 USERIDが設定されていません',
      );
    });

    it('SIMILARITY_THRESHOLDが不正な値の場合、エラーをスローすべき', () => {
      mockProperties.getProperty.mockImplementation((key: string) => {
        const mockValues: { [key: string]: string } = {
          CHANNEL_ACCESS_TOKEN: 'test_token',
          OPENAI_API_KEY: 'test_key',
          SPREADSHEET_ID: 'test_id',
          STAFF_USER_ID: 'U123456',
          SIMILARITY_THRESHOLD: 'invalid_number', // 不正な値
        };
        return mockValues[key] || null;
      });

      expect(() => getConfig()).toThrow(
        '類似度閾値は0〜1の数値である必要があります',
      );
    });

    it('SIMILARITY_THRESHOLDが範囲外の場合、エラーをスローすべき', () => {
      mockProperties.getProperty.mockImplementation((key: string) => {
        const mockValues: { [key: string]: string } = {
          CHANNEL_ACCESS_TOKEN: 'test_token',
          OPENAI_API_KEY: 'test_key',
          SPREADSHEET_ID: 'test_id',
          STAFF_USER_ID: 'U123456',
          SIMILARITY_THRESHOLD: '1.5', // 範囲外（0-1を超える）
        };
        return mockValues[key] || null;
      });

      expect(() => getConfig()).toThrow(
        '類似度閾値は0〜1の数値である必要があります',
      );
    });

    it('SIMILARITY_THRESHOLDが負の値の場合、エラーをスローすべき', () => {
      mockProperties.getProperty.mockImplementation((key: string) => {
        const mockValues: { [key: string]: string } = {
          CHANNEL_ACCESS_TOKEN: 'test_token',
          OPENAI_API_KEY: 'test_key',
          SPREADSHEET_ID: 'test_id',
          STAFF_USER_ID: 'U123456',
          SIMILARITY_THRESHOLD: '-0.1', // 負の値
        };
        return mockValues[key] || null;
      });

      expect(() => getConfig()).toThrow(
        '類似度閾値は0〜1の数値である必要があります',
      );
    });

    it('境界値（0, 1）が正常に処理されるべき', () => {
      // 閾値 = 0 の場合
      mockProperties.getProperty.mockImplementation((key: string) => {
        const mockValues: { [key: string]: string } = {
          CHANNEL_ACCESS_TOKEN: 'test_token',
          OPENAI_API_KEY: 'test_key',
          SPREADSHEET_ID: 'test_id',
          STAFF_USER_ID: 'U123456',
          SIMILARITY_THRESHOLD: '0',
        };
        return mockValues[key] || null;
      });

      expect(() => getConfig()).not.toThrow();
      expect(getConfig().SIMILARITY_THRESHOLD).toBe(0);

      // 閾値 = 1 の場合
      mockProperties.getProperty.mockImplementation((key: string) => {
        const mockValues: { [key: string]: string } = {
          CHANNEL_ACCESS_TOKEN: 'test_token',
          OPENAI_API_KEY: 'test_key',
          SPREADSHEET_ID: 'test_id',
          STAFF_USER_ID: 'U123456',
          SIMILARITY_THRESHOLD: '1',
        };
        return mockValues[key] || null;
      });

      expect(() => getConfig()).not.toThrow();
      expect(getConfig().SIMILARITY_THRESHOLD).toBe(1);
    });
  });

  describe('validateConfig', () => {
    it('設定が有効な場合、trueを返すべき', () => {
      mockProperties.getProperty.mockImplementation((key: string) => {
        const mockValues: { [key: string]: string } = {
          CHANNEL_ACCESS_TOKEN: 'test_token',
          OPENAI_API_KEY: 'test_key',
          SPREADSHEET_ID: 'test_id',
          STAFF_USER_ID: 'U123456',
          SIMILARITY_THRESHOLD: '0.75',
        };
        return mockValues[key] || null;
      });

      const consoleSpy = jest.spyOn(console, 'log');

      const result = validateConfig();

      expect(result).toBe(true);
      expect(consoleSpy).toHaveBeenCalledWith('[Config] 設定検証成功');
      expect(consoleSpy).toHaveBeenCalledWith(
        '[Config] SIMILARITY_THRESHOLD: 0.75',
      );

      consoleSpy.mockRestore();
    });

    it('設定に問題がある場合、falseを返すべき', () => {
      mockProperties.getProperty.mockImplementation((key: string) => {
        if (key === 'CHANNEL_ACCESS_TOKEN') return null; // 必須設定が不足
        return 'test_value';
      });

      const consoleErrorSpy = jest.spyOn(console, 'error');

      const result = validateConfig();

      expect(result).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[Config] 設定検証失敗:',
        expect.any(Error),
      );

      consoleErrorSpy.mockRestore();
    });

    it('予期しないエラーが発生した場合、falseを返すべき', () => {
      mockPropertiesService.getScriptProperties.mockImplementation(() => {
        throw new Error('PropertiesService error');
      });

      const consoleErrorSpy = jest.spyOn(console, 'error');

      const result = validateConfig();

      expect(result).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[Config] 設定検証失敗:',
        expect.any(Error),
      );

      consoleErrorSpy.mockRestore();
    });
  });
});
