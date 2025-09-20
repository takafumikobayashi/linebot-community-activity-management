/**
 * kintone API クライアント (イベントマスタ用)
 */

import { getConfig } from '../utils/env';
import { KintoneEventRecord, KintoneEventResponse } from '../types/index';

/**
 * kintone APIリクエストの共通ヘッダーを取得する
 * @returns ヘッダーオブジェクト
 */
function getHeaders(): { [key: string]: string } {
  // KINTONE_API_TOKEN はイベントマスタアプリ専用のものを想定
  return {
    'X-Cybozu-API-Token': getConfig().KINTONE_EVENT_API_TOKEN,
  };
}

/**
 * kintoneのイベントマスタから翌月1ヶ月分の活動予定を取得する
 * @returns イベントレコードの配列
 */
export function getEventsFromKintone(): KintoneEventRecord[] {
  const config = getConfig();

  // 翌月の開始日と終了日を計算
  const today = new Date();
  const year = today.getFullYear();
  const nextMonth = today.getMonth() + 1;

  const firstDayOfNextMonth = new Date(year, nextMonth, 1);
  const lastDayOfNextMonth = new Date(year, nextMonth + 1, 0);

  const startDate = Utilities.formatDate(
    firstDayOfNextMonth,
    'Asia/Tokyo',
    'yyyy-MM-dd',
  );
  const endDate = Utilities.formatDate(
    lastDayOfNextMonth,
    'Asia/Tokyo',
    'yyyy-MM-dd',
  );

  // kintoneクエリを作成 (開始日時でフィルタリング)
  const query = `開始日時 >= "${startDate}" and 開始日時 <= "${endDate}" order by 開始日時 asc`;
  const encodedQuery = encodeURIComponent(query);

  const url = `https://${config.KINTONE_DOMAIN}.cybozu.com/k/v1/records.json?app=${config.KINTONE_EVENT_APP_ID}&query=${encodedQuery}`;

  console.log(`[kintone] クエリ実行: ${query}`);

  const options: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions = {
    method: 'get',
    headers: getHeaders(),
    muteHttpExceptions: true, // エラー時もレスポンスを取得
  };

  try {
    const response = UrlFetchApp.fetch(url, options);
    const statusCode = response.getResponseCode();
    const responseText = response.getContentText();

    if (statusCode !== 200) {
      console.error(`[kintone] イベント取得APIエラー: ${statusCode}`);
      console.error(`[kintone] レスポンス: ${responseText}`);
      throw new Error(`kintone API request failed with status ${statusCode}`);
    }

    const result: KintoneEventResponse = JSON.parse(responseText);
    console.log(`[kintone] イベント取得成功: ${result.records.length}件`);
    return result.records;
  } catch (e) {
    console.error('[kintone] イベント取得処理で予期せぬエラー:', e);
    return []; // エラー時は空配列を返す
  }
}
