/**
 * OpenAI API クライアントのテスト
 */

import {
  getEmbedding,
  generateAnswer,
  createFaqPrompt,
  createChatPrompt,
  createChatPromptWithHistory,
} from '../src/services/openai';
import { getConfig } from '../src/utils/env';

// 依存モジュールをモック化
jest.mock('../src/utils/env');

describe('openai.ts', () => {
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
      OPENAI_API_KEY: 'test_api_key',
    });

    mockUrlFetchApp.fetch.mockReturnValue(mockResponse as any);
  });

  describe('getEmbedding', () => {
    it('正常なレスポンスの場合、embeddingベクトルを返すべき', () => {
      const mockEmbeddingResponse = {
        data: [
          {
            embedding: [0.1, 0.2, 0.3, 0.4],
            index: 0,
          },
        ],
        model: 'text-embedding-3-small',
        usage: {
          prompt_tokens: 10,
          total_tokens: 10,
        },
      };

      mockResponse.getResponseCode.mockReturnValue(200);
      mockResponse.getContentText.mockReturnValue(
        JSON.stringify(mockEmbeddingResponse),
      );

      const result = getEmbedding('テストテキスト');

      expect(result).toEqual([0.1, 0.2, 0.3, 0.4]);
      expect(mockUrlFetchApp.fetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/embeddings',
        expect.objectContaining({
          method: 'post',
          headers: expect.objectContaining({
            Authorization: 'Bearer test_api_key',
            'Content-Type': 'application/json',
          }),
          payload: JSON.stringify({
            input: 'テストテキスト',
            model: 'text-embedding-3-small',
          }),
        }),
      );
    });

    it('APIエラーの場合、nullを返すべき', () => {
      mockResponse.getResponseCode.mockReturnValue(400);
      mockResponse.getContentText.mockReturnValue('{"error": "Bad Request"}');

      const result = getEmbedding('テストテキスト');

      expect(result).toBeNull();
    });

    it('空のレスポンスの場合、nullを返すべき', () => {
      mockResponse.getResponseCode.mockReturnValue(200);
      mockResponse.getContentText.mockReturnValue(JSON.stringify({ data: [] }));

      const result = getEmbedding('テストテキスト');

      expect(result).toBeNull();
    });

    it('ネットワークエラーの場合、nullを返すべき', () => {
      mockUrlFetchApp.fetch.mockImplementation(() => {
        throw new Error('Network error');
      });

      const result = getEmbedding('テストテキスト');

      expect(result).toBeNull();
    });
  });

  describe('generateAnswer', () => {
    it('正常なレスポンスの場合、生成された回答を返すべき', () => {
      const mockChatResponse = {
        choices: [
          {
            message: {
              content: 'これは生成された回答です。',
              role: 'assistant',
            },
            finish_reason: 'stop',
            index: 0,
          },
        ],
        usage: {
          prompt_tokens: 20,
          completion_tokens: 15,
          total_tokens: 35,
        },
      };

      mockResponse.getResponseCode.mockReturnValue(200);
      mockResponse.getContentText.mockReturnValue(
        JSON.stringify(mockChatResponse),
      );

      const result = generateAnswer('テストプロンプト', 100);

      expect(result).toBe('これは生成された回答です。');
      expect(mockUrlFetchApp.fetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/chat/completions',
        expect.objectContaining({
          method: 'post',
          headers: expect.objectContaining({
            Authorization: 'Bearer test_api_key',
            'Content-Type': 'application/json',
          }),
          payload: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: 'テストプロンプト' }],
            max_tokens: 100,
            temperature: 0.7,
          }),
        }),
      );
    });

    it('デフォルトのmax_tokensが使用されるべき', () => {
      const mockChatResponse = {
        choices: [
          {
            message: { content: 'テスト回答', role: 'assistant' },
            finish_reason: 'stop',
            index: 0,
          },
        ],
        usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 },
      };

      mockResponse.getResponseCode.mockReturnValue(200);
      mockResponse.getContentText.mockReturnValue(
        JSON.stringify(mockChatResponse),
      );

      generateAnswer('テストプロンプト'); // max_tokensを指定しない

      expect(mockUrlFetchApp.fetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/chat/completions',
        expect.objectContaining({
          method: 'post',
          headers: {
            Authorization: 'Bearer test_api_key',
            'Content-Type': 'application/json',
          },
          payload: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: 'テストプロンプト' }],
            max_tokens: 200,
            temperature: 0.7,
          }),
        }),
      );
    });

    it('APIエラーの場合、エラーメッセージを返すべき', () => {
      mockResponse.getResponseCode.mockReturnValue(429);
      mockResponse.getContentText.mockReturnValue(
        '{"error": "Rate limit exceeded"}',
      );

      const result = generateAnswer('テストプロンプト');

      expect(result).toBe('申し訳ありません、AIの応答を取得できませんでした。');
    });

    it('空のレスポンスの場合、エラーメッセージを返すべき', () => {
      mockResponse.getResponseCode.mockReturnValue(200);
      mockResponse.getContentText.mockReturnValue(
        JSON.stringify({ choices: [] }),
      );

      const result = generateAnswer('テストプロンプト');

      expect(result).toBe('申し訳ありません、AIの応答を取得できませんでした。');
    });

    it('ネットワークエラーの場合、エラーメッセージを返すべき', () => {
      mockUrlFetchApp.fetch.mockImplementation(() => {
        throw new Error('Network timeout');
      });

      const result = generateAnswer('テストプロンプト');

      expect(result).toBe('申し訳ありません、AIの応答を取得できませんでした。');
    });
  });

  describe('createFaqPrompt', () => {
    it('FAQ用のプロンプトを正しく生成すべき', () => {
      const userQuestion = 'ボランティアの時間は？';
      const faqQuestion = '活動時間について';
      const faqAnswer = '毎週土曜日10:00-12:00です';

      const result = createFaqPrompt(userQuestion, faqQuestion, faqAnswer);

      expect(result).toContain('活動団体のスタッフです');
      expect(result).toContain('活動時間について');
      expect(result).toContain('毎週土曜日10:00-12:00です');
      expect(result).toContain('ボランティアの時間は？');
      expect(result).toContain('親しみやすい口調');
    });

    it('特殊文字を含む入力でも正しく処理すべき', () => {
      const userQuestion = 'テスト"質問"です';
      const faqQuestion = "FAQ'質問'";
      const faqAnswer = 'テスト\n回答です';

      const result = createFaqPrompt(userQuestion, faqQuestion, faqAnswer);

      expect(result).toContain('テスト"質問"です');
      expect(result).toContain("FAQ'質問'");
      expect(result).toContain('テスト\n回答です');
    });
  });

  describe('createChatPrompt', () => {
    it('雑談用のプロンプトを正しく生成すべき', () => {
      const userMessage = '今日は良い天気ですね';

      const result = createChatPrompt(userMessage);

      expect(result).toContain('活動団体のスタッフです');
      expect(result).toContain('今日は良い天気ですね');
      expect(result).toContain('共感的で温かい返答');
      expect(result).toContain('活動に参加していることを応援');
    });

    it('長いメッセージでも正しく処理すべき', () => {
      const longMessage = 'これは非常に長いメッセージです。'.repeat(10);

      const result = createChatPrompt(longMessage);

      expect(result).toContain(longMessage);
      expect(result).toContain('活動団体のスタッフです');
    });
  });

  describe('createChatPromptWithHistory', () => {
    it('会話履歴付きのプロンプトを正しく生成すべき', () => {
      const history = [
        { role: 'user' as const, content: '元気ですか？' },
        {
          role: 'assistant' as const,
          content: '元気です！ありがとうございます。',
        },
        { role: 'user' as const, content: '今日は暖かいですね' },
        {
          role: 'assistant' as const,
          content: 'そうですね、過ごしやすい日です。',
        },
      ];
      const userMessage = 'ボランティア活動も楽しそうです';

      const result = createChatPromptWithHistory(history, userMessage);

      expect(result).toContain('活動団体のスタッフです');
      expect(result).toContain('会話の文脈を踏まえて');
      expect(result).toContain('これまでの会話（古い→新しい）');
      expect(result).toContain('ユーザー: 元気ですか？');
      expect(result).toContain('あなた: 元気です！ありがとうございます。');
      expect(result).toContain('ユーザー: 今日は暖かいですね');
      expect(result).toContain('あなた: そうですね、過ごしやすい日です。');
      expect(result).toContain('今回のユーザーからのメッセージ');
      expect(result).toContain('ボランティア活動も楽しそうです');
      expect(result).toContain('相手を励ます一言');
    });

    it('空の履歴でも正しく処理すべき', () => {
      const history: Array<{ role: 'user' | 'assistant'; content: string }> =
        [];
      const userMessage = 'こんにちは';

      const result = createChatPromptWithHistory(history, userMessage);

      expect(result).toContain('活動団体のスタッフです');
      expect(result).toContain('会話の文脈を踏まえて');
      expect(result).toContain('今回のユーザーからのメッセージ');
      expect(result).toContain('こんにちは');
      expect(result).not.toContain('これまでの会話');
    });

    it('履歴が1件のみでも正しく処理すべき', () => {
      const history = [{ role: 'user' as const, content: '最初のメッセージ' }];
      const userMessage = '2回目のメッセージです';

      const result = createChatPromptWithHistory(history, userMessage);

      expect(result).toContain('これまでの会話（古い→新しい）');
      expect(result).toContain('ユーザー: 最初のメッセージ');
      expect(result).toContain('今回のユーザーからのメッセージ');
      expect(result).toContain('2回目のメッセージです');
    });

    it('特殊文字を含む履歴でも正しく処理すべき', () => {
      const history = [
        { role: 'user' as const, content: 'テスト"メッセージ"です' },
        { role: 'assistant' as const, content: "回答'テスト'です\n改行あり" },
      ];
      const userMessage = '特殊文字&テスト<>';

      const result = createChatPromptWithHistory(history, userMessage);

      expect(result).toContain('テスト"メッセージ"です');
      expect(result).toContain("回答'テスト'です\n改行あり");
      expect(result).toContain('特殊文字&テスト<>');
    });

    it('長い履歴でも正しく処理すべき', () => {
      const history = Array.from({ length: 10 }, (_, i) => {
        const role = i % 2 === 0 ? 'user' : 'assistant';
        return {
          role: role as 'user' | 'assistant',
          content: `メッセージ${i + 1}`,
        };
      });
      const userMessage = '最新のメッセージ';

      const result = createChatPromptWithHistory(history, userMessage);

      expect(result).toContain('これまでの会話（古い→新しい）');
      expect(result).toContain('ユーザー: メッセージ1');
      expect(result).toContain('あなた: メッセージ10');
      expect(result).toContain('最新のメッセージ');
    });

    it('nullやundefinedな履歴に対してフォールバック処理すべき', () => {
      const result1 = createChatPromptWithHistory(
        null as any,
        'テストメッセージ',
      );
      const result2 = createChatPromptWithHistory(
        undefined as any,
        'テストメッセージ',
      );

      expect(result1).toContain('テストメッセージ');
      expect(result1).not.toContain('これまでの会話');

      expect(result2).toContain('テストメッセージ');
      expect(result2).not.toContain('これまでの会話');
    });
  });
});
