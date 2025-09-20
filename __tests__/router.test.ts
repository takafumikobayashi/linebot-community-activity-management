import { routeEvent } from '../src/router';
import { handleFaq } from '../src/handlers/faq';
import { replyMessage, pushMessage } from '../src/services/line';
import {
  generateAnswer,
  createChatPrompt,
  createChatPromptWithHistory,
  generateChatWithHistory,
} from '../src/services/openai';
import {
  getConfig,
  getSingleWordFaqTriggers,
  getConversationContextConfig,
} from '../src/utils/env';
import {
  saveNewUser,
  getEventsForDate,
  recordRSVPInEvent,
  writeLog,
  getRecentConversationForUser,
  getUpcomingEvents,
} from '../src/services/sheet';
import { LineEvent, LineMessage } from '../src/types';

// 依存モジュールをモック化
jest.mock('../src/handlers/faq');
jest.mock('../src/services/line');
jest.mock('../src/services/openai');
jest.mock('../src/utils/env');
jest.mock('../src/services/sheet');

describe('router.ts', () => {
  // モックされた関数を型付け
  const mockHandleFaq = handleFaq as jest.Mock;
  const mockReplyMessage = replyMessage as jest.Mock;
  const mockPushMessage = pushMessage as jest.Mock;
  const mockGenerateAnswer = generateAnswer as jest.Mock;
  const mockCreateChatPrompt = createChatPrompt as jest.Mock;
  const mockCreateChatPromptWithHistory =
    createChatPromptWithHistory as jest.Mock;
  const mockGenerateChatWithHistory = generateChatWithHistory as jest.Mock;
  const mockGetConfig = getConfig as jest.Mock;
  const mockGetSingleWordFaqTriggers = getSingleWordFaqTriggers as jest.Mock;
  const mockGetConversationContextConfig =
    getConversationContextConfig as jest.Mock;
  const mockSaveNewUser = saveNewUser as jest.Mock;
  const mockGetEventsForDate = getEventsForDate as jest.Mock;
  const mockRecordRSVPInEvent = recordRSVPInEvent as jest.Mock;
  const mockWriteLog = writeLog as jest.Mock;
  const mockGetRecentConversationForUser =
    getRecentConversationForUser as jest.Mock;
  const mockGetUpcomingEvents = getUpcomingEvents as jest.Mock;

  beforeEach(() => {
    // 各テストの前にすべてのモックをクリア
    jest.clearAllMocks();

    // getConfigのデフォルトモック設定
    mockGetConfig.mockReturnValue({
      CHANNEL_ACCESS_TOKEN: 'test_channel_access_token',
      OPENAI_API_KEY: 'test_openai_api_key',
      SPREADSHEET_ID: 'test_spreadsheet_id',
      SIMILARITY_THRESHOLD: 0.75,
      STAFF_USER_ID: 'U1234567890abcdef', // テスト用の職員ID
    });
    // デフォルトでは単語トリガーを無効（空）にする
    if (mockGetSingleWordFaqTriggers) {
      mockGetSingleWordFaqTriggers.mockReturnValue([]);
    }

    // 会話コンテキスト設定のデフォルト
    mockGetConversationContextConfig.mockReturnValue({
      maxConversationPairs: 7,
      maxContextHours: 24,
    });

    // デフォルトの返信メッセージモック
    mockReplyMessage.mockImplementation((_replyToken, _text) => {
      // console.log(`[Mock] replyMessage called: ${text}`); // テスト中のログを減らすためコメントアウト
    });
    mockPushMessage.mockImplementation((_userId, _text) => {
      // console.log(`[Mock] pushMessage called: ${userId} - ${text}`); // テスト中のログを減らすためコメントアウト
    });
    mockGenerateAnswer.mockReturnValue('AIからのテスト応答');
    mockCreateChatPrompt.mockReturnValue('テストプロンプト');
    mockCreateChatPromptWithHistory.mockReturnValue('履歴付きテストプロンプト');
    mockGenerateChatWithHistory.mockReturnValue('AIからのテスト応答');
    mockGetRecentConversationForUser.mockReturnValue([]);
  });

  // ヘルパー関数: LINEイベントオブジェクトを作成
  const createLineMessageEvent = (text: string): LineEvent => ({
    type: 'message',
    replyToken: 'test_reply_token',
    source: {
      userId: 'test_user_id',
      type: 'user',
    },
    timestamp: Date.now(),
    message: {
      id: 'test_message_id',
      type: 'text',
      text: text,
    } as LineMessage,
  });

  const createLineFollowEvent = (): LineEvent => ({
    type: 'follow',
    replyToken: 'test_reply_token',
    source: {
      userId: 'test_user_id',
      type: 'user',
    },
    timestamp: Date.now(),
  });

  const createLinePostbackEvent = (data: string): LineEvent => ({
    type: 'postback',
    replyToken: 'test_reply_token',
    source: {
      userId: 'test_user_id',
      type: 'user',
    },
    timestamp: Date.now(),
    postback: { data: data },
  });

  describe('routeEvent', () => {
    it('メッセージイベントを正しく処理すべき', () => {
      const event = createLineMessageEvent('こんにちは');
      routeEvent(event);
      expect(mockReplyMessage).toHaveBeenCalled();
    });

    it('フォローイベントで新規ユーザーを保存し、歓迎メッセージを送信すべき', () => {
      const event = createLineFollowEvent();
      routeEvent(event);

      expect(mockReplyMessage).toHaveBeenCalledWith(
        event.replyToken,
        expect.stringContaining('友達追加ありがとうございます'),
      );
      expect(mockSaveNewUser).toHaveBeenCalledWith('test_user_id');
    });

    it('フォローイベントでuserIdがない場合、ユーザー保存をスキップすべき', () => {
      const event: LineEvent = {
        type: 'follow',
        replyToken: 'test_reply_token',
        source: {
          userId: '',
          type: 'group',
        },
        timestamp: Date.now(),
      };

      routeEvent(event);

      expect(mockReplyMessage).toHaveBeenCalledWith(
        event.replyToken,
        expect.stringContaining('友達追加ありがとうございます'),
      );
      expect(mockSaveNewUser).not.toHaveBeenCalled();
    });

    it('ポストバックイベント（RSVP）を正しく処理すべき', () => {
      mockRecordRSVPInEvent.mockReturnValue('added');
      const event = createLinePostbackEvent('rsvp:yes:123');
      routeEvent(event);
      expect(mockRecordRSVPInEvent).toHaveBeenCalledWith(
        '123',
        'test_user_id',
        'yes',
        'postback',
      );
      expect(mockReplyMessage).toHaveBeenCalledWith(
        event.replyToken,
        expect.stringContaining('参加ありがとうございます！'),
      );
    });

    it('未対応のポストバックデータにエラーメッセージを返すべき', () => {
      const event = createLinePostbackEvent('unknown_action');
      routeEvent(event);
      expect(mockReplyMessage).toHaveBeenCalledWith(
        event.replyToken,
        '不明なアクションです。',
      );
    });

    it('未対応のイベントタイプをログに記録すべき', () => {
      const event: LineEvent = {
        type: 'unfollow',
        replyToken: 'test_reply_token',
        source: { userId: 'test_user_id', type: 'user' },
        timestamp: Date.now(),
      };
      const consoleSpy = jest.spyOn(console, 'log');
      routeEvent(event);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('未対応のイベントタイプ'),
      );
      consoleSpy.mockRestore();
    });
  });

  describe('handleMessageEvent logic', () => {
    // RSVP固定文言のテスト（「コミュニティ教えて」の次に優先）
    it('RSVP固定文言「参加する」を正しく処理すべき', () => {
      const mockEvents = [
        {
          kintoneRecordId: '123',
          イベント名: 'テストイベント',
        },
      ];
      mockGetEventsForDate.mockReturnValue(mockEvents);
      mockRecordRSVPInEvent.mockReturnValue('added');

      const event = createLineMessageEvent('参加する');
      routeEvent(event);

      expect(mockGetEventsForDate).toHaveBeenCalled();
      expect(mockRecordRSVPInEvent).toHaveBeenCalledWith(
        '123',
        'test_user_id',
        'yes',
        'text',
      );
      expect(mockReplyMessage).toHaveBeenCalledWith(
        event.replyToken,
        expect.stringContaining('参加ありがとうございます！'),
      );
      expect(mockHandleFaq).not.toHaveBeenCalled();
    });

    it('RSVP固定文言「参加します」も正しく処理すべき', () => {
      const mockEvents = [
        {
          kintoneRecordId: '123',
          イベント名: 'テストイベント',
        },
      ];
      mockGetEventsForDate.mockReturnValue(mockEvents);
      mockRecordRSVPInEvent.mockReturnValue('added');

      const event = createLineMessageEvent('参加します');
      routeEvent(event);

      expect(mockRecordRSVPInEvent).toHaveBeenCalledWith(
        '123',
        'test_user_id',
        'yes',
        'text',
      );
    });

    it('RSVP固定文言「キャンセル」を不参加として処理すべき', () => {
      const mockEvents = [
        {
          kintoneRecordId: '123',
          イベント名: 'テストイベント',
        },
      ];
      mockGetEventsForDate.mockReturnValue(mockEvents);
      mockRecordRSVPInEvent.mockReturnValue('removed');

      const event = createLineMessageEvent('キャンセル');
      routeEvent(event);

      expect(mockRecordRSVPInEvent).toHaveBeenCalledWith(
        '123',
        'test_user_id',
        'no',
        'text',
      );
    });

    it('RSVP固定文言「参加取り消し」を不参加として処理すべき', () => {
      const mockEvents = [
        {
          kintoneRecordId: '123',
          イベント名: 'テストイベント',
        },
      ];
      mockGetEventsForDate.mockReturnValue(mockEvents);
      mockRecordRSVPInEvent.mockReturnValue('removed');

      const event = createLineMessageEvent('参加取り消し');
      routeEvent(event);

      expect(mockRecordRSVPInEvent).toHaveBeenCalledWith(
        '123',
        'test_user_id',
        'no',
        'text',
      );
    });

    it('RSVP固定文言「不参加」を正しく処理すべき', () => {
      const mockEvents = [
        {
          kintoneRecordId: '123',
          イベント名: 'テストイベント',
        },
      ];
      mockGetEventsForDate.mockReturnValue(mockEvents);
      mockRecordRSVPInEvent.mockReturnValue('removed');

      const event = createLineMessageEvent('不参加');
      routeEvent(event);

      expect(mockRecordRSVPInEvent).toHaveBeenCalledWith(
        '123',
        'test_user_id',
        'no',
        'text',
      );
      expect(mockReplyMessage).toHaveBeenCalledWith(
        event.replyToken,
        expect.stringContaining('不参加として承知しました。'),
      );
    });

    it('対象イベントがない場合、エラーメッセージを返すべき', () => {
      mockGetEventsForDate.mockReturnValue([]);

      const event = createLineMessageEvent('参加する');
      routeEvent(event);

      expect(mockReplyMessage).toHaveBeenCalledWith(
        event.replyToken,
        expect.stringContaining('対象イベントが見つかりません。'),
      );
    });

    it('対象イベントが複数ある場合、エラーメッセージを返すべき', () => {
      const mockEvents = [
        { kintoneRecordId: '123', イベント名: 'イベント1' },
        { kintoneRecordId: '124', イベント名: 'イベント2' },
      ];
      mockGetEventsForDate.mockReturnValue(mockEvents);

      const event = createLineMessageEvent('参加する');
      routeEvent(event);

      expect(mockReplyMessage).toHaveBeenCalledWith(
        event.replyToken,
        expect.stringContaining('対象イベントが複数あります。'),
      );
    });

    // 固定文言返信のテスト
    it('固定文言「はい」に正しく応答すべき', () => {
      const event = createLineMessageEvent('はい');
      routeEvent(event);
      expect(mockReplyMessage).toHaveBeenCalledWith(
        event.replyToken,
        expect.stringContaining('ありがとうございます！'),
      );
      expect(mockHandleFaq).not.toHaveBeenCalled();
      expect(mockPushMessage).not.toHaveBeenCalled();
      expect(mockGenerateAnswer).not.toHaveBeenCalled();
    });

    it('固定文言「こんにちは」に正しく応答すべき', () => {
      const event = createLineMessageEvent('こんにちは');
      routeEvent(event);
      expect(mockReplyMessage).toHaveBeenCalledWith(
        event.replyToken,
        expect.stringContaining('こんにちは！今日もお疲れさまです。'),
      );
    });

    // ステップ1.5: 独立スケジュール問い合わせのテスト
    it('独立スケジュール問い合わせ「活動日」で予定応答すべき', () => {
      const mockEvents = [
        {
          開催日: '2025/9/15',
          開始時間: '09:00',
          終了時間: '12:00',
          イベント名: '公園清掃',
        },
      ];
      mockGetUpcomingEvents.mockReturnValue(mockEvents);

      const event = createLineMessageEvent('活動日');
      routeEvent(event);

      expect(mockGetUpcomingEvents).toHaveBeenCalledWith(3);
      expect(mockReplyMessage).toHaveBeenCalledWith(
        event.replyToken,
        expect.stringContaining('📅 直近の活動予定'),
      );
      expect(mockHandleFaq).not.toHaveBeenCalled();
    });

    it('独立スケジュール問い合わせ「日程教えて」で予定応答すべき', () => {
      const mockEvents = [
        {
          開催日: '2025/9/16',
          開始時間: '14:00',
          終了時間: '16:00',
          イベント名: '施設訪問',
        },
      ];
      mockGetUpcomingEvents.mockReturnValue(mockEvents);

      const event = createLineMessageEvent('日程教えて');
      routeEvent(event);

      expect(mockGetUpcomingEvents).toHaveBeenCalledWith(3);
      expect(mockReplyMessage).toHaveBeenCalledWith(
        event.replyToken,
        expect.stringContaining('📅 直近の活動予定'),
      );
    });

    it('独立スケジュール問い合わせ「スケジュール知りたい」で予定応答すべき', () => {
      const mockEvents = [
        {
          開催日: '2025/9/17',
          開始時間: '10:00',
          終了時間: '15:00',
          イベント名: '災害復興支援',
        },
      ];
      mockGetUpcomingEvents.mockReturnValue(mockEvents);

      const event = createLineMessageEvent('スケジュール知りたい');
      routeEvent(event);

      expect(mockGetUpcomingEvents).toHaveBeenCalledWith(3);
      expect(mockReplyMessage).toHaveBeenCalledWith(
        event.replyToken,
        expect.stringContaining('📅 直近の活動予定'),
      );
    });

    it('スケジュール問い合わせでDateオブジェクト時間も正しくフォーマットされるべき', () => {
      // Dateオブジェクトとして時間データを設定（JST時間でテスト）
      // UTC-9で設定するとJST(UTC+9)で15:30/20:00になる
      const startTime = new Date('1899-12-30T06:30:00.000Z'); // JST 15:30
      const endTime = new Date('1899-12-30T11:00:00.000Z'); // JST 20:00
      const mockEvents = [
        {
          開催日: '2025/9/19',
          開始時間: startTime,
          終了時間: endTime,
          イベント名: '子ども食堂',
        },
      ];
      mockGetUpcomingEvents.mockReturnValue(mockEvents);

      const event = createLineMessageEvent('活動予定');
      routeEvent(event);

      expect(mockGetUpcomingEvents).toHaveBeenCalledWith(3);
      expect(mockReplyMessage).toHaveBeenCalledWith(
        event.replyToken,
        expect.stringContaining('🔸 9/19(金) 15:30 - 20:00 子ども食堂'),
      );
    });

    it('スケジュール問い合わせで予定がない場合、適切なメッセージを返すべき', () => {
      mockGetUpcomingEvents.mockReturnValue([]);

      const event = createLineMessageEvent('活動予定');
      routeEvent(event);

      expect(mockGetUpcomingEvents).toHaveBeenCalledWith(3);
      expect(mockReplyMessage).toHaveBeenCalledWith(
        event.replyToken,
        '📅 直近の活動予定は未登録です。\nしばらくお待ちください！',
      );
    });

    it('スケジュール問い合わせでエラー時、適切なエラーメッセージを返すべき', () => {
      mockGetUpcomingEvents.mockImplementation(() => {
        throw new Error('Eventシートが見つかりません');
      });
      const consoleErrorSpy = jest.spyOn(console, 'error');

      const event = createLineMessageEvent('日程');
      routeEvent(event);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[Router] スケジュール応答エラー:',
        expect.any(Error),
      );
      expect(mockReplyMessage).toHaveBeenCalledWith(
        event.replyToken,
        '予定の取得中にエラーが発生しました。',
      );

      consoleErrorSpy.mockRestore();
    });

    // 特定キーワードのテスト
    it('アラートキーワード「やめたい」に正しく応答し、職員に通知すべき', () => {
      const event = createLineMessageEvent('もうやめたい');
      routeEvent(event);
      expect(mockReplyMessage).toHaveBeenCalledWith(
        event.replyToken,
        expect.stringContaining('スタッフが確認いたします'),
      );
      expect(mockPushMessage).toHaveBeenCalledWith(
        'U1234567890abcdef',
        expect.stringContaining('【緊急通知】'),
      );
      expect(mockHandleFaq).not.toHaveBeenCalled();
      expect(mockGenerateAnswer).not.toHaveBeenCalled();
    });

    // 「コミュニティ教えて」最優先処理のテスト
    it('「コミュニティ教えて」を含むメッセージ（非スケジュール）をFAQに委譲すべき', () => {
      const event = createLineMessageEvent('コミュニティ教えて 持ち物について');
      routeEvent(event);
      expect(mockHandleFaq).toHaveBeenCalledWith(
        event.replyToken,
        'コミュニティ教えて 持ち物について',
        'test_user_id',
      );
      expect(mockReplyMessage).not.toHaveBeenCalled();
      expect(mockPushMessage).not.toHaveBeenCalled();
      expect(mockGenerateAnswer).not.toHaveBeenCalled();
    });

    it('「クルハウス 教えて」（スペース付き・非スケジュール）もFAQに委譲すべき', () => {
      const event = createLineMessageEvent('クルハウス 教えて 持ち物について');
      routeEvent(event);
      expect(mockHandleFaq).toHaveBeenCalledWith(
        event.replyToken,
        'クルハウス 教えて 持ち物について',
        'test_user_id',
      );
    });

    it('「コミュニティ教えて」が最優先され、RSVP固定文言があっても無視されるべき', () => {
      const event =
        createLineMessageEvent('コミュニティ教えて 参加する方法は？');
      routeEvent(event);
      expect(mockHandleFaq).toHaveBeenCalled();
      expect(mockGetEventsForDate).not.toHaveBeenCalled(); // RSVP処理されない
    });

    it('FAQ トリガーが優先され、アラートキーワードがあっても無視されるべき', () => {
      const event = createLineMessageEvent(
        'コミュニティ教えて やめたい時はどうしたら？',
      );
      routeEvent(event);
      expect(mockHandleFaq).toHaveBeenCalled();
      expect(mockPushMessage).not.toHaveBeenCalled(); // アラート処理されない
    });

    // スケジュール問い合わせ - 「コミュニティ教えて」+ スケジュール分岐テスト
    it('「コミュニティ教えて」+ スケジュール関連はFAQではなく予定応答に分岐すべき', () => {
      const mockEvents = [
        {
          開催日: '2025/9/15',
          開始時間: '09:00',
          終了時間: '12:00',
          イベント名: '公園清掃',
        },
        {
          開催日: '2025/9/16',
          開始時間: '14:00',
          終了時間: '16:00',
          イベント名: '施設訪問',
        },
      ];
      mockGetUpcomingEvents.mockReturnValue(mockEvents);

      const event = createLineMessageEvent(
        'コミュニティ教えて 活動日はいつですか？',
      );
      routeEvent(event);

      expect(mockGetUpcomingEvents).toHaveBeenCalledWith(3);
      expect(mockReplyMessage).toHaveBeenCalledWith(
        event.replyToken,
        expect.stringContaining('📅 直近の活動予定'),
      );
      expect(mockHandleFaq).not.toHaveBeenCalled(); // FAQではなくスケジュール応答
    });

    it('「コミュニティ教えて」+ スケジュール関連（「日程」）も予定応答に分岐すべき', () => {
      const mockEvents = [
        {
          開催日: '2025/9/15',
          開始時間: '09:00',
          終了時間: '12:00',
          イベント名: '公園清掃',
        },
      ];
      mockGetUpcomingEvents.mockReturnValue(mockEvents);

      const event =
        createLineMessageEvent('コミュニティ教えて 今後の日程教えて');
      routeEvent(event);

      expect(mockGetUpcomingEvents).toHaveBeenCalledWith(3);
      expect(mockReplyMessage).toHaveBeenCalledWith(
        event.replyToken,
        expect.stringContaining('📅 直近の活動予定'),
      );
      expect(mockHandleFaq).not.toHaveBeenCalled();
    });

    // 質問判断（FAQ）のテスト
    it('質問形式メッセージ（非スケジュール）をFAQハンドラに委譲すべき', () => {
      const event = createLineMessageEvent('集合場所はどこですか？');
      routeEvent(event);
      expect(mockHandleFaq).toHaveBeenCalledWith(
        event.replyToken,
        '集合場所はどこですか？',
        'test_user_id',
      );
      expect(mockReplyMessage).not.toHaveBeenCalled(); // FAQが処理するのでルーターは返信しない
      expect(mockPushMessage).not.toHaveBeenCalled();
      expect(mockGenerateAnswer).not.toHaveBeenCalled();
    });

    // 単語トリガーのテスト（アラートキーワードの後に判定）
    it('単語トリガー「持ち物？」がFAQに委譲されるべき', () => {
      mockGetSingleWordFaqTriggers.mockReturnValue(['持ち物', '集合場所']);
      const event = createLineMessageEvent('持ち物？');
      routeEvent(event);
      expect(mockHandleFaq).toHaveBeenCalledWith(
        event.replyToken,
        '持ち物？',
        'test_user_id',
      );
      expect(mockReplyMessage).not.toHaveBeenCalled();
      expect(mockGenerateAnswer).not.toHaveBeenCalled();
    });

    // NEW: テキスト起点RSVPの日付指定
    describe('テキスト起点RSVPの日付指定', () => {
      const realNow = Date.now;
      afterEach(() => {
        jest.restoreAllMocks();
        (Date as any).now = realNow;
      });

      it('m/d指定は当年扱いで、開催日の完全一致で選択されるべき', () => {
        const fixedToday = new Date('2025-09-01T10:00:00Z');
        const RealDate = Date as any;
        jest.spyOn(global, 'Date').mockImplementation(((...args: any[]) => {
          return args.length ? new RealDate(...args) : fixedToday;
        }) as any);
        (Date as any).now = () => fixedToday.getTime();

        const mockEvents = [
          {
            開催日: '2025/09/05',
            kintoneRecordId: 'E005',
            イベント名: '早朝清掃',
          },
          {
            開催日: '2025/09/19',
            kintoneRecordId: 'E019',
            イベント名: '公園清掃',
          },
        ];
        mockGetEventsForDate.mockReturnValue(mockEvents);
        mockRecordRSVPInEvent.mockReturnValue('added');

        const event = createLineMessageEvent('9/19 参加します');
        routeEvent(event);

        expect(mockRecordRSVPInEvent).toHaveBeenCalledWith(
          'E019',
          'test_user_id',
          'yes',
          'text',
        );
      });

      it('yyyy/mm/dd 指定はその年で解釈され、完全一致で選択されるべき', () => {
        const fixedToday = new Date('2025-09-01T10:00:00Z');
        const RealDate = Date as any;
        jest.spyOn(global, 'Date').mockImplementation(((...args: any[]) => {
          return args.length ? new RealDate(...args) : fixedToday;
        }) as any);
        (Date as any).now = () => fixedToday.getTime();

        const mockEvents = [
          {
            開催日: '2025/09/19',
            kintoneRecordId: 'E019',
            イベント名: '公園清掃',
          },
        ];
        mockGetEventsForDate.mockReturnValue(mockEvents);
        mockRecordRSVPInEvent.mockReturnValue('added');

        const event = createLineMessageEvent('2025/09/19 参加します');
        routeEvent(event);

        expect(mockRecordRSVPInEvent).toHaveBeenCalledWith(
          'E019',
          'test_user_id',
          'yes',
          'text',
        );
      });

      it('年なしで過去日付の場合は翌年として解釈されるべき', () => {
        const fixedToday = new Date('2025-12-31T10:00:00Z');
        const RealDate = Date as any;
        jest.spyOn(global, 'Date').mockImplementation(((...args: any[]) => {
          return args.length ? new RealDate(...args) : fixedToday;
        }) as any);
        (Date as any).now = () => fixedToday.getTime();

        const mockEvents = [
          {
            開催日: '2026/01/05',
            kintoneRecordId: 'E106',
            イベント名: '新年清掃',
          },
        ];
        mockGetEventsForDate.mockReturnValue(mockEvents);
        mockRecordRSVPInEvent.mockReturnValue('added');

        const event = createLineMessageEvent('1/5 参加します');
        routeEvent(event);

        expect(mockRecordRSVPInEvent).toHaveBeenCalledWith(
          'E106',
          'test_user_id',
          'yes',
          'text',
        );
      });
    });

    it('単語トリガー「集合場所」（句読点なし）がFAQに委譲されるべき', () => {
      mockGetSingleWordFaqTriggers.mockReturnValue(['持ち物', '集合場所']);
      const event = createLineMessageEvent('集合場所');
      routeEvent(event);
      expect(mockHandleFaq).toHaveBeenCalledWith(
        event.replyToken,
        '集合場所',
        'test_user_id',
      );
    });

    it('スペースを含むメッセージは単語トリガーとして扱われないべき', () => {
      mockGetSingleWordFaqTriggers.mockReturnValue(['持ち物']);
      const event = createLineMessageEvent('持ち物 について');
      routeEvent(event);
      expect(mockHandleFaq).toHaveBeenCalled(); // 質問判定でFAQ処理される
    });

    it('単語トリガーがアラートキーワードより優先されないべき', () => {
      mockGetSingleWordFaqTriggers.mockReturnValue(['やめたい']);
      const event = createLineMessageEvent('やめたい');
      routeEvent(event);
      expect(mockPushMessage).toHaveBeenCalled(); // アラート処理が優先
      expect(mockHandleFaq).not.toHaveBeenCalled();
    });

    // 雑談系質問の判定テスト（質問判断の前に処理）
    it('雑談系の質問「元気ですか？」を雑談ハンドラに委譲すべき', () => {
      const event = createLineMessageEvent('元気ですか？');
      routeEvent(event);
      expect(mockGenerateChatWithHistory).toHaveBeenCalledWith(
        expect.any(String), // SHARED_SYSTEM_MESSAGE
        [],
        '元気ですか？',
        200,
        0.3,
      );
      expect(mockReplyMessage).toHaveBeenCalledWith(
        event.replyToken,
        'AIからのテスト応答',
      );
      expect(mockHandleFaq).not.toHaveBeenCalled(); // FAQではなく雑談処理
    });

    it('気持ち系の質問「気分はどうですか？」を雑談ハンドラに委譲すべき', () => {
      const event = createLineMessageEvent('気分はどうですか？');
      routeEvent(event);
      expect(mockGenerateChatWithHistory).toHaveBeenCalledWith(
        expect.any(String), // SHARED_SYSTEM_MESSAGE
        [],
        '気分はどうですか？',
        200,
        0.3,
      );
      expect(mockHandleFaq).not.toHaveBeenCalled();
    });

    it('モチベーション系の質問「やる気が出ないです」を雑談ハンドラに委譲すべき', () => {
      const event = createLineMessageEvent('やる気が出ないです');
      routeEvent(event);
      expect(mockGenerateChatWithHistory).toHaveBeenCalledWith(
        expect.any(String), // SHARED_SYSTEM_MESSAGE
        [],
        'やる気が出ないです',
        200,
        0.3,
      );
      expect(mockHandleFaq).not.toHaveBeenCalled();
    });

    it('元気づけ系の質問「元気が出る方法ありますか？」を雑談ハンドラに委譲すべき', () => {
      const event = createLineMessageEvent('元気が出る方法ありますか？');
      routeEvent(event);
      expect(mockGenerateChatWithHistory).toHaveBeenCalledWith(
        expect.any(String), // SHARED_SYSTEM_MESSAGE
        [],
        '元気が出る方法ありますか？',
        200,
        0.3,
      );
      expect(mockHandleFaq).not.toHaveBeenCalled();
    });

    // 雑談処理のテスト
    it('質問形式でないメッセージを雑談ハンドラに委譲すべき', () => {
      const event = createLineMessageEvent('今日の天気は良いですね');
      routeEvent(event);
      expect(mockGenerateChatWithHistory).toHaveBeenCalledWith(
        expect.any(String), // SHARED_SYSTEM_MESSAGE
        [],
        '今日の天気は良いですね',
        200,
        0.3,
      );
      expect(mockReplyMessage).toHaveBeenCalledWith(
        event.replyToken,
        'AIからのテスト応答',
      );
      expect(mockHandleFaq).not.toHaveBeenCalled();
      expect(mockPushMessage).not.toHaveBeenCalled();
    });

    it('テキストメッセージ以外は対応しない旨を返信すべき', () => {
      const event: LineEvent = {
        type: 'message',
        replyToken: 'test_reply_token',
        source: { userId: 'test_user_id', type: 'user' },
        timestamp: Date.now(),
        message: { id: 'test_message_id', type: 'image' } as LineMessage,
      };
      routeEvent(event);
      expect(mockReplyMessage).toHaveBeenCalledWith(
        event.replyToken,
        expect.stringContaining('テキストメッセージ以外はまだ対応していません'),
      );
      expect(mockHandleFaq).not.toHaveBeenCalled();
      expect(mockPushMessage).not.toHaveBeenCalled();
      expect(mockGenerateAnswer).not.toHaveBeenCalled();
    });
  });

  describe('RSVP postback handling', () => {
    it('参加ボタンのポストバックを正しく処理すべき', () => {
      mockRecordRSVPInEvent.mockReturnValue('added');
      const event = createLinePostbackEvent('rsvp:yes:123');
      routeEvent(event);

      expect(mockRecordRSVPInEvent).toHaveBeenCalledWith(
        '123',
        'test_user_id',
        'yes',
        'postback',
      );
      expect(mockReplyMessage).toHaveBeenCalledWith(
        event.replyToken,
        '参加ありがとうございます！当日お待ちしています。',
      );
    });

    it('不参加ボタンのポストバックを正しく処理すべき', () => {
      mockRecordRSVPInEvent.mockReturnValue('removed');
      const event = createLinePostbackEvent('rsvp:no:123');
      routeEvent(event);

      expect(mockRecordRSVPInEvent).toHaveBeenCalledWith(
        '123',
        'test_user_id',
        'no',
        'postback',
      );
      expect(mockReplyMessage).toHaveBeenCalledWith(
        event.replyToken,
        '不参加として承知しました。次の機会にぜひ！',
      );
    });

    it('既に参加登録済みの場合のメッセージを返すべき', () => {
      mockRecordRSVPInEvent.mockReturnValue('already_registered');
      const event = createLinePostbackEvent('rsvp:yes:123');
      routeEvent(event);

      expect(mockReplyMessage).toHaveBeenCalledWith(
        event.replyToken,
        'すでに参加登録されています。変更が必要な場合は「不参加」と返信してください。',
      );
    });

    it('未登録の場合のメッセージを返すべき', () => {
      mockRecordRSVPInEvent.mockReturnValue('not_registered');
      const event = createLinePostbackEvent('rsvp:no:123');
      routeEvent(event);

      expect(mockReplyMessage).toHaveBeenCalledWith(
        event.replyToken,
        '現在参加登録はありません。参加をご希望の場合は「参加する」とお知らせください。',
      );
    });

    it('満席の場合のメッセージを返すべき', () => {
      mockRecordRSVPInEvent.mockReturnValue('full');
      const event = createLinePostbackEvent('rsvp:yes:123');
      routeEvent(event);

      expect(mockReplyMessage).toHaveBeenCalledWith(
        event.replyToken,
        '申し訳ありません、このイベントは満席です。',
      );
    });

    it('イベントが見つからない場合のメッセージを返すべき', () => {
      mockRecordRSVPInEvent.mockReturnValue('event_not_found');
      const event = createLinePostbackEvent('rsvp:yes:999');
      routeEvent(event);

      expect(mockReplyMessage).toHaveBeenCalledWith(
        event.replyToken,
        '対象のイベントが見つかりませんでした。',
      );
    });
  });

  describe('handleGeneralChat with context history', () => {
    it('履歴なしの場合、通常の雑談プロンプトを使用すべき', () => {
      mockGetRecentConversationForUser.mockReturnValue([]);

      const event = createLineMessageEvent('今日は良い天気ですね');
      routeEvent(event);

      expect(mockGetRecentConversationForUser).toHaveBeenCalledWith(
        'test_user_id',
        7,
        24,
      );
      expect(mockGenerateChatWithHistory).toHaveBeenCalledWith(
        expect.any(String), // SHARED_SYSTEM_MESSAGE
        [],
        '今日は良い天気ですね',
        200,
        0.3,
      );
      expect(mockReplyMessage).toHaveBeenCalledWith(
        'test_reply_token',
        'AIからのテスト応答',
      );
      expect(mockWriteLog).toHaveBeenCalledWith({
        timestamp: expect.any(String),
        userId: 'test_user_id',
        message: '今日は良い天気ですね',
        response: 'AIからのテスト応答',
      });
    });

    it('履歴がある場合、履歴付きプロンプトを使用すべき', () => {
      const mockHistory = [
        { role: 'user', content: '元気ですか？' },
        { role: 'assistant', content: '元気です！' },
      ];
      mockGetRecentConversationForUser.mockReturnValue(mockHistory);

      const event = createLineMessageEvent('今日も頑張りましょう');
      routeEvent(event);

      expect(mockGetRecentConversationForUser).toHaveBeenCalledWith(
        'test_user_id',
        7,
        24,
      );
      expect(mockGenerateChatWithHistory).toHaveBeenCalledWith(
        expect.any(String), // SHARED_SYSTEM_MESSAGE
        mockHistory,
        '今日も頑張りましょう',
        200,
        0.3,
      );
      expect(mockReplyMessage).toHaveBeenCalledWith(
        'test_reply_token',
        'AIからのテスト応答',
      );
      expect(mockWriteLog).toHaveBeenCalledWith({
        timestamp: expect.any(String),
        userId: 'test_user_id',
        message: '今日も頑張りましょう',
        response: 'AIからのテスト応答',
      });
    });

    it('会話履歴取得に失敗した場合、通常プロンプトにフォールバックすべき', () => {
      mockGetRecentConversationForUser.mockImplementation(() => {
        throw new Error('履歴取得エラー');
      });
      const consoleWarnSpy = jest.spyOn(console, 'warn');

      const event = createLineMessageEvent('今日はいい天気ですね');
      routeEvent(event);

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[Router] 会話履歴の取得に失敗しました:',
        expect.objectContaining({ message: '履歴取得エラー' }),
      );
      expect(mockGenerateChatWithHistory).toHaveBeenCalledWith(
        expect.any(String), // SHARED_SYSTEM_MESSAGE
        [],
        '今日はいい天気ですね',
        200,
        0.3,
      );

      consoleWarnSpy.mockRestore();
    });

    it('履歴取得関数が存在しない場合、通常プロンプトを使用すべき', () => {
      // getRecentConversationForUserが未定義の場合をシミュレート
      jest.doMock('../src/services/sheet', () => ({
        ...jest.requireActual('../src/services/sheet'),
        getRecentConversationForUser: undefined,
      }));

      const event = createLineMessageEvent('テストメッセージ');
      routeEvent(event);

      expect(mockGenerateChatWithHistory).toHaveBeenCalledWith(
        expect.any(String), // SHARED_SYSTEM_MESSAGE
        [],
        'テストメッセージ',
        200,
        0.3,
      );
    });

    it('配列でない履歴が返された場合、通常プロンプトを使用すべき', () => {
      mockGetRecentConversationForUser.mockReturnValue('invalid_history');

      const event = createLineMessageEvent('テスト');
      routeEvent(event);

      expect(mockGenerateChatWithHistory).toHaveBeenCalledWith(
        expect.any(String), // SHARED_SYSTEM_MESSAGE
        [],
        'テスト',
        200,
        0.3,
      );
    });

    it('雑談処理エラー時は適切なエラーメッセージを返すべき', () => {
      mockGenerateChatWithHistory.mockImplementation(() => {
        throw new Error('OpenAI API エラー');
      });
      const consoleErrorSpy = jest.spyOn(console, 'error');

      const event = createLineMessageEvent('元気ですか？');
      routeEvent(event);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[Router] 雑談処理エラー: Error: OpenAI API エラー',
      );
      expect(mockReplyMessage).toHaveBeenCalledWith(
        'test_reply_token',
        '申し訳ありません、雑談応答中にエラーが発生しました。',
      );
      expect(mockWriteLog).not.toHaveBeenCalled(); // エラー時はログ記録しない

      consoleErrorSpy.mockRestore();
    });

    it('会話ログのタイムスタンプがISO形式で記録されるべき', () => {
      const event = createLineMessageEvent('テストメッセージ');
      routeEvent(event);

      expect(mockWriteLog).toHaveBeenCalledWith({
        timestamp: expect.stringMatching(
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
        ),
        userId: 'test_user_id',
        message: 'テストメッセージ',
        response: 'AIからのテスト応答',
      });
    });

    it('長い履歴でも正しく処理すべき', () => {
      const longHistory = Array.from({ length: 20 }, (_, i) => {
        const role = i % 2 === 0 ? 'user' : 'assistant';
        return {
          role: role as 'user' | 'assistant',
          content: `メッセージ${i + 1}`,
        };
      });
      mockGetRecentConversationForUser.mockReturnValue(longHistory);

      const event = createLineMessageEvent('続きの会話');
      routeEvent(event);

      expect(mockGenerateChatWithHistory).toHaveBeenCalledWith(
        expect.any(String), // SHARED_SYSTEM_MESSAGE
        longHistory,
        '続きの会話',
        200,
        0.3,
      );
    });
  });

  describe('日付指定RSVP機能', () => {
    beforeEach(() => {
      // 直近イベントをモック
      const mockEvents = [
        {
          開催日: '2025/9/15',
          イベント名: 'テストイベント',
          kintoneRecordId: '123',
        },
      ];
      mockGetUpcomingEvents.mockReturnValue(mockEvents);
    });

    it('「9/15(月) 参加します」で日付指定RSVP処理が動作すべき', () => {
      mockRecordRSVPInEvent.mockReturnValue('added');

      const event = createLineMessageEvent('9/15(月) 参加します');
      routeEvent(event);

      expect(mockRecordRSVPInEvent).toHaveBeenCalledWith(
        '123', // recordId
        'test_user_id', // userId
        'yes', // status
        'text', // source
      );
      expect(mockReplyMessage).toHaveBeenCalledWith(
        event.replyToken,
        expect.stringContaining(
          '✅ 9/15(火)「テストイベント」への参加を承りました！',
        ),
      );
    });

    it('「9/15(月) 不参加」で日付指定RSVP処理が動作すべき', () => {
      mockRecordRSVPInEvent.mockReturnValue('removed');

      const event = createLineMessageEvent('9/15(月) 不参加');
      routeEvent(event);

      expect(mockRecordRSVPInEvent).toHaveBeenCalledWith(
        '123',
        'test_user_id',
        'no',
        'text',
      );
      expect(mockReplyMessage).toHaveBeenCalledWith(
        event.replyToken,
        expect.stringContaining(
          '📝 9/15(火)「テストイベント」への不参加を承りました。',
        ),
      );
    });

    it('「9/15 参加します」（曜日なし）でも動作すべき', () => {
      mockRecordRSVPInEvent.mockReturnValue('added');

      const event = createLineMessageEvent('9/15 参加します');
      routeEvent(event);

      expect(mockRecordRSVPInEvent).toHaveBeenCalledWith(
        '123',
        'test_user_id',
        'yes',
        'text',
      );
    });

    it('存在しない日付を指定した場合、適切なエラーメッセージを返すべき', () => {
      mockGetUpcomingEvents.mockReturnValue([]); // イベントなし

      const event = createLineMessageEvent('12/25(木) 参加します');
      routeEvent(event);

      expect(mockReplyMessage).toHaveBeenCalledWith(
        event.replyToken,
        expect.stringContaining('12/25(木)のイベントが見つかりませんでした'),
      );
    });

    it('RSVP処理でエラーが発生した場合、適切なエラーメッセージを返すべき', () => {
      mockRecordRSVPInEvent.mockReturnValue('already_registered');

      const event = createLineMessageEvent('9/15(月) 参加します');
      routeEvent(event);

      expect(mockReplyMessage).toHaveBeenCalledWith(
        event.replyToken,
        expect.stringContaining(
          '📌 9/15(火)「テストイベント」にはすでに参加登録済みです',
        ),
      );
    });
  });
});
