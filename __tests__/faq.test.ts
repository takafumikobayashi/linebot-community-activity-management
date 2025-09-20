/**
 * FAQ処理のテスト
 * ①FAQ自動応答の機能をテスト
 */

import { handleFaq, generateEmbeddingsForSheet } from '../src/handlers/faq';
import {
  getFaqData,
  writeLog,
  getFaqsWithoutEmbedding,
  saveEmbedding,
  getRecentConversationForUser,
} from '../src/services/sheet';
import {
  getEmbedding,
  generateAnswer,
  createFaqPrompt,
  createChatPrompt,
  createChatPromptWithHistory,
  generateChatWithHistory,
} from '../src/services/openai';
import { replyMessage } from '../src/services/line';
import { getConfig, getConversationContextConfig } from '../src/utils/env';
import {
  calculateCosineSimilarity,
  isValidVector,
} from '../src/utils/similarity';

// 依存モジュールをモック化
jest.mock('../src/services/sheet');
jest.mock('../src/services/openai');
jest.mock('../src/services/line');
jest.mock('../src/utils/env');
jest.mock('../src/utils/similarity');

describe('faq.ts', () => {
  const mockGetFaqData = getFaqData as jest.Mock;
  const mockWriteLog = writeLog as jest.Mock;
  const mockGetEmbedding = getEmbedding as jest.Mock;
  const mockGenerateAnswer = generateAnswer as jest.Mock;
  const mockCreateFaqPrompt = createFaqPrompt as jest.Mock;
  const mockCreateChatPrompt = createChatPrompt as jest.Mock;
  const mockCreateChatPromptWithHistory =
    createChatPromptWithHistory as jest.Mock;
  const mockGenerateChatWithHistory = generateChatWithHistory as jest.Mock;
  const mockReplyMessage = replyMessage as jest.Mock;
  const mockGetConfig = getConfig as jest.Mock;
  const mockGetConversationContextConfig =
    getConversationContextConfig as jest.Mock;
  const mockCalculateCosineSimilarity = calculateCosineSimilarity as jest.Mock;
  const mockIsValidVector = jest.mocked(isValidVector);
  const mockGetFaqsWithoutEmbedding = getFaqsWithoutEmbedding as jest.Mock;
  const mockSaveEmbedding = saveEmbedding as jest.Mock;
  const mockGetRecentConversationForUser =
    getRecentConversationForUser as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    // デフォルトのモック設定
    mockGetConfig.mockReturnValue({
      SIMILARITY_THRESHOLD: 0.75,
      SPREADSHEET_ID: 'test_id',
    });

    // 会話コンテキスト設定のデフォルト
    mockGetConversationContextConfig.mockReturnValue({
      maxConversationPairs: 7,
      maxContextHours: 24,
    });

    mockGetFaqData.mockReturnValue([
      {
        question: '活動日はいつですか？',
        answer: '毎週土曜日の午前10時からです。',
        embedding: [0.1, 0.2, 0.3],
      },
      {
        question: '持ち物は何ですか？',
        answer: 'エプロンとタオルをお持ちください。',
        embedding: [0.4, 0.5, 0.6],
      },
    ]);

    mockGetEmbedding.mockReturnValue([0.15, 0.25, 0.35]);
    mockCalculateCosineSimilarity.mockReturnValue(0.8);
    mockCreateFaqPrompt.mockReturnValue('テストプロンプト');
    mockCreateChatPrompt.mockReturnValue('雑談用プロンプト');
    mockCreateChatPromptWithHistory.mockReturnValue('履歴付き雑談用プロンプト');
    mockGenerateAnswer.mockReturnValue('GPTからの回答');
    mockGenerateChatWithHistory.mockReturnValue('GPTからの回答');
    mockGetRecentConversationForUser.mockReturnValue([]);
    mockIsValidVector.mockReturnValue(true);
  });

  describe('handleFaq', () => {
    const testReplyToken = 'test_reply_token';
    const testUserId = 'test_user_id';

    it('類似度が閾値を超える場合、GPTで回答生成して返信すべき', () => {
      const userQuestion = '活動は何時からですか？';

      handleFaq(testReplyToken, userQuestion, testUserId);

      expect(mockGetFaqData).toHaveBeenCalled();
      expect(mockGetEmbedding).toHaveBeenCalledWith(userQuestion);
      expect(mockIsValidVector).toHaveBeenCalled();
      expect(mockCalculateCosineSimilarity).toHaveBeenCalled();
      expect(mockCreateFaqPrompt).toHaveBeenCalledWith(
        userQuestion,
        '活動日はいつですか？',
        '毎週土曜日の午前10時からです。',
      );
      expect(mockGenerateAnswer).toHaveBeenCalledWith('テストプロンプト');
      expect(mockReplyMessage).toHaveBeenCalledWith(
        testReplyToken,
        'GPTからの回答',
      );

      expect(mockWriteLog).toHaveBeenCalledWith({
        timestamp: expect.any(String),
        userId: testUserId,
        message: userQuestion,
        response: 'GPTからの回答',
        similarity: 0.8,
      });
    });

    it('類似度が閾値を下回る場合、雑談応答にフォールバックすべき', () => {
      mockCalculateCosineSimilarity.mockReturnValue(0.5); // 閾値0.75を下回る

      const userQuestion = '全然関係ない質問';

      handleFaq(testReplyToken, userQuestion, testUserId);

      expect(mockGetRecentConversationForUser).toHaveBeenCalledWith(
        testUserId,
        7,
        24,
      );
      expect(mockGenerateChatWithHistory).toHaveBeenCalledWith(
        expect.any(String), // KURUHOUSE_SYSTEM_MESSAGE
        [],
        userQuestion,
        200,
        0.3,
      );
      expect(mockReplyMessage).toHaveBeenCalledWith(
        testReplyToken,
        'GPTからの回答',
      );

      expect(mockWriteLog).toHaveBeenCalledWith({
        timestamp: expect.any(String),
        userId: testUserId,
        message: userQuestion,
        response: 'GPTからの回答',
        similarity: 0.5,
      });
    });

    it('FAQデータが空の場合、雑談応答にフォールバックすべき', () => {
      mockGetFaqData.mockReturnValue([]);

      const userQuestion = 'テスト質問';

      handleFaq(testReplyToken, userQuestion, testUserId);

      expect(mockGetEmbedding).not.toHaveBeenCalled();
      expect(mockGetRecentConversationForUser).toHaveBeenCalledWith(
        testUserId,
        7,
        24,
      );
      expect(mockGenerateChatWithHistory).toHaveBeenCalledWith(
        expect.any(String), // KURUHOUSE_SYSTEM_MESSAGE
        [],
        userQuestion,
        200,
        0.3,
      );
      expect(mockReplyMessage).toHaveBeenCalledWith(
        testReplyToken,
        'GPTからの回答',
      );
    });

    it('Embedding取得に失敗した場合、雑談応答にフォールバックすべき', () => {
      mockGetEmbedding.mockReturnValue(null);

      const userQuestion = 'テスト質問';

      handleFaq(testReplyToken, userQuestion, testUserId);

      expect(mockGetRecentConversationForUser).toHaveBeenCalledWith(
        testUserId,
        7,
        24,
      );
      expect(mockGenerateChatWithHistory).toHaveBeenCalledWith(
        expect.any(String), // KURUHOUSE_SYSTEM_MESSAGE
        [],
        userQuestion,
        200,
        0.3,
      );
      expect(mockReplyMessage).toHaveBeenCalledWith(
        testReplyToken,
        'GPTからの回答',
      );
    });

    it('会話履歴がある場合、履歴付きプロンプトでフォールバックすべき', () => {
      mockCalculateCosineSimilarity.mockReturnValue(0.5); // 閾値を下回る
      const mockHistory = [
        { role: 'user' as const, content: '前の質問' },
        { role: 'assistant' as const, content: '前の回答' },
      ];
      mockGetRecentConversationForUser.mockReturnValue(mockHistory);

      const userQuestion = '今回の質問';

      handleFaq(testReplyToken, userQuestion, testUserId);

      expect(mockGetRecentConversationForUser).toHaveBeenCalledWith(
        testUserId,
        7,
        24,
      );
      expect(mockGenerateChatWithHistory).toHaveBeenCalledWith(
        expect.any(String), // KURUHOUSE_SYSTEM_MESSAGE
        mockHistory,
        userQuestion,
        200,
        0.3,
      );
      expect(mockReplyMessage).toHaveBeenCalledWith(
        testReplyToken,
        'GPTからの回答',
      );
    });

    it('処理中にエラーが発生した場合、エラーメッセージを返信すべき', () => {
      // handleFaq自体でエラーが発生する場合をテスト
      mockGetConfig.mockImplementation(() => {
        throw new Error('設定エラー');
      });

      const userQuestion = 'テスト質問';

      handleFaq(testReplyToken, userQuestion, testUserId);

      expect(mockReplyMessage).toHaveBeenCalledWith(
        testReplyToken,
        expect.stringContaining('システムエラーが発生しました'),
      );

      expect(mockWriteLog).toHaveBeenCalledWith({
        timestamp: expect.any(String),
        userId: testUserId,
        message: userQuestion,
        response: expect.stringContaining('ERROR:'),
      });
    });
  });

  describe('generateEmbeddingsForSheet', () => {
    beforeEach(() => {
      // global.Utilitiesのモック
      global.Utilities = {
        sleep: jest.fn(),
      } as any;
    });

    it('Embedding未設定のFAQに対してEmbeddingを生成すべき', () => {
      mockGetFaqsWithoutEmbedding.mockReturnValue([
        { question: '質問1', answer: '回答1', rowIndex: 2 },
        { question: '質問2', answer: '回答2', rowIndex: 3 },
      ]);
      mockGetEmbedding.mockReturnValue([0.1, 0.2, 0.3]);

      generateEmbeddingsForSheet();

      expect(mockGetFaqsWithoutEmbedding).toHaveBeenCalled();
      expect(mockGetEmbedding).toHaveBeenCalledTimes(2);
      expect(mockGetEmbedding).toHaveBeenCalledWith('質問1');
      expect(mockGetEmbedding).toHaveBeenCalledWith('質問2');
      expect(mockSaveEmbedding).toHaveBeenCalledTimes(2);
      expect(mockSaveEmbedding).toHaveBeenCalledWith(2, [0.1, 0.2, 0.3]);
      expect(mockSaveEmbedding).toHaveBeenCalledWith(3, [0.1, 0.2, 0.3]);
    });

    it('対象のFAQが0件の場合、何もしないべき', () => {
      mockGetFaqsWithoutEmbedding.mockReturnValue([]);

      generateEmbeddingsForSheet();

      expect(mockGetFaqsWithoutEmbedding).toHaveBeenCalled();
      expect(mockGetEmbedding).not.toHaveBeenCalled();
      expect(mockSaveEmbedding).not.toHaveBeenCalled();
    });

    it('Embedding生成に失敗した場合、処理を継続すべき', () => {
      mockGetFaqsWithoutEmbedding.mockReturnValue([
        { question: '質問1', answer: '回答1', rowIndex: 2 },
        { question: '質問2', answer: '回答2', rowIndex: 3 },
      ]);
      mockGetEmbedding
        .mockReturnValueOnce(null) // 1回目は失敗
        .mockReturnValueOnce([0.1, 0.2, 0.3]); // 2回目は成功

      generateEmbeddingsForSheet();

      expect(mockGetEmbedding).toHaveBeenCalledTimes(2);
      expect(mockSaveEmbedding).toHaveBeenCalledTimes(1); // 成功した1回のみ
      expect(mockSaveEmbedding).toHaveBeenCalledWith(3, [0.1, 0.2, 0.3]);
    });
  });
});
