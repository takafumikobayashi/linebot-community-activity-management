/**
 * LINE API クライアントのテスト
 */

import {
  replyMessage,
  pushMessage,
  pushMessageWithImage,
  replyWithQuickReply,
  pushConfirmParticipation,
  pushConfirmParticipationWithImage,
  multicastMessages,
} from '../src/services/line';
import { getConfig } from '../src/utils/env';

// 依存モジュールをモック化
jest.mock('../src/utils/env');

describe('line.ts', () => {
  const mockGetConfig = getConfig as jest.Mock;
  const mockUrlFetchApp = global.UrlFetchApp as jest.Mocked<
    typeof global.UrlFetchApp
  >;
  const mockResponse = {
    getResponseCode: jest.fn(),
    getContentText: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockGetConfig.mockReturnValue({
      CHANNEL_ACCESS_TOKEN: 'test_channel_access_token',
    });

    mockUrlFetchApp.fetch.mockReturnValue(mockResponse as any);
  });

  describe('replyMessage', () => {
    it('正常なレスポンスの場合、成功ログを出力すべき', () => {
      mockResponse.getResponseCode.mockReturnValue(200);
      const consoleSpy = jest.spyOn(console, 'log');

      replyMessage('test_reply_token', 'テストメッセージ');

      expect(mockUrlFetchApp.fetch).toHaveBeenCalledWith(
        'https://api.line.me/v2/bot/message/reply',
        expect.objectContaining({
          method: 'post',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer test_channel_access_token',
          },
          payload: JSON.stringify({
            replyToken: 'test_reply_token',
            messages: [
              {
                type: 'text',
                text: 'テストメッセージ',
              },
            ],
          }),
        }),
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[LINE] メッセージ送信成功'),
      );
      consoleSpy.mockRestore();
    });

    it('APIエラーの場合、エラーログを出力すべき', () => {
      mockResponse.getResponseCode.mockReturnValue(400);
      mockResponse.getContentText.mockReturnValue('{"message": "Bad Request"}');
      const consoleErrorSpy = jest.spyOn(console, 'error');

      replyMessage('invalid_token', 'テストメッセージ');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[LINE] メッセージ送信失敗: 400'),
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[LINE] レスポンス: {"message": "Bad Request"}',
      );
      consoleErrorSpy.mockRestore();
    });

    it('ネットワークエラーの場合、エラーをスローすべき', () => {
      const networkError = new Error('Network timeout');
      mockUrlFetchApp.fetch.mockImplementation(() => {
        throw networkError;
      });
      const consoleErrorSpy = jest.spyOn(console, 'error');

      expect(() => {
        replyMessage('test_token', 'テストメッセージ');
      }).toThrow('Network timeout');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[LINE] メッセージ送信エラー:',
        networkError,
      );
      consoleErrorSpy.mockRestore();
    });

    it('長いメッセージでもログは短縮表示すべき', () => {
      mockResponse.getResponseCode.mockReturnValue(200);
      const consoleSpy = jest.spyOn(console, 'log');
      const longMessage = 'あ'.repeat(100);

      replyMessage('test_token', longMessage);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('あ'.repeat(50) + '...'),
      );
      consoleSpy.mockRestore();
    });
  });

  describe('pushMessage', () => {
    it('正常なレスポンスの場合、成功ログを出力すべき', () => {
      mockResponse.getResponseCode.mockReturnValue(200);
      const consoleSpy = jest.spyOn(console, 'log');

      pushMessage('test_user_id', 'プッシュメッセージ');

      expect(mockUrlFetchApp.fetch).toHaveBeenCalledWith(
        'https://api.line.me/v2/bot/message/push',
        expect.objectContaining({
          method: 'post',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer test_channel_access_token',
          },
          payload: JSON.stringify({
            to: 'test_user_id',
            messages: [
              {
                type: 'text',
                text: 'プッシュメッセージ',
              },
            ],
          }),
        }),
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          '[LINE] プッシュメッセージ送信成功: test_user_id',
        ),
      );
      consoleSpy.mockRestore();
    });

    it('APIエラーの場合、エラーログを出力すべき', () => {
      mockResponse.getResponseCode.mockReturnValue(403);
      mockResponse.getContentText.mockReturnValue('{"message": "Forbidden"}');
      const consoleErrorSpy = jest.spyOn(console, 'error');

      pushMessage('invalid_user_id', 'プッシュメッセージ');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[LINE] プッシュメッセージ送信失敗: 403'),
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[LINE] レスポンス: {"message": "Forbidden"}',
      );
      consoleErrorSpy.mockRestore();
    });

    it('ネットワークエラーの場合、エラーをスローすべき', () => {
      const networkError = new Error('Connection refused');
      mockUrlFetchApp.fetch.mockImplementation(() => {
        throw networkError;
      });
      const consoleErrorSpy = jest.spyOn(console, 'error');

      expect(() => {
        pushMessage('test_user_id', 'プッシュメッセージ');
      }).toThrow('Connection refused');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[LINE] プッシュメッセージ送信エラー:',
        networkError,
      );
      consoleErrorSpy.mockRestore();
    });
  });

  describe('replyWithQuickReply', () => {
    it('Quick Replyボタン付きメッセージを正しく送信すべき', () => {
      mockResponse.getResponseCode.mockReturnValue(200);
      const consoleSpy = jest.spyOn(console, 'log');

      const buttons = [
        { label: '参加する', text: '参加します' },
        { label: '不参加', text: '不参加です' },
      ];

      replyWithQuickReply('test_reply_token', '参加確認', buttons);

      expect(mockUrlFetchApp.fetch).toHaveBeenCalledWith(
        'https://api.line.me/v2/bot/message/reply',
        expect.objectContaining({
          method: 'post',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer test_channel_access_token',
          },
          payload: JSON.stringify({
            replyToken: 'test_reply_token',
            messages: [
              {
                type: 'text',
                text: '参加確認',
                quickReply: {
                  items: [
                    {
                      type: 'action',
                      action: {
                        type: 'message',
                        label: '参加する',
                        text: '参加します',
                      },
                    },
                    {
                      type: 'action',
                      action: {
                        type: 'message',
                        label: '不参加',
                        text: '不参加です',
                      },
                    },
                  ],
                },
              },
            ],
          }),
        }),
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[LINE] Quick Replyメッセージ送信成功'),
      );
      consoleSpy.mockRestore();
    });

    it('空のボタン配列でも正しく処理すべき', () => {
      mockResponse.getResponseCode.mockReturnValue(200);

      replyWithQuickReply('test_reply_token', 'テキストのみ', []);

      expect(mockUrlFetchApp.fetch).toHaveBeenCalledWith(
        'https://api.line.me/v2/bot/message/reply',
        expect.objectContaining({
          method: 'post',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer test_channel_access_token',
          },
          payload: JSON.stringify({
            replyToken: 'test_reply_token',
            messages: [
              {
                type: 'text',
                text: 'テキストのみ',
                quickReply: {
                  items: [],
                },
              },
            ],
          }),
        }),
      );
    });

    it('APIエラーの場合、エラーログを出力すべき', () => {
      mockResponse.getResponseCode.mockReturnValue(500);
      const consoleErrorSpy = jest.spyOn(console, 'error');

      replyWithQuickReply('test_token', 'メッセージ', []);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[LINE] Quick Replyメッセージ送信失敗: 500'),
      );
      consoleErrorSpy.mockRestore();
    });

    it('ネットワークエラーの場合、エラーログを出力すべき', () => {
      const networkError = new Error('Timeout');
      mockUrlFetchApp.fetch.mockImplementation(() => {
        throw networkError;
      });
      const consoleErrorSpy = jest.spyOn(console, 'error');

      expect(() => {
        replyWithQuickReply('test_token', 'メッセージ', []);
      }).toThrow('Timeout');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[LINE] Quick Replyメッセージ送信エラー:',
        networkError,
      );
      consoleErrorSpy.mockRestore();
    });
  });

  describe('pushConfirmParticipation', () => {
    it('参加確認Confirmテンプレートを正しく送信すべき', () => {
      mockResponse.getResponseCode.mockReturnValue(200);
      const consoleSpy = jest.spyOn(console, 'log');

      pushConfirmParticipation(
        'test_user_id',
        '明日のイベントに参加しますか？',
        '123',
      );

      expect(mockUrlFetchApp.fetch).toHaveBeenCalledWith(
        'https://api.line.me/v2/bot/message/push',
        expect.objectContaining({
          method: 'post',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer test_channel_access_token',
          },
          payload: JSON.stringify({
            to: 'test_user_id',
            messages: [
              {
                type: 'template',
                altText: '参加確認: はい／いいえ',
                template: {
                  type: 'confirm',
                  text: '明日のイベントに参加しますか？',
                  actions: [
                    {
                      type: 'postback',
                      label: '参加する',
                      data: 'rsvp:yes:123',
                    },
                    { type: 'postback', label: '不参加', data: 'rsvp:no:123' },
                  ],
                },
              },
            ],
          }),
        }),
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          '[LINE] 参加確認テンプレート送信成功: test_user_id',
        ),
      );
      consoleSpy.mockRestore();
    });

    it('APIエラーの場合、エラーログを出力すべき', () => {
      mockResponse.getResponseCode.mockReturnValue(400);
      mockResponse.getContentText.mockReturnValue(
        '{"message": "Invalid request"}',
      );
      const consoleErrorSpy = jest.spyOn(console, 'error');

      pushConfirmParticipation('test_user_id', 'テストメッセージ', '123');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[LINE] 参加確認テンプレート送信失敗: 400'),
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[LINE] レスポンス: {"message": "Invalid request"}',
      );
      consoleErrorSpy.mockRestore();
    });

    it('ネットワークエラーの場合、エラーをスローすべき', () => {
      const networkError = new Error('Network error');
      mockUrlFetchApp.fetch.mockImplementation(() => {
        throw networkError;
      });
      const consoleErrorSpy = jest.spyOn(console, 'error');

      expect(() => {
        pushConfirmParticipation('test_user_id', 'テストメッセージ', '123');
      }).toThrow('Network error');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[LINE] 参加確認テンプレート送信エラー:',
        networkError,
      );
      consoleErrorSpy.mockRestore();
    });
  });

  describe('multicastMessages', () => {
    beforeEach(() => {
      mockResponse.getResponseCode.mockReturnValue(200);
    });

    it('複数ユーザーへのマルチキャスト送信が正常に動作すべき', () => {
      const userIds = ['user1', 'user2', 'user3'];
      const messages = [
        { type: 'text', text: 'テストメッセージ' },
        { type: 'template', altText: 'テンプレート', template: {} },
      ];
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      multicastMessages(userIds, messages);

      expect(mockUrlFetchApp.fetch).toHaveBeenCalledWith(
        'https://api.line.me/v2/bot/message/multicast',
        expect.objectContaining({
          method: 'post',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer test_channel_access_token',
          },
          payload: JSON.stringify({
            to: userIds,
            messages: messages,
          }),
        }),
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        '[LINE] マルチキャストメッセージ送信成功: 3件',
      );
      consoleSpy.mockRestore();
    });

    it('150件を超える場合は150件に制限すべき', () => {
      const userIds = Array.from({ length: 200 }, (_, i) => `user${i + 1}`);
      const messages = [{ type: 'text', text: 'テスト' }];
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      multicastMessages(userIds, messages);

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[LINE] マルチキャストの宛先が150件を超えています（200件）。150件に分割して送信します。',
      );

      expect(mockUrlFetchApp.fetch).toHaveBeenCalledWith(
        'https://api.line.me/v2/bot/message/multicast',
        expect.objectContaining({
          payload: JSON.stringify({
            to: userIds.slice(0, 150),
            messages: messages,
          }),
        }),
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        '[LINE] マルチキャストメッセージ送信成功: 200件',
      );
      consoleWarnSpy.mockRestore();
      consoleSpy.mockRestore();
    });

    it('空のユーザーID配列の場合はスキップすべき', () => {
      const messages = [{ type: 'text', text: 'テスト' }];
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      multicastMessages([], messages);

      expect(mockUrlFetchApp.fetch).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(
        '[LINE] マルチキャストの宛先がいないためスキップします',
      );
      consoleSpy.mockRestore();
    });

    it('null/undefinedのユーザーID配列の場合はスキップすべき', () => {
      const messages = [{ type: 'text', text: 'テスト' }];
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      multicastMessages(null as any, messages);

      expect(mockUrlFetchApp.fetch).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(
        '[LINE] マルチキャストの宛先がいないためスキップします',
      );
      consoleSpy.mockRestore();
    });

    it('API呼び出しエラーの場合、エラーログを出力すべき', () => {
      mockResponse.getResponseCode.mockReturnValue(400);
      mockResponse.getContentText.mockReturnValue(
        '{"message": "Invalid request"}',
      );

      const userIds = ['user1', 'user2'];
      const messages = [{ type: 'text', text: 'テスト' }];
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      multicastMessages(userIds, messages);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[LINE] マルチキャストメッセージ送信失敗: 400',
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[LINE] レスポンス: {"message": "Invalid request"}',
      );
      consoleErrorSpy.mockRestore();
    });

    it('ネットワークエラーの場合、エラーをスローすべき', () => {
      const networkError = new Error('Network error');
      mockUrlFetchApp.fetch.mockImplementation(() => {
        throw networkError;
      });

      const userIds = ['user1', 'user2'];
      const messages = [{ type: 'text', text: 'テスト' }];
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      expect(() => {
        multicastMessages(userIds, messages);
      }).toThrow('Network error');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[LINE] マルチキャストメッセージ送信エラー:',
        networkError,
      );
      consoleErrorSpy.mockRestore();
    });
  });

  describe('pushMessageWithImage', () => {
    it('画像付きプッシュメッセージを正しく送信すべき', () => {
      mockResponse.getResponseCode.mockReturnValue(200);
      const consoleSpy = jest.spyOn(console, 'log');

      pushMessageWithImage(
        'test_user_id',
        'テストメッセージ',
        'https://example.com/image.jpg',
      );

      expect(mockUrlFetchApp.fetch).toHaveBeenCalledWith(
        'https://api.line.me/v2/bot/message/push',
        expect.objectContaining({
          method: 'post',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            Authorization: 'Bearer test_channel_access_token',
          }),
          payload: JSON.stringify({
            to: 'test_user_id',
            messages: [
              {
                type: 'image',
                originalContentUrl: 'https://example.com/image.jpg',
                previewImageUrl: 'https://example.com/image.jpg',
              },
              {
                type: 'text',
                text: 'テストメッセージ',
              },
            ],
          }),
        }),
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        '[LINE] プッシュメッセージ（画像付き）送信成功: test_user_id',
      );
      consoleSpy.mockRestore();
    });

    it('画像URLがない場合、テキストメッセージのみ送信すべき', () => {
      mockResponse.getResponseCode.mockReturnValue(200);
      const consoleSpy = jest.spyOn(console, 'log');

      pushMessageWithImage('test_user_id', 'テストメッセージ');

      expect(mockUrlFetchApp.fetch).toHaveBeenCalledWith(
        'https://api.line.me/v2/bot/message/push',
        expect.objectContaining({
          payload: JSON.stringify({
            to: 'test_user_id',
            messages: [
              {
                type: 'text',
                text: 'テストメッセージ',
              },
            ],
          }),
        }),
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        '[LINE] プッシュメッセージ（画像付き）送信成功: test_user_id',
      );
      consoleSpy.mockRestore();
    });
  });

  describe('pushConfirmParticipationWithImage', () => {
    it('画像付き参加確認テンプレートを正しく送信すべき', () => {
      mockResponse.getResponseCode.mockReturnValue(200);
      const consoleSpy = jest.spyOn(console, 'log');

      pushConfirmParticipationWithImage(
        'test_user_id',
        '参加確認のメッセージ',
        'event123',
        'https://example.com/event.jpg',
      );

      expect(mockUrlFetchApp.fetch).toHaveBeenCalledWith(
        'https://api.line.me/v2/bot/message/push',
        expect.objectContaining({
          method: 'post',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            Authorization: 'Bearer test_channel_access_token',
          }),
          payload: JSON.stringify({
            to: 'test_user_id',
            messages: [
              {
                type: 'image',
                originalContentUrl: 'https://example.com/event.jpg',
                previewImageUrl: 'https://example.com/event.jpg',
              },
              {
                type: 'template',
                altText: '参加確認: はい／いいえ',
                template: {
                  type: 'confirm',
                  text: '参加確認のメッセージ',
                  actions: [
                    {
                      type: 'postback',
                      label: '参加する',
                      data: 'rsvp:yes:event123',
                    },
                    {
                      type: 'postback',
                      label: '不参加',
                      data: 'rsvp:no:event123',
                    },
                  ],
                },
              },
            ],
          }),
        }),
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        '[LINE] 参加確認テンプレート（画像付き）送信成功: test_user_id',
      );
      consoleSpy.mockRestore();
    });

    it('画像URLがない場合、Confirmテンプレートのみ送信すべき', () => {
      mockResponse.getResponseCode.mockReturnValue(200);

      pushConfirmParticipationWithImage(
        'test_user_id',
        '参加確認のメッセージ',
        'event123',
      );

      expect(mockUrlFetchApp.fetch).toHaveBeenCalledWith(
        'https://api.line.me/v2/bot/message/push',
        expect.objectContaining({
          payload: JSON.stringify({
            to: 'test_user_id',
            messages: [
              {
                type: 'template',
                altText: '参加確認: はい／いいえ',
                template: {
                  type: 'confirm',
                  text: '参加確認のメッセージ',
                  actions: [
                    {
                      type: 'postback',
                      label: '参加する',
                      data: 'rsvp:yes:event123',
                    },
                    {
                      type: 'postback',
                      label: '不参加',
                      data: 'rsvp:no:event123',
                    },
                  ],
                },
              },
            ],
          }),
        }),
      );
    });
  });
});
