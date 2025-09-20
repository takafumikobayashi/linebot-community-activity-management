/**
 * スケジュール処理のテスト
 */

import {
  sendMonthlySchedule,
  sendEventReminders,
  sendThankYouMessages,
} from '../src/handlers/scheduled';
import {
  getAllUserIds,
  getEventsForMonth,
  getEventsForDate,
} from '../src/services/sheet';
import {
  pushMessage,
  pushMessageWithImage,
  pushConfirmParticipation,
  pushConfirmParticipationWithImage,
  multicastMessages,
} from '../src/services/line';

// 依存モジュールをモック化
jest.mock('../src/services/sheet');
jest.mock('../src/services/line');

describe('scheduled.ts', () => {
  const mockGetAllUserIds = getAllUserIds as jest.Mock;
  const mockGetEventsForMonth = getEventsForMonth as jest.Mock;
  const mockGetEventsForDate = getEventsForDate as jest.Mock;
  const _mockPushMessage = pushMessage as jest.Mock;
  const mockPushMessageWithImage = pushMessageWithImage as jest.Mock;
  const _mockPushConfirmParticipation = pushConfirmParticipation as jest.Mock;
  const _mockPushConfirmParticipationWithImage =
    pushConfirmParticipationWithImage as jest.Mock;
  const mockMulticastMessages = multicastMessages as jest.Mock;
  const mockUtilities = global.Utilities as jest.Mocked<
    typeof global.Utilities
  >;
  const mockConsole = global.console as jest.Mocked<typeof global.console>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Utilitiesのモック設定
    mockUtilities.sleep = jest.fn();
  });

  describe('sendMonthlySchedule', () => {
    beforeEach(() => {
      // Dateのモック設定
      const mockDate = new Date('2025-09-01T10:00:00Z');
      jest.spyOn(global, 'Date').mockImplementation(() => mockDate as any);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('月初の活動予定を全ユーザーに配信すべき', () => {
      const mockUsers = ['user1', 'user2', 'user3'];
      const mockEvents = [
        {
          イベント名: 'ボランティア清掃',
          開催日: '2025/9/15',
          開始時間: '10:00',
          終了時間: '12:00',
          kintoneRecordId: '101',
        },
        {
          イベント名: '地域イベント',
          開催日: '2025/9/20',
          開始時間: '14:00',
          終了時間: '16:00',
          kintoneRecordId: '102',
        },
      ];

      mockGetAllUserIds.mockReturnValue(mockUsers);
      mockGetEventsForMonth.mockReturnValue(mockEvents);

      sendMonthlySchedule();

      expect(mockGetAllUserIds).toHaveBeenCalled();
      expect(mockGetEventsForMonth).toHaveBeenCalledWith(2025, 9);
      expect(mockMulticastMessages).toHaveBeenCalledTimes(1);
      expect(mockMulticastMessages).toHaveBeenCalledWith(
        mockUsers,
        expect.arrayContaining([
          expect.objectContaining({
            type: 'text',
            text: expect.stringContaining('📅 9月の活動予定です！'),
          }),
          expect.objectContaining({
            type: 'template',
            template: expect.objectContaining({ type: 'carousel' }),
          }),
        ]),
      );

      expect(mockConsole.log).toHaveBeenCalledWith(
        '[Schedule] 3人のユーザーに配信を開始します。',
      );
      expect(mockConsole.log).toHaveBeenCalledWith(
        '[Schedule] 月次予定配信処理 正常終了',
      );
    });

    it('配信対象ユーザーがいない場合、処理を終了すべき', () => {
      mockGetAllUserIds.mockReturnValue([]);

      sendMonthlySchedule();

      expect(mockGetEventsForMonth).not.toHaveBeenCalled();
      expect(mockMulticastMessages).not.toHaveBeenCalled();
      expect(mockConsole.log).toHaveBeenCalledWith(
        '[Schedule] 配信対象のユーザーがいません。処理を終了します。',
      );
    });

    it('対象月にイベントがない場合、配信をスキップすべき', () => {
      const mockUsers = ['user1', 'user2'];
      mockGetAllUserIds.mockReturnValue(mockUsers);
      mockGetEventsForMonth.mockReturnValue([]);

      sendMonthlySchedule();

      expect(mockMulticastMessages).not.toHaveBeenCalled();
      expect(mockConsole.log).toHaveBeenCalledWith(
        '[Schedule] 2025年9月のイベントが見つかりません。配信をスキップします。',
      );
    });

    it('配信中にエラーが発生しても処理を継続すべき', () => {
      const mockUsers = Array.from({ length: 151 }, (_, i) => `user${i + 1}`);
      const mockEvents = [
        {
          イベント名: 'テストイベント',
          開催日: '2025/9/15',
          開始時間: '10:00',
          終了時間: '12:00',
          kintoneRecordId: '103',
        },
      ];

      mockGetAllUserIds.mockReturnValue(mockUsers);
      mockGetEventsForMonth.mockReturnValue(mockEvents);
      mockMulticastMessages
        .mockImplementationOnce(() => {
          throw new Error('送信エラー');
        })
        .mockImplementationOnce(() => {}); // 2回目は成功

      sendMonthlySchedule();

      expect(mockMulticastMessages).toHaveBeenCalledTimes(2);
      expect(mockConsole.error).toHaveBeenCalledWith(
        '[Schedule] バッチ配信失敗:',
        expect.any(Error),
      );
      // 2回目成功のログ（件数は151→150,1で出力される想定）
      expect(mockConsole.log).toHaveBeenCalledWith(
        expect.stringContaining('バッチ配信成功'),
      );
    });

    it('API制限対策で20件ごとに待機すべき', () => {
      const mockUsers = Array.from({ length: 300 }, (_, i) => `user${i + 1}`);
      const mockEvents = [
        {
          イベント名: 'テスト',
          開催日: '2025/9/15',
          開始時間: '10:00',
          終了時間: '12:00',
          kintoneRecordId: '104',
        },
      ];

      mockGetAllUserIds.mockReturnValue(mockUsers);
      mockGetEventsForMonth.mockReturnValue(mockEvents);

      sendMonthlySchedule();

      expect(mockMulticastMessages).toHaveBeenCalledTimes(2); // 150件ずつ2バッチ
      expect(mockUtilities.sleep).toHaveBeenCalledWith(1000);
      expect(mockUtilities.sleep).toHaveBeenCalledTimes(1); // バッチ間に1回
    });

    it('親しみやすいカルーセルメッセージの内容が正しく作成されるべき', () => {
      const mockUsers = ['user1'];
      const mockEvents = [
        {
          イベント名: '公園清掃ボランティア',
          開催日: '2025/9/15',
          開始時間: '10:00',
          終了時間: '12:00',
          kintoneRecordId: '201',
          画像URL: 'https://example.com/image1.jpg',
        },
        {
          イベント名: '子ども食堂お手伝い',
          開催日: '2025/9/20',
          開始時間: '14:00',
          終了時間: '16:00',
          kintoneRecordId: '202',
          画像URL: '',
        },
      ];

      mockGetAllUserIds.mockReturnValue(mockUsers);
      mockGetEventsForMonth.mockReturnValue(mockEvents);

      sendMonthlySchedule();

      // マルチキャストで送信される内容を検証
      expect(mockMulticastMessages).toHaveBeenCalledWith(mockUsers, [
        {
          type: 'text',
          text: '📅 9月の活動予定です！\n\n各活動の参加・不参加を選択してください。',
        },
        {
          type: 'template',
          altText: '月次スケジュールのご案内',
          template: {
            type: 'carousel',
            columns: [
              expect.objectContaining({
                title: '📌 公園清掃ボランティア',
                text: '9/1(月) 🕒 10:00 - 12:00',
                thumbnailImageUrl: 'https://example.com/image1.jpg',
                imageBackgroundColor: '#FFFFFF',
                actions: [
                  {
                    type: 'message',
                    label: '参加する',
                    text: '9/1(月) 参加します',
                  },
                  {
                    type: 'message',
                    label: '不参加',
                    text: '9/1(月) 不参加',
                  },
                ],
              }),
              expect.objectContaining({
                title: '📌 子ども食堂お手伝い',
                text: '9/1(月) 🕒 14:00 - 16:00',
                actions: [
                  {
                    type: 'message',
                    label: '参加する',
                    text: '9/1(月) 参加します',
                  },
                  {
                    type: 'message',
                    label: '不参加',
                    text: '9/1(月) 不参加',
                  },
                ],
              }),
            ],
          },
        },
      ]);
    });

    it('recordIdが空の場合は警告ログを出力すべき', () => {
      const mockUsers = ['user1'];
      const mockEvents = [
        {
          イベント名: 'recordId空イベント',
          開催日: '2025/9/15',
          開始時間: '10:00',
          終了時間: '12:00',
          kintoneRecordId: '',
        },
      ];

      mockGetAllUserIds.mockReturnValue(mockUsers);
      mockGetEventsForMonth.mockReturnValue(mockEvents);

      sendMonthlySchedule();

      expect(mockConsole.warn).toHaveBeenCalledWith(
        '[Schedule] 空のrecordIdが検出されました: recordId空イベント',
      );
    });
  });

  describe('sendEventReminders', () => {
    beforeEach(() => {
      // Dateモックを簡素化
      const mockDate = new Date('2025-09-14T10:00:00Z');
      jest.spyOn(global, 'Date').mockImplementation(() => mockDate as any);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('前日リマインダーを参加者に送信すべき', () => {
      const mockEvents = [
        {
          イベント名: 'ボランティア清掃',
          開始時間: '10:00',
          終了時間: '12:00',
          出席者1: 'user1',
          出席者2: 'user2',
          出席者3: null,
          出席者4: 'user3',
        },
      ];

      mockGetEventsForDate.mockReturnValue(mockEvents);

      sendEventReminders();

      expect(mockGetEventsForDate).toHaveBeenCalled();
      expect(mockPushMessageWithImage).toHaveBeenCalledTimes(3);
      expect(mockPushMessageWithImage).toHaveBeenCalledWith(
        'user1',
        expect.stringContaining(
          '🔔 リマインダー\n📅 明日は「ボランティア清掃」の活動日です！',
        ),
        undefined, // 画像URLがない場合はundefined
      );
      expect(mockConsole.log).toHaveBeenCalledWith(
        '[Schedule] 前日リマインダー処理 正常終了',
      );
    });

    it('画像URLがある場合、画像付きリマインダーを送信すべき', () => {
      const mockEvents = [
        {
          イベント名: 'ボランティア清掃',
          開始時間: '10:00',
          終了時間: '12:00',
          kintoneRecordId: '123',
          画像URL: 'https://example.com/event.jpg',
          出席者1: 'user1',
          出席者2: 'user2',
        },
      ];

      mockGetEventsForDate.mockReturnValue(mockEvents);

      sendEventReminders();

      expect(mockPushMessageWithImage).toHaveBeenCalledWith(
        'user1',
        expect.stringContaining('🔔 リマインダー'),
        'https://example.com/event.jpg',
      );
      expect(mockPushMessageWithImage).toHaveBeenCalledWith(
        'user2',
        expect.stringContaining('🔔 リマインダー'),
        'https://example.com/event.jpg',
      );
    });

    it('画像URLが空の場合、undefinedで画像なしリマインダーを送信すべき', () => {
      const mockEvents = [
        {
          イベント名: 'ボランティア清掃',
          開始時間: '10:00',
          終了時間: '12:00',
          kintoneRecordId: '123',
          画像URL: '', // 空の画像URL
          出席者1: 'user1',
        },
      ];

      mockGetEventsForDate.mockReturnValue(mockEvents);

      sendEventReminders();

      expect(mockPushMessageWithImage).toHaveBeenCalledWith(
        'user1',
        expect.stringContaining('🔔 リマインダー'),
        undefined, // フォールバック画像設定がない場合はundefined
      );
    });

    it('翌日のイベントがない場合、処理を終了すべき', () => {
      mockGetEventsForDate.mockReturnValue([]);

      sendEventReminders();

      expect(mockPushMessageWithImage).not.toHaveBeenCalled();
      expect(mockConsole.log).toHaveBeenCalledWith(
        '[Schedule] 翌日開催のイベントはありません。処理を終了します。',
      );
    });

    it('参加者がいないイベントはスキップすべき', () => {
      const mockEvents = [
        {
          イベント名: '参加者なしイベント',
          開始時間: '10:00',
          終了時間: '12:00',
        },
      ];

      mockGetEventsForDate.mockReturnValue(mockEvents);

      sendEventReminders();

      expect(mockPushMessageWithImage).not.toHaveBeenCalled();
      expect(mockConsole.log).toHaveBeenCalledWith(
        '[Schedule] イベント「参加者なしイベント」には参加者がいません。',
      );
    });
  });

  describe('sendThankYouMessages', () => {
    beforeEach(() => {
      const mockDate = new Date('2025-09-15T20:00:00Z');
      jest.spyOn(global, 'Date').mockImplementation(() => mockDate as any);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('当日のお礼メッセージを参加者に送信すべき', () => {
      const mockEvents = [
        {
          イベント名: 'ボランティア清掃',
          出席者1: 'user1',
          出席者2: 'user2',
          出席者3: null,
          出席者4: 'user3',
        },
      ];

      mockGetEventsForDate.mockReturnValue(mockEvents);

      sendThankYouMessages();

      expect(mockGetEventsForDate).toHaveBeenCalled();
      expect(mockPushMessageWithImage).toHaveBeenCalledTimes(3);
      expect(mockPushMessageWithImage).toHaveBeenCalledWith(
        'user1',
        expect.stringContaining(
          '🙏 活動のお礼\n本日は「ボランティア清掃」にご参加いただき',
        ),
        undefined, // 画像URLがない場合はundefined
      );
      expect(mockConsole.log).toHaveBeenCalledWith(
        '[Schedule] お礼メッセージ処理 正常終了',
      );
    });

    it('本日のイベントがない場合、処理を終了すべき', () => {
      mockGetEventsForDate.mockReturnValue([]);

      sendThankYouMessages();

      expect(mockPushMessageWithImage).not.toHaveBeenCalled();
      expect(mockConsole.log).toHaveBeenCalledWith(
        '[Schedule] 本日開催のイベントはありません。処理を終了します。',
      );
    });

    it('参加者がいないイベントはスキップすべき', () => {
      const mockEvents = [
        {
          イベント名: '参加者なしイベント',
        },
      ];

      mockGetEventsForDate.mockReturnValue(mockEvents);

      sendThankYouMessages();

      expect(mockPushMessageWithImage).not.toHaveBeenCalled();
      expect(mockConsole.log).toHaveBeenCalledWith(
        '[Schedule] イベント「参加者なしイベント」には参加者がいません。',
      );
    });

    it('処理中にエラーが発生した場合、エラーログを出力すべき', () => {
      mockGetEventsForDate.mockImplementation(() => {
        throw new Error('データ取得エラー');
      });

      sendThankYouMessages();

      expect(mockConsole.error).toHaveBeenCalledWith(
        '[Schedule] お礼メッセージ処理でエラーが発生しました:',
        expect.any(Error),
      );
    });
  });
});
