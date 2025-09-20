// __tests__/e2e.test.ts
import { routeEvent } from '../src/router';
import * as env from '../src/utils/env';
import * as line from '../src/services/line';
import * as openai from '../src/services/openai';
import * as sheet from '../src/services/sheet';
import { LineEvent } from '../src/types';

// --- モック設定 ---
jest.mock('../src/services/line');
jest.mock('../src/services/openai');
jest.mock('../src/services/sheet');
jest.mock('../src/utils/env');

const mockGetConfig = env.getConfig as jest.Mock;
const mockReply = line.replyMessage as jest.Mock;
const mockPush = line.pushMessage as jest.Mock;
const mockGen = openai.generateAnswer as jest.Mock;
const mockGenerateChatWithHistory = openai.generateChatWithHistory as jest.Mock;
const mockGetEventsForDate = sheet.getEventsForDate as jest.Mock;
const mockRecordRSVP = sheet.recordRSVPInEvent as jest.Mock;
const mockWriteLog = sheet.writeLog as jest.Mock;

// --- ヘルパ ---
const createTextEvent = (text: string): LineEvent => ({
  type: 'message',
  replyToken: 'rtok',
  source: { userId: 'U_test', type: 'user' },
  timestamp: Date.now(),
  message: { id: 'mid', type: 'text', text },
});

const createPostbackEvent = (data: string): LineEvent => ({
  type: 'postback',
  replyToken: 'rtok',
  source: { userId: 'U_test', type: 'user' },
  timestamp: Date.now(),
  postback: { data },
});

beforeEach(() => {
  jest.clearAllMocks();
  mockGetConfig.mockReturnValue({
    CHANNEL_ACCESS_TOKEN: 'x',
    OPENAI_API_KEY: 'x',
    SPREADSHEET_ID: 'sheet',
    SIMILARITY_THRESHOLD: 0.75,
    // CSV/配列どちらでも通るよう内部で正規化される想定
    STAFF_USER_ID: 'U_staff1,U_staff2',
  });

  // 既定のOpenAI応答（FAQ/雑談ともに固定でOK）
  mockGen.mockReturnValue('AIからの応答');
  mockGenerateChatWithHistory.mockReturnValue('AIからの履歴付き応答');

  // 翌日1件イベントがある体で固定
  mockGetEventsForDate.mockReturnValue([
    { kintoneRecordId: 'E001', name: '公園清掃', date: '2025/09/07' },
  ]);

  mockRecordRSVP.mockResolvedValue?.('added'); // async 実装なら
  if (!mockRecordRSVP.mockResolvedValue)
    mockRecordRSVP.mockReturnValue('added');
});

describe('E2E-ish flows', () => {
  test('スポットワーカー: 参加→不参加（Participation追記）', async () => {
    // 1) 質問
    await routeEvent(createTextEvent('集合は何時どこ？'));
    expect(mockReply).toHaveBeenCalled(); // 何か答えていればOK（FAQ or 雑談）

    // 2) 参加
    mockRecordRSVP.mockReturnValueOnce('added');
    await routeEvent(createTextEvent('参加する'));
    expect(mockRecordRSVP).toHaveBeenCalledWith(
      'E001',
      'U_test',
      'yes',
      'text',
    );
    expect(mockReply).toHaveBeenCalledWith(
      'rtok',
      expect.stringMatching(/ありがとうございます|参加/),
    );

    // 3) 不参加
    mockRecordRSVP.mockReturnValueOnce('removed');
    await routeEvent(createTextEvent('不参加'));
    expect(mockRecordRSVP).toHaveBeenCalledWith('E001', 'U_test', 'no', 'text');
    expect(mockReply).toHaveBeenCalledWith(
      'rtok',
      expect.stringMatching(/承知|お大事|また/),
    );
  });

  test('アラート検知→スタッフ複数宛にpush', async () => {
    await routeEvent(createTextEvent('もうやめたい気分'));
    expect(mockReply).toHaveBeenCalledWith(
      'rtok',
      expect.stringContaining('スタッフが確認いたします'),
    );
    // pushが複数回（スタッフ人数分）呼ばれていること
    expect(mockPush.mock.calls.length).toBeGreaterThanOrEqual(2);
    const texts = mockPush.mock.calls.map((c) => c[1] as string);
    expect(texts.every((t) => t.includes('【緊急通知】'))).toBe(true);
  });

  test('FAQ未一致→雑談フォールバック', async () => {
    // FAQ側が「閾値未満」を返した、という状況を模す
    // 既存コードでフォールバックはhandlers/faq内→generateChatWithHistoryに切替のはず
    // ここでは「雑談プロンプト経由でgenerateChatWithHistoryが呼ばれた」ことを確認する
    await routeEvent(createTextEvent('あの、その、えっと…'));
    expect(mockGenerateChatWithHistory).toHaveBeenCalled(); // 新しい実装を確認
    expect(mockWriteLog).toHaveBeenCalled(); // kind=fallback 等の拡張があればここで確認
  });

  test('postback RSVP: rsvp:yes:E001', async () => {
    mockRecordRSVP.mockReturnValueOnce('added');
    await routeEvent(createPostbackEvent('rsvp:yes:E001'));
    expect(mockRecordRSVP).toHaveBeenCalledWith(
      'E001',
      'U_test',
      'yes',
      'postback',
    );
    expect(mockReply).toHaveBeenCalled();
  });
});
