import {
  getFaqData,
  writeLog,
  saveEmbedding,
  getFaqsWithoutEmbedding,
  getAllUserIds,
  saveNewUser,
  getEventsForMonth,
  getEventsForDate,
  recordRSVPInEvent,
  getRecentConversationForUser,
  appendParticipation,
  getUpcomingEvents,
} from '../src/services/sheet';
import { getConfig } from '../src/utils/env';

// getConfigをモック化
jest.mock('../src/utils/env', () => ({
  getConfig: jest.fn(),
}));

describe('sheet.ts', () => {
  // Jestのモック関数としてSpreadsheetAppとPropertiesServiceをキャスト
  const mockSpreadsheetApp = global.SpreadsheetApp as jest.Mocked<
    typeof global.SpreadsheetApp
  >;

  const mockConsole = global.console as jest.Mocked<typeof global.console>;

  // モックオブジェクトの定義
  let mockSheet: any;
  let mockSpreadsheet: any;
  // (unused)
  let mockLockService: any;

  beforeEach(() => {
    // 各テストの前にモックをリセット
    jest.clearAllMocks();
    mockConsole.warn.mockClear(); // warnのモックもクリア

    // getConfigがテスト用の値を返すようにモック
    (getConfig as jest.Mock).mockReturnValue({
      SPREADSHEET_ID: 'test_spreadsheet_id',
      CHANNEL_ACCESS_TOKEN: 'test_channel_access_token',
      OPENAI_API_KEY: 'test_openai_api_key',
      SIMILARITY_THRESHOLD: 0.75,
      STAFF_USER_ID: 'test_staff_user_id',
    });

    // SpreadsheetAppのモック設定
    mockSheet = {
      getDataRange: jest.fn().mockReturnThis(),
      getValues: jest.fn(),
      getRange: jest.fn().mockReturnThis(),
      setValue: jest.fn(),
      appendRow: jest.fn(),
      getLastColumn: jest.fn().mockReturnValue(6),
      getLastRow: jest.fn().mockReturnValue(3),
      flush: jest.fn(),
    };
    mockSpreadsheet = {
      getSheetByName: jest.fn().mockReturnValue(mockSheet),
    };
    mockSpreadsheetApp.openById.mockReturnValue(mockSpreadsheet);
    mockSpreadsheetApp.flush = jest.fn();

    // LockServiceのモック設定
    mockLockService = {
      waitLock: jest.fn(),
      releaseLock: jest.fn(),
    };
    global.LockService = {
      getScriptLock: jest.fn().mockReturnValue(mockLockService),
    } as any;
  });

  describe('getFaqData', () => {
    it('FAQシートからデータを正しく取得できるべき', () => {
      // モックデータの準備
      const mockSheetData = [
        ['Question', 'Answer', 'Embedding'], // ヘッダー
        ['質問1', '回答1', JSON.stringify([0.1, 0.2])],
        ['質問2', '回答2', JSON.stringify([0.3, 0.4])],
        ['', '', ''], // 空行
        ['質問3', '回答3', ''], // Embeddingなし
      ];

      // モックの挙動を設定
      mockSheet.getValues.mockReturnValue(mockSheetData);

      const faqs = getFaqData();

      // 期待される結果の検証
      expect(mockSpreadsheetApp.openById).toHaveBeenCalledWith(
        'test_spreadsheet_id',
      );
      expect(mockSpreadsheet.getSheetByName).toHaveBeenCalledWith('FAQ');

      expect(faqs).toHaveLength(3); // 空行は除外される
      expect(faqs[0]).toEqual({
        question: '質問1',
        answer: '回答1',
        embedding: [0.1, 0.2],
      });
      expect(faqs[2]).toEqual({
        question: '質問3',
        answer: '回答3',
        embedding: undefined, // Embeddingがない場合はundefined
      });
      expect(mockConsole.log).toHaveBeenCalledWith('[Sheet] FAQ取得成功: 3件');
    });

    it('FAQシートが見つからない場合にエラーをスローすべき', () => {
      mockSpreadsheet.getSheetByName.mockReturnValue(null); // シートが見つからない

      expect(() => getFaqData()).toThrow('FAQシートが見つかりません');
      expect(mockConsole.error).toHaveBeenCalledWith(
        '[Sheet] FAQ取得エラー:',
        expect.any(Error),
      );
    });

    it('Embeddingのパースに失敗しても処理を継続すべき', () => {
      const mockSheetData = [
        ['Question', 'Answer', 'Embedding'], // ヘッダー
        ['質問1', '回答1', '不正なJSON'], // 不正なEmbedding
      ];
      mockSheet.getValues.mockReturnValue(mockSheetData);

      const faqs = getFaqData();

      expect(faqs).toHaveLength(1);
      expect(faqs[0].embedding).toBeUndefined();
      expect(mockConsole.warn).toHaveBeenCalledWith(
        expect.stringContaining('Embedding解析失敗'),
      );
    });
  });

  describe('writeLog', () => {
    it('ログデータを正しくスプレッドシートに記録できるべき', () => {
      const mockLogData = {
        timestamp: '2025-07-27T12:00:00Z',
        userId: 'user123',
        message: 'テストメッセージ',
        response: 'テスト応答',
        similarity: 0.9,
      };

      // writeLogはgetSheetByName("Log")を呼ぶので、そのモックを設定
      const mockLogSheet = {
        appendRow: jest.fn(),
      };
      mockSpreadsheet.getSheetByName.mockReturnValueOnce(mockLogSheet); // FAQシートとは別のモック

      writeLog(mockLogData);

      expect(mockSpreadsheetApp.openById).toHaveBeenCalledWith(
        'test_spreadsheet_id',
      );
      expect(mockSpreadsheet.getSheetByName).toHaveBeenCalledWith('Log');
      expect(mockLogSheet.appendRow).toHaveBeenCalledWith([
        mockLogData.timestamp,
        mockLogData.userId,
        mockLogData.message,
        mockLogData.response,
        mockLogData.similarity,
      ]);
      expect(mockConsole.log).toHaveBeenCalledWith(
        expect.stringContaining('ログ記録成功'),
      );
    });

    it('ログシートが見つからない場合に警告を出すべき', () => {
      mockSpreadsheet.getSheetByName.mockReturnValueOnce(null); // For "Log" sheet

      const mockLogData = {
        timestamp: '',
        userId: '',
        message: '',
        response: '',
      };
      writeLog(mockLogData);

      expect(mockSpreadsheetApp.openById).toHaveBeenCalledWith(
        'test_spreadsheet_id',
      );
      expect(mockSpreadsheet.getSheetByName).toHaveBeenCalledWith('Log');
      expect(
        mockSpreadsheet.getSheetByName('Log')?.appendRow,
      ).not.toHaveBeenCalled();
      expect(mockConsole.warn).toHaveBeenCalledWith(
        expect.stringContaining('Logシートが見つかりません'),
      );
    });
  });

  describe('saveEmbedding', () => {
    it('指定した行にEmbeddingを正しく保存できるべき', () => {
      const testEmbedding = [0.1, 0.2, 0.3, 0.4];
      const rowIndex = 2;

      saveEmbedding(rowIndex, testEmbedding);

      expect(mockSpreadsheetApp.openById).toHaveBeenCalledWith(
        'test_spreadsheet_id',
      );
      expect(mockSpreadsheet.getSheetByName).toHaveBeenCalledWith('FAQ');
      expect(mockSheet.getRange).toHaveBeenCalledWith(rowIndex, 3); // C列（3列目）
      expect(mockSheet.setValue).toHaveBeenCalledWith(
        JSON.stringify(testEmbedding),
      );
      expect(mockSpreadsheetApp.flush).toHaveBeenCalled();
      expect(mockConsole.log).toHaveBeenCalledWith(
        `[Sheet] Embedding保存成功: 行${rowIndex}`,
      );
    });

    it('FAQシートが見つからない場合にエラーをスローすべき', () => {
      mockSpreadsheet.getSheetByName.mockReturnValue(null);

      expect(() => saveEmbedding(2, [0.1, 0.2])).toThrow(
        'FAQシートが見つかりません',
      );
      expect(mockConsole.error).toHaveBeenCalledWith(
        expect.stringContaining('Embedding保存エラー'),
        expect.any(Error),
      );
    });
  });

  describe('getFaqsWithoutEmbedding', () => {
    it('Embedding未設定のFAQを正しく取得できるべき', () => {
      const mockSheetData = [
        ['Question', 'Answer', 'Embedding'], // ヘッダー
        ['質問1', '回答1', JSON.stringify([0.1, 0.2])], // Embeddingあり
        ['質問2', '回答2', ''], // Embeddingなし
        ['質問3', '回答3', null], // Embeddingなし（null）
        ['', '', ''], // 空行
        ['質問4', '回答4', undefined], // Embeddingなし（undefined）
      ];

      mockSheet.getValues.mockReturnValue(mockSheetData);

      const result = getFaqsWithoutEmbedding();

      expect(mockSpreadsheetApp.openById).toHaveBeenCalledWith(
        'test_spreadsheet_id',
      );
      expect(mockSpreadsheet.getSheetByName).toHaveBeenCalledWith('FAQ');

      // Embeddingがない3件が返される（質問2, 質問3, 質問4）
      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({
        question: '質問2',
        answer: '回答2',
        rowIndex: 3, // 1ベースの行番号（ヘッダー行+1）
      });
      expect(result[1]).toEqual({
        question: '質問3',
        answer: '回答3',
        rowIndex: 4,
      });
      expect(result[2]).toEqual({
        question: '質問4',
        answer: '回答4',
        rowIndex: 6,
      });

      expect(mockConsole.log).toHaveBeenCalledWith(
        '[Sheet] Embedding未設定FAQ: 3件',
      );
    });

    it('すべてのFAQにEmbeddingがある場合は空配列を返すべき', () => {
      const mockSheetData = [
        ['Question', 'Answer', 'Embedding'],
        ['質問1', '回答1', JSON.stringify([0.1, 0.2])],
        ['質問2', '回答2', JSON.stringify([0.3, 0.4])],
      ];

      mockSheet.getValues.mockReturnValue(mockSheetData);

      const result = getFaqsWithoutEmbedding();

      expect(result).toHaveLength(0);
      expect(mockConsole.log).toHaveBeenCalledWith(
        '[Sheet] Embedding未設定FAQ: 0件',
      );
    });
  });

  describe('getAllUserIds', () => {
    it('Usersシートから全ユーザーIDを正しく取得すべき', () => {
      const mockUserData = [
        ['user123', '2025-08-01'],
        ['user456', '2025-08-02'],
        ['user789', '2025-08-03'],
      ];

      mockSheet.getLastRow.mockReturnValue(4); // ヘッダー + 3行
      mockSheet.getRange.mockReturnValue({
        getValues: jest.fn().mockReturnValue(mockUserData),
      });

      const result = getAllUserIds();

      expect(result).toEqual(['user123', 'user456', 'user789']);
      expect(mockSpreadsheet.getSheetByName).toHaveBeenCalledWith('Users');
      expect(mockSheet.getRange).toHaveBeenCalledWith(2, 1, 3, 1);
    });

    it('Usersシートが空の場合、空配列を返すべき', () => {
      mockSheet.getLastRow.mockReturnValue(1); // ヘッダーのみ

      const result = getAllUserIds();

      expect(result).toEqual([]);
    });

    it('Usersシートが見つからない場合、空配列を返すべき', () => {
      mockSpreadsheet.getSheetByName.mockReturnValue(null);

      const result = getAllUserIds();

      expect(result).toEqual([]);
      expect(mockConsole.error).toHaveBeenCalledWith(
        '[Sheet] 全ユーザーID取得エラー:',
        expect.any(Error),
      );
    });

    it('空のユーザーIDをフィルタリングすべき', () => {
      const mockUserData = [['user123'], [''], ['user456'], [null]];

      mockSheet.getLastRow.mockReturnValue(5);
      mockSheet.getRange.mockReturnValue({
        getValues: jest.fn().mockReturnValue(mockUserData),
      });

      const result = getAllUserIds();

      expect(result).toEqual(['user123', 'user456']);
    });
  });

  describe('saveNewUser', () => {
    beforeEach(() => {
      global.Date = jest.fn(() => ({
        toString: () => '2025-08-24T10:00:00Z',
      })) as any;
    });

    it('新規ユーザーを正常に保存すべき', () => {
      mockSheet.getLastRow.mockReturnValue(1); // ヘッダーのみ

      saveNewUser('newuser123');

      expect(mockSheet.appendRow).toHaveBeenCalledWith([
        'newuser123',
        expect.any(Object),
      ]);
      expect(mockConsole.log).toHaveBeenCalledWith(
        '[Sheet] 新規ユーザー保存成功: newuser123',
      );
    });

    it('既存ユーザーの場合、保存をスキップすべき', () => {
      const mockUserData = [['existinguser123'], ['anotheruser456']];

      mockSheet.getLastRow.mockReturnValue(3);
      mockSheet.getRange.mockReturnValue({
        getValues: jest.fn().mockReturnValue(mockUserData),
      });

      saveNewUser('existinguser123');

      expect(mockSheet.appendRow).not.toHaveBeenCalled();
      expect(mockConsole.log).toHaveBeenCalledWith(
        '[Sheet] 既存ユーザーのため保存をスキップ: existinguser123',
      );
    });

    it('Usersシートが見つからない場合、エラーログを出力すべき', () => {
      mockSpreadsheet.getSheetByName.mockReturnValue(null);

      saveNewUser('testuser');

      expect(mockConsole.error).toHaveBeenCalledWith(
        '[Sheet] 新規ユーザー保存エラー: testuser',
        expect.any(Error),
      );
    });
  });

  describe('getEventsForMonth', () => {
    it('Eventシートが見つからない場合、空配列を返すべき', () => {
      mockSpreadsheet.getSheetByName.mockReturnValue(null);

      const result = getEventsForMonth(2025, 9);

      expect(result).toEqual([]);
      expect(mockConsole.error).toHaveBeenCalledWith(
        '[Sheet] 月次イベント取得エラー:',
        expect.any(Error),
      );
    });
  });

  describe('getEventsForDate', () => {
    it('Eventシートが見つからない場合、空配列を返すべき', () => {
      mockSpreadsheet.getSheetByName.mockReturnValue(null);

      const targetDate = new Date('2025-09-15');
      const result = getEventsForDate(targetDate);

      expect(result).toEqual([]);
      expect(mockConsole.error).toHaveBeenCalledWith(
        '[Sheet] 日次イベント取得エラー:',
        expect.any(Error),
      );
    });
  });

  describe('recordRSVPInEvent', () => {
    beforeEach(() => {
      // Eventシート用のモック設定
      mockSheet.getLastRow.mockReturnValue(3); // ヘッダー + 2行
      mockSheet.getLastColumn.mockReturnValue(10);
      mockSheet.getRange.mockReturnValue({
        getValues: jest.fn(),
        setValue: jest.fn(),
      });

      // ヘッダーモック
      const mockHeaders = [
        'kintoneRecordId',
        'ステータス',
        'イベント名',
        '開催日',
        '開始時間',
        '終了時間',
        '出席者1',
        '出席者2',
        '出席者3',
      ];
      mockSheet.getRange.mockImplementation(
        (row: number, col: number, numRows: number, _numCols: number) => {
          if (row === 1 && col === 1 && numRows === 1) {
            return { getValues: jest.fn().mockReturnValue([mockHeaders]) };
          }
          if (row === 2 && col === 1) {
            return {
              getValues: jest.fn().mockReturnValue([
                [
                  '123',
                  '未開催',
                  'テストイベント',
                  '2025/9/1',
                  '10:00',
                  '12:00',
                  '',
                  '',
                  '',
                ],
                [
                  '124',
                  '未開催',
                  '別イベント',
                  '2025/9/2',
                  '14:00',
                  '16:00',
                  'user1',
                  '',
                  '',
                ],
              ]),
            };
          }
          return {
            setValue: jest.fn(),
            getValues: jest.fn(),
          };
        },
      );
    });

    it('新規参加登録が正しく処理されるべき', () => {
      const result = recordRSVPInEvent('123', 'user123', 'yes');

      expect(mockLockService.waitLock).toHaveBeenCalledWith(5000);
      expect(mockSpreadsheet.getSheetByName).toHaveBeenCalledWith('Event');
      expect(result).toBe('added');
      expect(mockLockService.releaseLock).toHaveBeenCalled();
    });

    it('既に参加登録済みの場合、already_registeredを返すべき', () => {
      const result = recordRSVPInEvent('124', 'user1', 'yes');

      expect(result).toBe('already_registered');
    });

    it('参加取り消しが正しく処理されるべき', () => {
      const result = recordRSVPInEvent('124', 'user1', 'no');

      expect(result).toBe('removed');
    });

    it('未登録ユーザーの参加取り消しでnot_registeredを返すべき', () => {
      const result = recordRSVPInEvent('123', 'unregistered_user', 'no');

      expect(result).toBe('not_registered');
    });

    it('存在しないイベントIDでevent_not_foundを返すべき', () => {
      const result = recordRSVPInEvent('999', 'user123', 'yes');

      expect(result).toBe('event_not_found');
    });

    it('Eventシートが見つからない場合、invalid_statusを返すべき', () => {
      mockSpreadsheet.getSheetByName.mockReturnValue(null);

      const result = recordRSVPInEvent('123', 'user123', 'yes');

      expect(result).toBe('invalid_status');
      expect(mockConsole.error).toHaveBeenCalledWith(
        '[Sheet] RSVP反映エラー:',
        expect.any(Error),
      );
    });

    it('満席の場合、fullを返すべき', () => {
      // 満席状態のモックデータ
      mockSheet.getRange.mockImplementation(
        (row: number, col: number, numRows: number, _numCols: number) => {
          if (row === 1 && col === 1 && numRows === 1) {
            return {
              getValues: jest
                .fn()
                .mockReturnValue([
                  [
                    'kintoneRecordId',
                    'ステータス',
                    'イベント名',
                    '開催日',
                    '開始時間',
                    '終了時間',
                    '出席者1',
                    '出席者2',
                    '出席者3',
                  ],
                ]),
            };
          }
          if (row === 2 && col === 1) {
            return {
              getValues: jest
                .fn()
                .mockReturnValue([
                  [
                    '123',
                    '未開催',
                    'テストイベント',
                    '2025/9/1',
                    '10:00',
                    '12:00',
                    'user1',
                    'user2',
                    'user3',
                  ],
                ]),
            };
          }
          return { setValue: jest.fn(), getValues: jest.fn() };
        },
      );

      const result = recordRSVPInEvent('123', 'user123', 'yes');

      expect(result).toBe('full');
    });

    it('無効なステータスでinvalid_statusを返すべき', () => {
      const result = recordRSVPInEvent('123', 'user123', 'invalid' as any);

      expect(result).toBe('invalid_status');
    });

    it('ロック取得失敗時にエラーログを出力すべき', () => {
      mockLockService.waitLock.mockImplementation(() => {
        throw new Error('Lock timeout');
      });
      const consoleErrorSpy = jest.spyOn(console, 'error');

      recordRSVPInEvent('123', 'user123', 'yes');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[Sheet] RSVPロック取得に失敗しました',
      );
      consoleErrorSpy.mockRestore();
    });
  });

  describe('getRecentConversationForUser', () => {
    it('指定ユーザーの会話履歴を正しく取得すべき', () => {
      mockSheet.getLastRow.mockReturnValue(6);
      mockSheet.getLastColumn.mockReturnValue(5);

      // モックデータ: [timestamp, userId, message, response, similarity]
      // 2025年の現在に近いタイムスタンプを使用（24時間以内）
      const baseTime = 1726917600000 + 365 * 24 * 60 * 60 * 1000; // 2025年相当
      const mockLogData = [
        [
          new Date(baseTime - 4 * 60 * 60 * 1000),
          'user123',
          'こんにちは',
          'こんにちは！',
          '',
        ],
        [
          new Date(baseTime - 3 * 60 * 60 * 1000),
          'user456',
          '元気？',
          '元気です！',
          '',
        ],
        [
          new Date(baseTime - 2 * 60 * 60 * 1000),
          'user123',
          '今日暑いね',
          'そうですね、暑いですね',
          '',
        ],
        [
          new Date(baseTime - 1 * 60 * 60 * 1000),
          'user123',
          'ありがとう',
          'どういたしまして',
          '',
        ],
      ];

      mockSheet.getRange.mockReturnValue({
        getValues: jest.fn().mockReturnValue(mockLogData),
      });

      const result = getRecentConversationForUser('user123', 2, 9999);

      // limitPairs=2で最新2往復（4件）を取得、最初の会話は除外される
      expect(result).toEqual([
        { role: 'user', content: '今日暑いね' },
        { role: 'assistant', content: 'そうですね、暑いですね' },
        { role: 'user', content: 'ありがとう' },
        { role: 'assistant', content: 'どういたしまして' },
      ]);
    });

    it('最大読み込み行数を制限すべき', () => {
      mockSheet.getLastRow.mockReturnValue(300); // 300行
      mockSheet.getLastColumn.mockReturnValue(5);
      mockSheet.getRange.mockReturnValue({
        getValues: jest.fn().mockReturnValue([]),
      });

      getRecentConversationForUser('user123', 3);

      // 最大200行読み込みのため、101行目から200行目まで読む
      expect(mockSheet.getRange).toHaveBeenCalledWith(101, 1, 200, 5);
    });

    it('指定した往復数で履歴を制限すべき', () => {
      mockSheet.getLastRow.mockReturnValue(10);
      mockSheet.getLastColumn.mockReturnValue(5);

      // 2025年の現在に近いタイムスタンプを使用（24時間以内）
      const baseTime = 1726917600000 + 365 * 24 * 60 * 60 * 1000; // 2025年相当
      const mockLogData = [
        [
          new Date(baseTime - 5 * 60 * 60 * 1000),
          'user123',
          'メッセージ1',
          '応答1',
          '',
        ],
        [
          new Date(baseTime - 4 * 60 * 60 * 1000),
          'user123',
          'メッセージ2',
          '応答2',
          '',
        ],
        [
          new Date(baseTime - 3 * 60 * 60 * 1000),
          'user123',
          'メッセージ3',
          '応答3',
          '',
        ],
        [
          new Date(baseTime - 2 * 60 * 60 * 1000),
          'user123',
          'メッセージ4',
          '応答4',
          '',
        ],
        [
          new Date(baseTime - 1 * 60 * 60 * 1000),
          'user123',
          'メッセージ5',
          '応答5',
          '',
        ],
      ];

      mockSheet.getRange.mockReturnValue({
        getValues: jest.fn().mockReturnValue(mockLogData),
      });

      const result = getRecentConversationForUser('user123', 2, 9999);

      // 最新2往復（4件）のみ取得
      expect(result).toHaveLength(4);
      expect(result[0]).toEqual({ role: 'user', content: 'メッセージ4' });
      expect(result[3]).toEqual({ role: 'assistant', content: '応答5' });
    });

    it('対象ユーザーのデータがない場合は空配列を返すべき', () => {
      mockSheet.getLastRow.mockReturnValue(5);
      mockSheet.getLastColumn.mockReturnValue(5);

      const mockLogData = [
        ['2025-01-01T10:00:00Z', 'other_user', 'メッセージ', '応答', ''],
      ];

      mockSheet.getRange.mockReturnValue({
        getValues: jest.fn().mockReturnValue(mockLogData),
      });

      const result = getRecentConversationForUser('user123', 3);

      expect(result).toEqual([]);
    });

    it('Logシートが存在しない場合は空配列を返すべき', () => {
      mockSpreadsheet.getSheetByName.mockReturnValue(null);

      const result = getRecentConversationForUser('user123', 3);

      expect(result).toEqual([]);
    });

    it('データが不十分な場合は空配列を返すべき', () => {
      mockSheet.getLastRow.mockReturnValue(1); // ヘッダーのみ
      mockSheet.getLastColumn.mockReturnValue(3); // 列数不足

      const result = getRecentConversationForUser('user123', 3);

      expect(result).toEqual([]);
    });

    it('エラー時は空配列を返しエラーログを出力すべき', () => {
      mockSheet.getLastRow.mockImplementation(() => {
        throw new Error('Sheet error');
      });
      const consoleErrorSpy = jest.spyOn(console, 'error');

      const result = getRecentConversationForUser('user123', 3);

      expect(result).toEqual([]);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[Sheet] 会話履歴取得エラー:',
        expect.any(Error),
      );
      consoleErrorSpy.mockRestore();
    });

    it('空文字列のメッセージ・応答は除外すべき', () => {
      mockSheet.getLastRow.mockReturnValue(5);
      mockSheet.getLastColumn.mockReturnValue(5);

      // 2025年の現在に近いタイムスタンプを使用（24時間以内）
      const baseTime = 1726917600000 + 365 * 24 * 60 * 60 * 1000; // 2025年相当
      const mockLogData = [
        [new Date(baseTime - 3 * 60 * 60 * 1000), 'user123', '', '応答1', ''], // 空メッセージ
        [
          new Date(baseTime - 2 * 60 * 60 * 1000),
          'user123',
          'メッセージ2',
          '',
          '',
        ], // 空応答
        [
          new Date(baseTime - 1 * 60 * 60 * 1000),
          'user123',
          'メッセージ3',
          '応答3',
          '',
        ],
      ];

      mockSheet.getRange.mockReturnValue({
        getValues: jest.fn().mockReturnValue(mockLogData),
      });

      const result = getRecentConversationForUser('user123', 3, 9999);

      expect(result).toEqual([
        { role: 'assistant', content: '応答1' },
        { role: 'user', content: 'メッセージ2' },
        { role: 'user', content: 'メッセージ3' },
        { role: 'assistant', content: '応答3' },
      ]);
    });
  });

  describe('appendParticipation', () => {
    let mockInsertSheet: any;

    beforeEach(() => {
      mockInsertSheet = {
        getRange: jest.fn().mockReturnThis(),
        setValues: jest.fn(),
        appendRow: jest.fn(),
      };
      mockSpreadsheet.insertSheet = jest.fn().mockReturnValue(mockInsertSheet);
    });

    it('既存のParticipationシートに正常にエントリを追記すべき', () => {
      const entry = {
        timestamp: '2025-01-01T10:00:00Z',
        eventRecordId: 'event123',
        userId: 'user456',
        action: 'yes' as const,
        source: 'postback' as const,
        note: 'test note',
      };

      appendParticipation(entry);

      expect(mockSpreadsheet.getSheetByName).toHaveBeenCalledWith(
        'Participation',
      );
      expect(mockSheet.appendRow).toHaveBeenCalledWith([
        '2025-01-01T10:00:00Z',
        'event123',
        'user456',
        'yes',
        'postback',
        'test note',
      ]);
    });

    it('Participationシートが存在しない場合、シートを新規作成してエントリを追記すべき', () => {
      mockSpreadsheet.getSheetByName.mockReturnValue(null);

      const entry = {
        timestamp: '2025-01-01T10:00:00Z',
        eventRecordId: 'event123',
        userId: 'user456',
        action: 'no' as const,
        source: 'text' as const,
      };

      appendParticipation(entry);

      expect(mockSpreadsheet.insertSheet).toHaveBeenCalledWith('Participation');
      expect(mockInsertSheet.getRange).toHaveBeenCalledWith(1, 1, 1, 6);
      expect(mockInsertSheet.setValues).toHaveBeenCalledWith([
        ['timestamp', 'eventRecordId', 'userId', 'action', 'source', 'note'],
      ]);
      expect(mockInsertSheet.appendRow).toHaveBeenCalledWith([
        '2025-01-01T10:00:00Z',
        'event123',
        'user456',
        'no',
        'text',
        '',
      ]);
    });

    it('source未指定時はデフォルト値"rsvp"を使用すべき', () => {
      const entry = {
        timestamp: '2025-01-01T10:00:00Z',
        eventRecordId: 'event123',
        userId: 'user456',
        action: 'yes' as const,
      };

      appendParticipation(entry);

      expect(mockSheet.appendRow).toHaveBeenCalledWith([
        '2025-01-01T10:00:00Z',
        'event123',
        'user456',
        'yes',
        'rsvp',
        '',
      ]);
    });

    it('note未指定時は空文字列を使用すべき', () => {
      const entry = {
        timestamp: '2025-01-01T10:00:00Z',
        eventRecordId: 'event123',
        userId: 'user456',
        action: 'cancel' as const,
        source: 'admin' as const,
      };

      appendParticipation(entry);

      expect(mockSheet.appendRow).toHaveBeenCalledWith([
        '2025-01-01T10:00:00Z',
        'event123',
        'user456',
        'cancel',
        'admin',
        '',
      ]);
    });

    it('エラー発生時はコンソールにエラーログを出力すべき', () => {
      mockSheet.appendRow.mockImplementation(() => {
        throw new Error('Append error');
      });
      const consoleErrorSpy = jest.spyOn(console, 'error');

      const entry = {
        timestamp: '2025-01-01T10:00:00Z',
        eventRecordId: 'event123',
        userId: 'user456',
        action: 'yes' as const,
      };

      appendParticipation(entry);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[Sheet] Participation追記エラー:',
        expect.any(Error),
      );
      consoleErrorSpy.mockRestore();
    });
  });

  describe('getUpcomingEvents', () => {
    beforeEach(() => {
      // フェイクタイマーを使用して固定時間を設定
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2025-09-02T10:00:00Z'));

      // デフォルトのEventシートデータをセットアップ
      const headers = [
        'kintoneRecordId',
        'ステータス',
        'イベント名',
        '開催日',
        '開始時間',
        '終了時間',
      ];

      mockSheet.getRange.mockImplementation(
        (row: number, col: number, numRows?: number, _numCols?: number) => {
          if (row === 1 && col === 1 && numRows === 1) {
            // ヘッダー行
            return { getValues: () => [headers] };
          }
          if (row === 2 && numRows && numRows > 1) {
            // データ行
            return { getValues: () => [] };
          }
          return { getValues: () => [[]] };
        },
      );
    });

    afterEach(() => {
      // フェイクタイマーをリセット
      jest.useRealTimers();
    });

    it('今日以降のイベントを日付順で取得すべき', () => {
      // テストデータは固定日付で的しているため、日付変数は不要

      // テストデータ（逆順で設定して、ソート機能をテスト）
      const eventData = [
        ['E003', '未開催', 'イベント3', '2025/9/4', '14:00', '16:00'],
        ['E001', '未開催', 'イベント1', '2025/9/3', '09:00', '12:00'],
        ['E002', '未開催', 'イベント2', '2025/9/3', '14:00', '17:00'],
      ];

      mockSheet.getLastRow.mockReturnValue(4); // ヘッダー + 3行
      mockSheet.getLastColumn.mockReturnValue(6);
      mockSheet.getRange.mockImplementation(
        (row: number, col: number, numRows?: number) => {
          if (row === 1 && numRows === 1) {
            return {
              getValues: () => [
                [
                  'kintoneRecordId',
                  'ステータス',
                  'イベント名',
                  '開催日',
                  '開始時間',
                  '終了時間',
                ],
              ],
            };
          }
          if (row === 2 && numRows === 3) {
            return { getValues: () => eventData };
          }
          return { getValues: () => [[]] };
        },
      );

      const result = getUpcomingEvents(3);

      expect(result).toHaveLength(3);
      // 日付・時間順でソートされていることを確認
      expect(result[0]['イベント名']).toBe('イベント1'); // 明日09:00
      expect(result[1]['イベント名']).toBe('イベント2'); // 明日14:00
      expect(result[2]['イベント名']).toBe('イベント3'); // 明後日14:00
    });

    it('過去のイベントは除外すべき', () => {
      // テストデータは固定日付で的しているため、日付変数は不要

      const eventData = [
        ['E001', '未開催', '過去イベント', '2025/9/1', '09:00', '12:00'],
        ['E002', '未開催', '未来イベント', '2025/9/3', '14:00', '17:00'],
      ];

      mockSheet.getLastRow.mockReturnValue(3);
      mockSheet.getLastColumn.mockReturnValue(6);
      mockSheet.getRange.mockImplementation(
        (row: number, col: number, numRows?: number) => {
          if (row === 1 && numRows === 1) {
            return {
              getValues: () => [
                [
                  'kintoneRecordId',
                  'ステータス',
                  'イベント名',
                  '開催日',
                  '開始時間',
                  '終了時間',
                ],
              ],
            };
          }
          if (row === 2 && numRows === 2) {
            return { getValues: () => eventData };
          }
          return { getValues: () => [[]] };
        },
      );

      const result = getUpcomingEvents(5);

      expect(result).toHaveLength(1);
      expect(result[0]['イベント名']).toBe('未来イベント');
    });

    it('ステータスが「終了」のイベントは除外すべき', () => {
      // テストデータは固定日付で的しているため、日付変数は不要

      const eventData = [
        ['E001', '終了', '終了イベント', '2025/9/3', '09:00', '12:00'],
        ['E002', '未開催', '未開催イベント', '2025/9/3', '14:00', '17:00'],
        ['E003', '開催中', '開催中イベント', '2025/9/3', '18:00', '20:00'],
      ];

      mockSheet.getLastRow.mockReturnValue(4);
      mockSheet.getLastColumn.mockReturnValue(6);
      mockSheet.getRange.mockImplementation(
        (row: number, col: number, numRows?: number) => {
          if (row === 1 && numRows === 1) {
            return {
              getValues: () => [
                [
                  'kintoneRecordId',
                  'ステータス',
                  'イベント名',
                  '開催日',
                  '開始時間',
                  '終了時間',
                ],
              ],
            };
          }
          if (row === 2 && numRows === 3) {
            return { getValues: () => eventData };
          }
          return { getValues: () => [[]] };
        },
      );

      const result = getUpcomingEvents(5);

      expect(result).toHaveLength(2);
      expect(result[0]['イベント名']).toBe('未開催イベント');
      expect(result[1]['イベント名']).toBe('開催中イベント');
    });

    it('ステータスが「キャンセル」のイベントは除外すべき', () => {
      const eventData = [
        [
          'E001',
          'キャンセル',
          'キャンセルイベント',
          '2025/9/3',
          '09:00',
          '12:00',
        ],
        ['E002', '未開催', '未開催イベント', '2025/9/3', '14:00', '17:00'],
        ['E003', '開催中', '開催中イベント', '2025/9/3', '18:00', '20:00'],
      ];

      mockSheet.getLastRow.mockReturnValue(4);
      mockSheet.getLastColumn.mockReturnValue(6);
      mockSheet.getRange.mockImplementation(
        (row: number, col: number, numRows?: number) => {
          if (row === 1 && numRows === 1) {
            return {
              getValues: () => [
                [
                  'kintoneRecordId',
                  'ステータス',
                  'イベント名',
                  '開催日',
                  '開始時間',
                  '終了時間',
                ],
              ],
            };
          }
          if (row === 2 && numRows === 3) {
            return { getValues: () => eventData };
          }
          return { getValues: () => [[]] };
        },
      );

      const result = getUpcomingEvents(5);

      expect(result).toHaveLength(2);
      expect(result[0]['イベント名']).toBe('未開催イベント');
      expect(result[1]['イベント名']).toBe('開催中イベント');
    });

    it('limit指定で取得件数を制限すべき', () => {
      // テストデータは固定日付で的しているため、日付変数は不要

      const eventData = [
        ['E001', '未開催', 'イベント1', '2025/9/3', '09:00', '12:00'],
        ['E002', '未開催', 'イベント2', '2025/9/3', '14:00', '17:00'],
        ['E003', '未開催', 'イベント3', '2025/9/3', '18:00', '20:00'],
      ];

      mockSheet.getLastRow.mockReturnValue(4);
      mockSheet.getLastColumn.mockReturnValue(6);
      mockSheet.getRange.mockImplementation(
        (row: number, col: number, numRows?: number) => {
          if (row === 1 && numRows === 1) {
            return {
              getValues: () => [
                [
                  'kintoneRecordId',
                  'ステータス',
                  'イベント名',
                  '開催日',
                  '開始時間',
                  '終了時間',
                ],
              ],
            };
          }
          if (row === 2 && numRows === 3) {
            return { getValues: () => eventData };
          }
          return { getValues: () => [[]] };
        },
      );

      const result = getUpcomingEvents(2);

      expect(result).toHaveLength(2);
      expect(result[0]['イベント名']).toBe('イベント1');
      expect(result[1]['イベント名']).toBe('イベント2');
    });

    it('イベントがない場合は空配列を返すべき', () => {
      mockSheet.getLastRow.mockReturnValue(1); // ヘッダーのみ
      mockSheet.getLastColumn.mockReturnValue(6);

      const result = getUpcomingEvents(3);

      expect(result).toEqual([]);
    });

    it('Eventシートが見つからない場合はエラーログを出力し空配列を返すべき', () => {
      mockSpreadsheet.getSheetByName.mockReturnValue(null);
      const consoleErrorSpy = jest.spyOn(console, 'error');

      const result = getUpcomingEvents(3);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[Sheet] 直近イベント取得エラー:',
        expect.any(Error),
      );
      expect(result).toEqual([]);
      consoleErrorSpy.mockRestore();
    });

    it('無効な日付のイベントは除外すべき', () => {
      // テストデータは固定日付で的しているため、日付変数は不要

      const eventData = [
        ['E001', '未開催', '無効日付イベント', '無効な日付', '09:00', '12:00'],
        ['E002', '未開催', '有効イベント', '2025/9/3', '14:00', '17:00'],
      ];

      mockSheet.getLastRow.mockReturnValue(3);
      mockSheet.getLastColumn.mockReturnValue(6);
      mockSheet.getRange.mockImplementation(
        (row: number, col: number, numRows?: number) => {
          if (row === 1 && numRows === 1) {
            return {
              getValues: () => [
                [
                  'kintoneRecordId',
                  'ステータス',
                  'イベント名',
                  '開催日',
                  '開始時間',
                  '終了時間',
                ],
              ],
            };
          }
          if (row === 2 && numRows === 2) {
            return { getValues: () => eventData };
          }
          return { getValues: () => [[]] };
        },
      );

      const result = getUpcomingEvents(5);

      expect(result).toHaveLength(1);
      expect(result[0]['イベント名']).toBe('有効イベント');
    });

    it('エラー発生時はコンソールにエラーログを出力し空配列を返すべき', () => {
      mockSheet.getLastRow.mockImplementation(() => {
        throw new Error('Sheet access error');
      });
      const consoleErrorSpy = jest.spyOn(console, 'error');

      const result = getUpcomingEvents(3);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[Sheet] 直近イベント取得エラー:',
        expect.any(Error),
      );
      expect(result).toEqual([]);
      consoleErrorSpy.mockRestore();
    });

    it('デフォルトのlimit値（3）が適用されるべき', () => {
      // テストデータは固定日付で的しているため、日付変数は不要

      const eventData = Array.from({ length: 5 }, (_, i) => [
        `E00${i + 1}`,
        '未開催',
        `イベント${i + 1}`,
        '2025/9/3',
        `${9 + i}:00`,
        `${12 + i}:00`,
      ]);

      mockSheet.getLastRow.mockReturnValue(6);
      mockSheet.getLastColumn.mockReturnValue(6);
      mockSheet.getRange.mockImplementation(
        (row: number, col: number, numRows?: number) => {
          if (row === 1 && numRows === 1) {
            return {
              getValues: () => [
                [
                  'kintoneRecordId',
                  'ステータス',
                  'イベント名',
                  '開催日',
                  '開始時間',
                  '終了時間',
                ],
              ],
            };
          }
          if (row === 2 && numRows === 5) {
            return { getValues: () => eventData };
          }
          return { getValues: () => [[]] };
        },
      );

      const result = getUpcomingEvents(); // limitを指定しない

      expect(result).toHaveLength(3); // デフォルトの3件
    });
  });
});
