import { routeEvent } from '../src/router';
import * as line from '../src/services/line';
import * as env from '../src/utils/env';
import { LineEvent, LineMessage } from '../src/types';

describe('E2E: 「クルハウス教えて + スケジュール」統合テスト', () => {
  const originalSpreadsheetApp = global.SpreadsheetApp;

  // 返信呼び出しを検証するためにスパイ
  let replySpy: jest.SpyInstance;

  // テスト用Eventシートモックを構築
  function setupEventSheetMock(
    events: Array<{
      開催日: string;
      開始時間?: string;
      終了時間?: string;
      イベント名?: string;
      ステータス?: string;
      kintoneRecordId?: string;
    }>,
  ) {
    const headers = [
      'kintoneRecordId',
      'ステータス',
      'イベント名',
      '開催日',
      '開始時間',
      '終了時間',
    ];
    const rows = events.map((e, i) => [
      e.kintoneRecordId ?? String(100 + i),
      e.ステータス ?? '未開催',
      e.イベント名 ?? 'テストイベント',
      e.開催日,
      e.開始時間 ?? '09:00',
      e.終了時間 ?? '12:00',
    ]);

    const mockSheet = {
      getLastRow: jest.fn(() => 1 + rows.length),
      getLastColumn: jest.fn(() => headers.length),
      getRange: jest.fn((r: number, c: number, nr: number, nc: number) => ({
        getValues: () => {
          if (r === 1 && nr === 1) return [headers.slice(0, nc)];
          if (r === 2) return rows.map((row) => row.slice(0, nc));
          return [];
        },
      })),
    } as unknown as GoogleAppsScript.Spreadsheet.Sheet;

    const mockSs = {
      getSheetByName: jest.fn((name: string) =>
        name === 'Event' ? mockSheet : null,
      ),
    } as unknown as GoogleAppsScript.Spreadsheet.Spreadsheet;

    global.SpreadsheetApp = {
      openById: jest.fn(() => mockSs),
      flush: jest.fn(),
    } as unknown as GoogleAppsScript.Spreadsheet.SpreadsheetApp;
  }

  const createLineMessageEvent = (text: string): LineEvent => ({
    type: 'message',
    replyToken: 'test_reply_token',
    source: { userId: 'test_user_id', type: 'user' },
    timestamp: Date.now(),
    message: { id: 'mid', type: 'text', text } as LineMessage,
  });

  beforeEach(() => {
    // フェイクタイマーを使用して固定時間を設定（日付境界での問題を回避）
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2025-09-15T10:00:00Z'));

    // 返信スパイ
    replySpy = jest.spyOn(line, 'replyMessage').mockImplementation(() => {});
    // 環境設定をモック（getConfigの必須項目を満たす）
    jest.spyOn(env, 'getConfig').mockReturnValue({
      CHANNEL_ACCESS_TOKEN: 'test_channel_access_token',
      OPENAI_API_KEY: 'test_openai_api_key',
      SPREADSHEET_ID: 'test_spreadsheet_id',
      SIMILARITY_THRESHOLD: 0.75,
      STAFF_USER_ID: 'U_staff_test',
      KINTONE_DOMAIN: 'test-domain',
      KINTONE_EVENT_APP_ID: '1',
      KINTONE_EVENT_API_TOKEN: 'test-token',
    } as any);
  });

  afterEach(() => {
    replySpy.mockRestore();
    global.SpreadsheetApp = originalSpreadsheetApp;
    jest.useRealTimers();
  });

  it('「クルハウス教えて + 活動日はいつですか？」でEventシートの予定を返信する', () => {
    // 今日以降の2件を用意
    const d1 = new Date();
    d1.setDate(d1.getDate() + 1);
    const d2 = new Date();
    d2.setDate(d2.getDate() + 2);
    // ISO形式（YYYY-MM-DD）で保持し、Dateのパース互換性を高める
    const date1 = d1.toISOString().slice(0, 10);
    const date2 = d2.toISOString().slice(0, 10);

    setupEventSheetMock([
      {
        開催日: date1,
        開始時間: '09:00',
        終了時間: '12:00',
        イベント名: '公園清掃',
      },
      {
        開催日: date2,
        開始時間: '14:00',
        終了時間: '16:00',
        イベント名: '施設訪問',
      },
    ]);

    const event = createLineMessageEvent(
      'クルハウス教えて 次の活動日はいつですか？',
    );
    routeEvent(event);

    expect(replySpy).toHaveBeenCalled();
    const text = (replySpy.mock.calls[0] as any[])[1] as string;
    expect(text).toContain('📅 直近の活動予定');
    expect(text).toContain('公園清掃');
    expect(text).toContain('施設訪問');
    expect(text).toContain('📝 参加希望は「参加する」と送信してくださいね！');
  });
});
