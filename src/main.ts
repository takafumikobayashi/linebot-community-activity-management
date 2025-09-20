/**
 * Google Apps Script エントリポイント
 * GAS で公開する唯一の関数群
 */

import { LineWebhookRequest } from './types/index';
import { routeEvent } from './router';
import { validateConfig } from './utils/env';
import { generateEmbeddingsForSheet } from './handlers/faq'; // generateEmbeddingsForSheetをインポート
import {
  syncEventsFromKintone,
  sendMonthlySchedule,
  sendEventReminders,
  sendThankYouMessages,
} from './handlers/scheduled';

// GASが呼び出す関数をグローバルスコープに公開
// esbuildでバンドルされるため、明示的にglobalThisに割り当てる必要がある
Object.assign(globalThis, {
  doPost,
  doGet,
  checkConfiguration,
  generateEmbeddingsForSheet, // FAQのEmbedding生成関数も公開
  syncEventsFromKintone, // kintoneイベント同期関数も公開
  sendMonthlySchedule,
  sendEventReminders,
  sendThankYouMessages,
});

/**
 * LINE Webhook エントリポイント
 * @param e GAS POSTイベントオブジェクト
 * @returns レスポンス
 */
function doPost(
  e: GoogleAppsScript.Events.DoPost,
): GoogleAppsScript.Content.TextOutput {
  console.log('[Entry] doPost 開始');

  try {
    // リクエスト検証
    if (!e || !e.postData || !e.postData.contents) {
      console.error('[Entry] 無効なリクエスト');
      return createErrorResponse('Invalid request');
    }

    // JSON解析
    let requestBody: LineWebhookRequest;
    try {
      requestBody = JSON.parse(e.postData.contents);
    } catch (parseError) {
      console.error('[Entry] JSON解析エラー:', parseError);
      return createErrorResponse('Invalid JSON');
    }

    // イベント配列検証
    if (!requestBody.events || !Array.isArray(requestBody.events)) {
      console.error('[Entry] イベントデータが不正');
      return createErrorResponse('No events found');
    }

    console.log(`[Entry] 受信イベント数: ${requestBody.events.length}`);

    // 各イベントを処理
    requestBody.events.forEach((event, index) => {
      try {
        console.log(`[Entry] イベント${index + 1}処理開始`);
        routeEvent(event);
        console.log(`[Entry] イベント${index + 1}処理完了`);
      } catch (eventError) {
        console.error(`[Entry] イベント${index + 1}処理エラー:`, eventError);
        // 個別イベントのエラーは全体を止めない
      }
    });

    return createSuccessResponse();
  } catch (error: unknown) {
    console.error('[Entry] 予期しないエラー:', error);
    return createErrorResponse('Internal server error');
  }
}

/**
 * GET リクエスト用エントリポイント（動作確認用）
 * @returns テスト応答
 */
function doGet(): GoogleAppsScript.Content.TextOutput {
  console.log('[Entry] doGet 実行');

  try {
    // 設定検証
    const configValid = validateConfig();

    const response = {
      status: 'ok',
      message: 'LINE Bot is working',
      timestamp: new Date().toISOString(),
      config_valid: configValid,
      version: 'refactored-v1.0',
    };

    return ContentService.createTextOutput(
      JSON.stringify(response),
    ).setMimeType(ContentService.MimeType.JSON);
  } catch (error: unknown) {
    console.error('[Entry] doGet エラー:', error);

    const errorResponse = {
      status: 'error',
      message: 'Configuration error',
      timestamp: new Date().toISOString(),
      error: String(error),
    };

    return ContentService.createTextOutput(
      JSON.stringify(errorResponse),
    ).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * 成功レスポンスを作成
 * @returns 200 OK レスポンス
 */
function createSuccessResponse(): GoogleAppsScript.Content.TextOutput {
  return ContentService.createTextOutput(
    JSON.stringify({ status: 'ok' }),
  ).setMimeType(ContentService.MimeType.JSON);
}

/**
 * エラーレスポンスを作成
 * @param message エラーメッセージ
 * @returns エラーレスポンス
 */
function createErrorResponse(
  message: string,
): GoogleAppsScript.Content.TextOutput {
  return ContentService.createTextOutput(
    JSON.stringify({
      status: 'error',
      message: message,
      timestamp: new Date().toISOString(),
    }),
  ).setMimeType(ContentService.MimeType.JSON);
}

/**
 * 手動実行用: 設定確認
 */
function checkConfiguration(): void {
  console.log('[Entry] 設定確認開始');

  try {
    const isValid = validateConfig();
    console.log(`[Entry] 設定確認結果: ${isValid ? '成功' : '失敗'}`);
  } catch (error: unknown) {
    console.error('[Entry] 設定確認エラー:', error);
  }
}
