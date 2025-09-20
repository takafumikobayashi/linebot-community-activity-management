/**
 * FAQ自動応答ハンドラ
 * 元のmain.tsからの移植版
 */

import { SearchResult } from '../types/index';
import { getConfig } from '../utils/env';
import { calculateCosineSimilarity, isValidVector } from '../utils/similarity';
import {
  getOrganizationConfig,
  getFaqTriggerRemovalPattern,
} from '../utils/config';
import {
  getFaqData,
  writeLog,
  getFaqsWithoutEmbedding,
  saveEmbedding,
  getRecentConversationForUser,
} from '../services/sheet';
import {
  getEmbedding,
  generateAnswer,
  createFaqPrompt,
  generateChatWithHistory,
} from '../services/openai';
import { KURUHOUSE_SYSTEM_MESSAGE } from '../utils/prompts';
import { replyMessage } from '../services/line';

/**
 * FAQ検索・応答を処理する
 * @param replyToken LINE返信トークン
 * @param userQuestion ユーザーの質問
 * @param userId ユーザーID
 */
export function handleFaq(
  replyToken: string,
  userQuestion: string,
  userId: string,
): void {
  console.log(`[FAQ] 処理開始 - User: ${userId}, Question: ${userQuestion}`);

  try {
    const cleanedQuestion = sanitizeQuestion(userQuestion);
    if (cleanedQuestion !== userQuestion) {
      console.log(
        `[FAQ] トリガーワードを除去: "${userQuestion}" → "${cleanedQuestion}"`,
      );
    }

    const bestMatch = findBestMatch(cleanedQuestion);
    const config = getConfig();

    console.log(`[FAQ] 検索結果:`, bestMatch);
    console.log(`[FAQ] 類似度閾値: ${config.SIMILARITY_THRESHOLD}`);

    let responseMessage: string;

    if (bestMatch && bestMatch.similarity > config.SIMILARITY_THRESHOLD) {
      console.log('[FAQ] 条件がTRUE - GPTで回答生成');

      // プロンプト生成
      const prompt = createFaqPrompt(
        cleanedQuestion,
        bestMatch.question,
        bestMatch.answer,
      );

      // GPTで回答生成
      responseMessage = generateAnswer(prompt);
      console.log(`[FAQ] GPT回答: ${responseMessage}`);
    } else {
      console.log('[FAQ] 条件がFALSE - 雑談応答へフォールバック');
      let history: Array<{
        role: 'user' | 'assistant' | 'system';
        content: string;
      }> = [];
      try {
        history = getRecentConversationForUser(userId, 3);
      } catch (e) {
        console.warn('[FAQ] 会話履歴の取得に失敗しました:', e);
      }

      responseMessage = generateChatWithHistory(
        KURUHOUSE_SYSTEM_MESSAGE,
        history,
        cleanedQuestion,
        200,
        0.3,
      );
      console.log(`[FAQ] 雑談フォールバック応答: ${responseMessage}`);
    }

    // LINE返信
    replyMessage(replyToken, responseMessage);

    // ログ記録
    writeLog({
      timestamp: new Date().toISOString(),
      userId: userId,
      message: userQuestion, // 元のメッセージをログに残す
      response: responseMessage,
      similarity: bestMatch?.similarity,
    });

    console.log('[FAQ] 処理完了');
  } catch (error: unknown) {
    console.error('[FAQ] 処理エラー:', error);

    const errorMessage =
      '申し訳ありません、システムエラーが発生しました。しばらく時間をおいてから再度お試しください。';
    replyMessage(replyToken, errorMessage);

    // エラーログ記録
    writeLog({
      timestamp: new Date().toISOString(),
      userId: userId,
      message: userQuestion, // 元のメッセージをログに残す
      response: `ERROR: ${String(error)}`,
    });
  }
}

/**
 * ベストマッチFAQを検索する
 * @param userQuestion ユーザーの質問
 * @returns ベストマッチ結果 or null
 */
