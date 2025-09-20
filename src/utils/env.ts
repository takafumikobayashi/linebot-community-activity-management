/**
 * 環境変数・設定管理
 */

import { Config } from '../types/index';

/**
 * 必須の環境変数を取得・検証する
 */
export function getConfig(): Config {
  const properties = PropertiesService.getScriptProperties();

  const CHANNEL_ACCESS_TOKEN = properties.getProperty('CHANNEL_ACCESS_TOKEN');
  const OPENAI_API_KEY = properties.getProperty('OPENAI_API_KEY');
  const SPREADSHEET_ID = properties.getProperty('SPREADSHEET_ID');
  const STAFF_USER_ID = properties.getProperty('STAFF_USER_ID');
  const SIMILARITY_THRESHOLD =
    properties.getProperty('SIMILARITY_THRESHOLD') || '0.75';

  // 必須項目の検証
  if (!CHANNEL_ACCESS_TOKEN) {
    throw createConfigError(
      'CHANNEL_ACCESS_TOKEN',
      'LINE Channel Access Tokenが設定されていません',
    );
  }

  if (!OPENAI_API_KEY) {
    throw createConfigError(
      'OPENAI_API_KEY',
      'OpenAI API Keyが設定されていません',
    );
  }

  if (!SPREADSHEET_ID) {
    throw createConfigError(
      'SPREADSHEET_ID',
      'Spreadsheet IDが設定されていません',
    );
  }

  if (!STAFF_USER_ID) {
    throw createConfigError(
      'STAFF_USER_ID',
      'LINE通知先 USERIDが設定されていません',
    );
  }

  // 数値の検証
  const threshold = parseFloat(SIMILARITY_THRESHOLD);
  if (isNaN(threshold) || threshold < 0 || threshold > 1) {
    throw createConfigError(
      'SIMILARITY_THRESHOLD',
      '類似度閾値は0〜1の数値である必要があります',
    );
  }

  return {
    CHANNEL_ACCESS_TOKEN,
    OPENAI_API_KEY,
    SPREADSHEET_ID,
    STAFF_USER_ID,
    SIMILARITY_THRESHOLD: threshold,
  };
}

/**
 * 設定エラーを作成する
 */
function createConfigError(configKey: string, message: string): Error {
  const error = new Error(`Configuration Error: ${message}`);
  console.error(`[Config Error] ${configKey}: ${message}`);
  return error;
}

/**
 * 設定の健全性チェック（デバッグ用）
 */
export function validateConfig(): boolean {
  try {
    const config = getConfig();
    console.log('[Config] 設定検証成功');
    console.log(
      `[Config] SIMILARITY_THRESHOLD: ${config.SIMILARITY_THRESHOLD}`,
    );
    return true;
  } catch (error) {
    console.error('[Config] 設定検証失敗:', error);
    return false;
  }
}

/**
 * 単語だけでFAQに誘導するトリガー語を取得する
 * スクリプトプロパティ `FAQ_SINGLE_WORD_TRIGGERS` から読み込む（JSON配列またはCSV）
 * 未設定や解析失敗時は空配列を返す
 */
export function getSingleWordFaqTriggers(): string[] {
  try {
    const raw = PropertiesService.getScriptProperties().getProperty(
      'FAQ_SINGLE_WORD_TRIGGERS',
    );
    if (!raw) return [];

    let list: string[] = [];
    if (raw.trim().startsWith('[')) {
      // JSON配列
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) list = parsed.map((v) => String(v));
    } else {
      // CSV
      list = raw
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
    }

    // 重複排除
    return Array.from(new Set(list));
  } catch (e) {
    console.warn('[Config] FAQ_SINGLE_WORD_TRIGGERS の解析に失敗しました:', e);
    return [];
  }
}

/**
 * フォールバック画像URL配列を取得する
 * スクリプトプロパティ `FALLBACK_IMAGES` から読み込む（JSON配列またはCSV）
 * 未設定や解析失敗時は空配列を返す
 */
export function getFallbackImages(): string[] {
  try {
    // テスト環境などでPropertiesServiceが未定義/未モックの可能性がある
    if (
      typeof PropertiesService === 'undefined' ||
      typeof PropertiesService.getScriptProperties !== 'function'
    )
      return [];

    const raw =
      PropertiesService.getScriptProperties().getProperty('FALLBACK_IMAGES');
    if (!raw) return [];

    let list: string[] = [];
    if (raw.trim().startsWith('[')) {
      // JSON配列
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) list = parsed.map((v) => String(v));
    } else {
      // CSV
      list = raw
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
    }

    // https? URLのみ許可 + 重複排除
    const httpsOnly = list.filter((u) => /^https?:\/\//.test(u));
    return Array.from(new Set(httpsOnly));
  } catch (e) {
    console.warn('[Config] FALLBACK_IMAGES の解析に失敗しました:', e);
    return [];
  }
}

/**
 * 会話履歴コンテキストの設定を取得する
 * @returns 会話履歴設定オブジェクト
 */
export function getConversationContextConfig(): {
  maxConversationPairs: number;
  maxContextHours: number;
} {
  try {
    const maxPairs = PropertiesService.getScriptProperties().getProperty(
      'MAX_CONVERSATION_PAIRS',
    );
    const maxHours =
      PropertiesService.getScriptProperties().getProperty('MAX_CONTEXT_HOURS');

    return {
      maxConversationPairs: maxPairs ? parseInt(maxPairs, 10) : 7,
      maxContextHours: maxHours ? parseInt(maxHours, 10) : 24,
    };
  } catch (e) {
    console.warn('[Config] 会話コンテキスト設定の取得に失敗しました:', e);
    return {
      maxConversationPairs: 7,
      maxContextHours: 24,
    };
  }
}