function findBestMatch(userQuestion: string): SearchResult | null {
  try {
    console.log(`[FAQ] ベストマッチ検索開始: ${userQuestion}`);

    // FAQ データ取得
    const faqData = getFaqData();
    if (faqData.length === 0) {
      console.warn('[FAQ] FAQデータが空です');
      return null;
    }

    // ユーザー質問をベクトル化
    const userVector = getEmbedding(userQuestion);
    if (!userVector || !isValidVector(userVector)) {
      console.error('[FAQ] ユーザー質問のEmbedding取得に失敗');
      return null;
    }

    console.log('[FAQ] ユーザー質問ベクトル取得成功');

    let bestMatch: SearchResult = { question: '', answer: '', similarity: 0 };

    // 各FAQとの類似度計算
    for (const faq of faqData) {
      if (!faq.embedding || !isValidVector(faq.embedding)) {
        console.warn(`[FAQ] 無効なEmbedding: ${faq.question}`);
        continue;
      }

      try {
        const similarity = calculateCosineSimilarity(userVector, faq.embedding);
        console.log(
          `[FAQ] 類似度チェック: ${similarity.toFixed(4)} - ${faq.question}`,
        );

        if (similarity > bestMatch.similarity) {
          bestMatch = {
            question: faq.question,
            answer: faq.answer,
            similarity: similarity,
          };
        }
      } catch (simError) {
        console.warn(`[FAQ] 類似度計算エラー: ${faq.question} - ${simError}`);
        continue;
      }
    }

    if (bestMatch.similarity > 0) {
      console.log(
        `[FAQ] ベストマッチ: ${bestMatch.similarity.toFixed(4)} - ${bestMatch.question}`,
      );
      return bestMatch;
    } else {
      console.log('[FAQ] マッチする結果が見つかりませんでした');
      return null;
    }
  } catch (error) {
    console.error('[FAQ] ベストマッチ検索エラー:', error);
    return null;
  }
}

/**
 * ユーザー質問の前置きトリガーを除去する
 * 例: 「組織名教えて 集合場所はどこ？」→「集合場所はどこ？」
 */
function sanitizeQuestion(text: string): string {
  try {
    let q = (text || '').trim();
    // 設定されたトリガーフレーズを前方一致で除去
    const config = getOrganizationConfig();
    const removalPattern = getFaqTriggerRemovalPattern(config);
    q = q.replace(removalPattern, '');
    return q || text;
  } catch (_) {
    return text;
  }
}

/**
 * 手動実行用: Embedding生成
 * 元のgenerateEmbeddingsForSheet()の移植版
 */
export function generateEmbeddingsForSheet(): void {
  console.log('[FAQ] Embedding生成開始');

  try {
    const faqsWithoutEmbedding = getFaqsWithoutEmbedding();

    if (faqsWithoutEmbedding.length === 0) {
      console.log('[FAQ] Embedding生成対象がありません');
      return;
    }

    console.log(`[FAQ] Embedding生成対象: ${faqsWithoutEmbedding.length}件`);

    for (const faq of faqsWithoutEmbedding) {
      try {
        console.log(`[FAQ] Embedding生成中: ${faq.question}`);

        const embedding = getEmbedding(faq.question);
        if (embedding && isValidVector(embedding)) {
          saveEmbedding(faq.rowIndex, embedding);
          console.log(`[FAQ] Embedding生成完了: ${faq.question}`);
        } else {
          console.error(`[FAQ] Embedding生成失敗: ${faq.question}`);
        }

        // API制限対策で少し待機
        Utilities.sleep(100);
      } catch (faqError) {
        console.error(`[FAQ] FAQ処理エラー (${faq.question}):`, faqError);
        continue;
      }
    }

    console.log('[FAQ] Embedding生成処理完了');
  } catch (error) {
    console.error('[FAQ] Embedding生成エラー:', error);
  }
}
