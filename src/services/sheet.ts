/**
 * Google Spreadsheet クライアント
 */

import { getConfig } from '../utils/env';
import { FaqEntry, KintoneEventRecord } from '../types/index';

/**
 * DateオブジェクトをYYYY/MM/DD形式の文字列に変換する
 * @param date 変換対象の日付
 * @returns YYYY/MM/DD形式の文字列
 */
function formatDateAsYMD(date: Date): string {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}/${month}/${day}`;
}

// (既存の関数は省略)

/**
 * FAQシートからデータを取得する
 * @returns FAQ配列
 */
export function getFaqData(): FaqEntry[] {
  const config = getConfig();

  try {
    const sheet = SpreadsheetApp.openById(config.SPREADSHEET_ID).getSheetByName(
      'FAQ',
    );

    if (!sheet) {
      throw new Error('FAQシートが見つかりません');
    }

    const data = sheet.getDataRange().getValues();
    const faqs: FaqEntry[] = [];

    // ヘッダー行をスキップして処理
    for (let i = 1; i < data.length; i++) {
      const question = data[i][0];
      const answer = data[i][1];
      const embeddingStr = data[i][2];

      if (question && answer) {
        const faq: FaqEntry = {
          question: question.toString(),
          answer: answer.toString(),
        };

        // Embeddingが存在する場合はパース
        if (embeddingStr && typeof embeddingStr === 'string') {
          try {
            faq.embedding = JSON.parse(embeddingStr);
          } catch (error) {
            console.warn(`[Sheet] Embedding解析失敗 (行${i + 1}): ${error}`);
          }
        }

        faqs.push(faq);
      }
    }

    console.log(`[Sheet] FAQ取得成功: ${faqs.length}件`);
    return faqs;
  } catch (error) {
    console.error('[Sheet] FAQ取得エラー:', error);
    throw error;
  }
}

/**
 * 特定の行にEmbeddingを保存する
 * @param rowIndex 行インデックス (1ベース)
 * @param embedding ベクトル配列
 */
export function saveEmbedding(rowIndex: number, embedding: number[]): void {
  const config = getConfig();

  try {
    const sheet = SpreadsheetApp.openById(config.SPREADSHEET_ID).getSheetByName(
      'FAQ',
    );

    if (!sheet) {
      throw new Error('FAQシートが見つかりません');
    }

    // C列（3列目）にEmbeddingを保存
    sheet.getRange(rowIndex, 3).setValue(JSON.stringify(embedding));
    SpreadsheetApp.flush(); // 即座に反映

    console.log(`[Sheet] Embedding保存成功: 行${rowIndex}`);
  } catch (error) {
    console.error(`[Sheet] Embedding保存エラー (行${rowIndex}):`, error);
    throw error;
  }
}

/**
 * ログをスプレッドシートに記録する
 * @param logData ログデータ
 */
export function writeLog(logData: {
  timestamp: string;
  userId: string;
  message: string;
  response: string;
  similarity?: number;
}): void {
  const config = getConfig();

  try {
    const sheet = SpreadsheetApp.openById(config.SPREADSHEET_ID).getSheetByName(
      'Log',
    );

    if (!sheet) {
      console.warn(
        '[Sheet] Logシートが見つかりません。ログ記録をスキップします。',
      );
      return;
    }

    sheet.appendRow([
      logData.timestamp,
      logData.userId,
      logData.message,
      logData.response,
      logData.similarity || '',
    ]);

    console.log(`[Sheet] ログ記録成功: ${logData.userId}`);
  } catch (error) {
    console.error('[Sheet] ログ記録エラー:', error);
    // ログ記録の失敗は処理を止めない
  }
}

/**
 * 指定ユーザーの直近の会話履歴を取得する（Logシート由来）
 * 直近のペア（ユーザー発話/ボット応答）を古い→新しい順で返す
 * @param userId ユーザーID
 * @param limitPairs 取得する発話ペア数（既定: 3 = 直近3往復）
 */
export function getRecentConversationForUser(
  userId: string,
  limitPairs: number = 3,
): Array<{ role: 'user' | 'assistant'; content: string }> {
  const config = getConfig();
  try {
    const sheet = SpreadsheetApp.openById(config.SPREADSHEET_ID).getSheetByName(
      'Log',
    );
    if (!sheet) return [];

    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();
    if (lastRow < 2 || lastCol < 4) return [];

    // パフォーマンス対策: 末尾から最大200行だけ読む
    const maxRead = Math.min(200, lastRow - 1);
    const startRow = lastRow - maxRead + 1;
    const range = sheet.getRange(startRow, 1, maxRead, lastCol);
    const values = range.getValues();

    // Logシート列想定: [timestamp, userId, message, response, similarity]
    const pairs: Array<{ role: 'user' | 'assistant'; content: string }> = [];
    for (let i = 0; i < values.length; i++) {
      const row = values[i];
      if (String(row[1]) !== String(userId)) continue;
      const msg = String(row[2] || '');
      const resp = String(row[3] || '');
      if (msg) pairs.push({ role: 'user', content: msg });
      if (resp) pairs.push({ role: 'assistant', content: resp });
    }

    if (pairs.length === 0) return [];

    // 直近 limitPairs 往復分を選択（ユーザー/アシスタントで2件/往復）
    const keepCount = limitPairs * 2;
    const recent = pairs.slice(-keepCount);
    // 古い→新しい順に整列済みのため、そのまま返す
    return recent;
  } catch (error) {
    console.error('[Sheet] 会話履歴取得エラー:', error);
    return [];
  }
}

/**
 * Embeddingが未設定のFAQを取得する
 * @returns Embedding未設定のFAQ配列（行番号付き）
 */
export function getFaqsWithoutEmbedding(): Array<
  FaqEntry & { rowIndex: number }
> {
  const config = getConfig();

  try {
    const sheet = SpreadsheetApp.openById(config.SPREADSHEET_ID).getSheetByName(
      'FAQ',
    );

    if (!sheet) {
      throw new Error('FAQシートが見つかりません');
    }

    const data = sheet.getDataRange().getValues();
    const results: Array<FaqEntry & { rowIndex: number }> = [];

    // ヘッダー行をスキップして処理
    for (let i = 1; i < data.length; i++) {
      const question = data[i][0];
      const answer = data[i][1];
      const embeddingStr = data[i][2];

      // 質問があり、かつEmbeddingがない行
      if (question && answer && !embeddingStr) {
        results.push({
          question: question.toString(),
          answer: answer.toString(),
          rowIndex: i + 1, // 1ベースの行番号
        });
      }
    }

    console.log(`[Sheet] Embedding未設定FAQ: ${results.length}件`);
    return results;
  } catch (error) {
    console.error('[Sheet] Embedding未設定FAQ取得エラー:', error);
    throw error;
  }
}

/**
 * kintoneから取得したイベントデータをEventシートに保存・更新（Upsert）する
 * 既存レコードのうち、kintoneから取得されなかった（削除された）レコードは「キャンセル」ステータスに更新
 * @param events イベントデータの配列
 */
export function saveEventsToSheet(events: KintoneEventRecord[]): void {
  const config = getConfig();

  try {
    const sheet = SpreadsheetApp.openById(config.SPREADSHEET_ID).getSheetByName(
      'Event',
    );
    if (!sheet) throw new Error('Eventシートが見つかりません');

    const headers = sheet
      .getRange(1, 1, 1, sheet.getLastColumn())
      .getValues()[0];
    const recordIdCol = headers.indexOf('kintoneRecordId');
    const statusCol = headers.indexOf('ステータス');
    if (recordIdCol === -1)
      throw new Error('ヘッダー「kintoneRecordId」が見つかりません');
    if (statusCol === -1)
      throw new Error('ヘッダー「ステータス」が見つかりません');

    const existingData =
      sheet.getLastRow() > 1
        ? sheet
            .getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn())
            .getValues()
        : [];
    // 既存行を kintoneRecordId(文字列) をキーにマップ化
    const existingEventMap = new Map(
      existingData.map((row, index) => [
        String(row[recordIdCol] ?? ''),
        { rowNum: index + 2, data: row },
      ]),
    );

    // kintoneから取得されたレコードIDのセット（文字列化）
    const kintoneRecordIds = new Set(
      events.map((event) => String(event.$id.value)),
    );

    // 取得対象月（YYYY-MM）の集合を作る
    // 空配列（取得失敗など）の場合はキャンセル判定を行わないため、空のままにする
    const targetYmSet = new Set<string>();
    for (const ev of events) {
      const dt = new Date(String(ev['開始日時'].value));
      if (!isNaN(dt.getTime())) {
        const ym = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
        targetYmSet.add(ym);
      }
    }

    const dateCol = headers.indexOf('開催日');

    let updatedCount = 0;
    let appendedCount = 0;
    let cancelledCount = 0;

    // 1. kintoneから取得したイベントを処理（追加・更新）
    for (const event of events) {
      const recordId = String(event.$id.value);
      const existing = existingEventMap.get(recordId);

      // 日付フォーマットをyyyy/mm/dd形式に変更
      const startDateTime = new Date(String(event['開始日時'].value));
      const endDateTime = new Date(String(event['終了日時'].value));

      const eventData: Record<string, unknown> = {
        kintoneRecordId: recordId,
        ステータス: existing ? existing.data[statusCol] : '未開催', // 既存の場合は既存ステータスを保持
        イベント名: event['イベント名'].value,
        開催日: formatDateAsYMD(startDateTime),
        開始時間: startDateTime.toLocaleTimeString('ja-JP', {
          hour: '2-digit',
          minute: '2-digit',
        }),
        終了時間: endDateTime.toLocaleTimeString('ja-JP', {
          hour: '2-digit',
          minute: '2-digit',
        }),
      };

      if (existing) {
        // 更新（ステータスが「キャンセル」の場合は「未開催」に復活）
        let hasChanges = false;
        for (const header of Object.keys(eventData)) {
          const col = headers.indexOf(header);
          if (col !== -1) {
            const currentValue = existing.data[col];
            const newValue = eventData[header];

            // ステータス復活チェック
            if (header === 'ステータス' && currentValue === 'キャンセル') {
              sheet.getRange(existing.rowNum, col + 1).setValue('未開催');
              hasChanges = true;
            } else if (currentValue !== newValue) {
              sheet.getRange(existing.rowNum, col + 1).setValue(newValue);
              hasChanges = true;
            }
          }
        }
        if (hasChanges) updatedCount++;
      } else {
        // 新規追加
        const newRow = headers.map((header) => eventData[header] || '');
        sheet.appendRow(newRow);
        appendedCount++;
      }
    }

    // 2. kintoneから削除されたレコードを「キャンセル」ステータスに更新
    // 条件:
    //  - 取得対象月に属する行のみ
    //  - 現在のステータスが「未開催」の行のみ
    //  - 取得結果に同じkintoneRecordIdが存在しない
    if (targetYmSet.size > 0 && dateCol !== -1) {
      for (const [recordId, existing] of existingEventMap) {
        if (kintoneRecordIds.has(String(recordId))) continue; // 取得済み → スキップ

        const currentStatus = String(existing.data[statusCol] ?? '');

        const dateCell = existing.data[dateCol];
        const d = new Date(String(dateCell));

        if (isNaN(d.getTime())) {
          // 日付が不正（例: ヘッダー行等）の場合は互換性のためキャンセル扱い
          if (currentStatus !== 'キャンセル') {
            sheet
              .getRange(existing.rowNum, statusCol + 1)
              .setValue('キャンセル');
            cancelledCount++;
          }
          continue;
        }

        // 日付が有効な場合のみ、対象月かつ未開催の行をキャンセル
        const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (targetYmSet.has(ym) && currentStatus === '未開催') {
          sheet.getRange(existing.rowNum, statusCol + 1).setValue('キャンセル');
          cancelledCount++;
        }
      }
    } else {
      // 取得イベントが空（または開催日列が無い）場合は安全のためキャンセル処理をスキップ
      if (events.length === 0) {
        console.warn(
          '[Sheet] 取得イベントが空のため、キャンセル更新はスキップしました',
        );
      }
    }

    console.log(
      `[Sheet] Eventシートへの保存完了。追加: ${appendedCount}件, 更新: ${updatedCount}件, キャンセル: ${cancelledCount}件`,
    );
  } catch (error) {
    console.error('[Sheet] Eventシートへの保存エラー:', error);
    throw error;
  }
}

/**
 * UsersシートからすべてのユーザーIDを取得する
 * @returns ユーザーIDの配列
 */
export function getAllUserIds(): string[] {
  const config = getConfig();
  try {
    const sheet = SpreadsheetApp.openById(config.SPREADSHEET_ID).getSheetByName(
      'Users',
    );
    if (!sheet) throw new Error('Usersシートが見つかりません');

    if (sheet.getLastRow() < 2) return []; // ヘッダーのみの場合は空

    const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
    return data.map((row) => row[0]).filter((id) => id);
  } catch (error) {
    console.error('[Sheet] 全ユーザーID取得エラー:', error);
    return [];
  }
}

/**
 * 新しいユーザーをUsersシートに保存する
 * @param userId ユーザーID
 */
export function saveNewUser(userId: string): void {
  const config = getConfig();
  try {
    const sheet = SpreadsheetApp.openById(config.SPREADSHEET_ID).getSheetByName(
      'Users',
    );
    if (!sheet) throw new Error('Usersシートが見つかりません');

    // データを一度だけ読み込んでからチェックする
    if (sheet.getLastRow() > 1) {
      const existingIds = sheet
        .getRange(2, 1, sheet.getLastRow() - 1, 1)
        .getValues()
        .map((row) => row[0]);
      if (existingIds.includes(userId)) {
        console.log(`[Sheet] 既存ユーザーのため保存をスキップ: ${userId}`);
        return;
      }
    }

    // 新規ユーザーを追記
    sheet.appendRow([userId, new Date()]);
    console.log(`[Sheet] 新規ユーザー保存成功: ${userId}`);
  } catch (error) {
    console.error(`[Sheet] 新規ユーザー保存エラー: ${userId}`, error);
  }
}

/**
 * Eventシートから指定した月のイベントを取得する
 * @param targetMonth 月 (1-12)
 * @param targetYear 年
 * @returns イベント情報の配列
 */
export function getEventsForMonth(
  targetYear: number,
  targetMonth: number,
): Array<Record<string, unknown>> {
  const config = getConfig();
  try {
    const sheet = SpreadsheetApp.openById(config.SPREADSHEET_ID).getSheetByName(
      'Event',
    );
    if (!sheet) throw new Error('Eventシートが見つかりません');

    const headers = sheet
      .getRange(1, 1, 1, sheet.getLastColumn())
      .getValues()[0];
    const dateCol = headers.indexOf('開催日');
    if (dateCol === -1) throw new Error('ヘッダー「開催日」が見つかりません');

    const allData =
      sheet.getLastRow() > 1
        ? sheet
            .getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn())
            .getValues()
        : [];

    const events = allData
      .map((row) => {
        const event: Record<string, unknown> = {};
        headers.forEach((header, index) => {
          event[header] = row[index];
        });
        return event;
      })
      .filter((event) => {
        const eventDate = new Date(String(event['開催日']));
        const status = String(event['ステータス'] || '');
        return (
          eventDate.getFullYear() === targetYear &&
          eventDate.getMonth() + 1 === targetMonth &&
          status !== 'キャンセル'
        );
      });

    console.log(
      `[Sheet] ${targetYear}年${targetMonth}月のイベント取得成功: ${events.length}件`,
    );
    return events;
  } catch (error) {
    console.error('[Sheet] 月次イベント取得エラー:', error);
    return [];
  }
}

/**
 * Eventシートから指定した日付のイベントを取得する
 * @param targetDate 対象の日付
 * @returns イベント情報の配列
 */
export function getEventsForDate(
  targetDate: Date,
): Array<Record<string, unknown>> {
  const config = getConfig();
  try {
    const sheet = SpreadsheetApp.openById(config.SPREADSHEET_ID).getSheetByName(
      'Event',
    );
    if (!sheet) throw new Error('Eventシートが見つかりません');

    const headers = sheet
      .getRange(1, 1, 1, sheet.getLastColumn())
      .getValues()[0];
    const dateCol = headers.indexOf('開催日');
    if (dateCol === -1) throw new Error('ヘッダー「開催日」が見つかりません');

    const allData =
      sheet.getLastRow() > 1
        ? sheet
            .getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn())
            .getValues()
        : [];
    const targetDateString = targetDate.toLocaleDateString();

    const events = allData
      .map((row) => {
        const event: Record<string, unknown> = {};
        headers.forEach((header, index) => {
          event[header] = row[index];
        });
        return event;
      })
      .filter((event) => {
        const eventDate = new Date(String(event['開催日']));
        const status = String(event['ステータス'] || '');
        return (
          eventDate.toLocaleDateString() === targetDateString &&
          status !== 'キャンセル'
        );
      });

    console.log(
      `[Sheet] ${targetDateString}のイベント取得成功: ${events.length}件`,
    );
    return events;
  } catch (error) {
    console.error('[Sheet] 日次イベント取得エラー:', error);
    return [];
  }
}

/**
 * Eventシートの出席者1〜15列にRSVPを反映する
 * @param eventRecordId kintoneレコードID
 * @param userId LINEユーザーID
 * @param status 'yes' | 'no'
 * @returns 結果コード
 */
export function recordRSVPInEvent(
  eventRecordId: string,
  userId: string,
  status: 'yes' | 'no',
  source?: 'text' | 'postback' | 'admin',
):
  | 'added'
  | 'removed'
  | 'already_registered'
  | 'not_registered'
  | 'full'
  | 'event_not_found'
  | 'invalid_status' {
  const config = getConfig();

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(5000);
  } catch (_e) {
    console.error('[Sheet] RSVPロック取得に失敗しました');
  }

  try {
    const sheet = SpreadsheetApp.openById(config.SPREADSHEET_ID).getSheetByName(
      'Event',
    );
    if (!sheet) throw new Error('Eventシートが見つかりません');

    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();
    if (lastRow < 2) return 'event_not_found';

    const headers: string[] = sheet
      .getRange(1, 1, 1, lastCol)
      .getValues()[0] as string[];
    const recordIdCol = headers.indexOf('kintoneRecordId');
    if (recordIdCol === -1)
      throw new Error('ヘッダー「kintoneRecordId」が見つかりません');

    // 出席者列のインデックス群
    const participantCols: number[] = [];
    for (let i = 1; i <= 15; i++) {
      const idx = headers.indexOf(`出席者${i}`);
      if (idx !== -1) participantCols.push(idx);
    }

    if (participantCols.length === 0) {
      // 出席者列が無い場合はエラー扱い
      throw new Error('出席者1〜15のヘッダーが見つかりません');
    }

    // 全データを取得
    const allData = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

    // 対象行を検索
    let targetRowIndex = -1; // 2ベースのシート行番号
    let targetRow: unknown[] | null = null;
    for (let i = 0; i < allData.length; i++) {
      if (String(allData[i][recordIdCol]) === String(eventRecordId)) {
        targetRowIndex = i + 2;
        targetRow = allData[i];
        break;
      }
    }

    if (targetRowIndex === -1 || !targetRow) {
      return 'event_not_found';
    }

    // 現在の参加者の位置を探す
    let existingColIndex: number | null = null;
    for (const colIdx of participantCols) {
      if (String(targetRow[colIdx]) === String(userId)) {
        existingColIndex = colIdx;
        break;
      }
    }

    if (status === 'yes') {
      if (existingColIndex !== null) {
        return 'already_registered';
      }
      // 空きセルに追加
      for (const colIdx of participantCols) {
        if (!targetRow[colIdx]) {
          sheet.getRange(targetRowIndex, colIdx + 1).setValue(userId);
          SpreadsheetApp.flush();
          try {
            appendParticipation({
              timestamp: new Date().toISOString(),
              eventRecordId: String(eventRecordId),
              userId: String(userId),
              action: 'yes',
              source: source ?? 'rsvp',
            });
          } catch (e) {
            console.warn('[Sheet] Participation追記スキップ:', e);
          }
          return 'added';
        }
      }
      return 'full';
    } else if (status === 'no') {
      if (existingColIndex !== null) {
        sheet.getRange(targetRowIndex, existingColIndex + 1).setValue('');
        SpreadsheetApp.flush();
        try {
          appendParticipation({
            timestamp: new Date().toISOString(),
            eventRecordId: String(eventRecordId),
            userId: String(userId),
            action: 'no',
            source: source ?? 'rsvp',
          });
        } catch (e) {
          console.warn('[Sheet] Participation追記スキップ:', e);
        }
        return 'removed';
      }
      return 'not_registered';
    }

    return 'invalid_status';
  } catch (error) {
    console.error('[Sheet] RSVP反映エラー:', error);
    return 'invalid_status';
  } finally {
    lock.releaseLock();
  }
}

/**
 * 参加履歴レジャー（Participation）に1行追記する
 * シートが存在しない場合はヘッダー付きで新規作成する
 */
export function appendParticipation(entry: {
  timestamp: string; // ISO文字列
  eventRecordId: string;
  userId: string;
  action: 'yes' | 'no' | 'cancel' | 'checkin' | 'waitlist';
  source?: 'rsvp' | 'text' | 'postback' | 'admin';
  note?: string;
}): void {
  const config = getConfig();
  try {
    const ss = SpreadsheetApp.openById(config.SPREADSHEET_ID);
    let sheet = ss.getSheetByName('Participation');
    if (!sheet) {
      sheet = ss.insertSheet('Participation');
      sheet
        .getRange(1, 1, 1, 6)
        .setValues([
          ['timestamp', 'eventRecordId', 'userId', 'action', 'source', 'note'],
        ]);
    }

    sheet.appendRow([
      entry.timestamp,
      entry.eventRecordId,
      entry.userId,
      entry.action,
      entry.source || 'rsvp',
      entry.note || '',
    ]);
    console.log(
      `[Sheet] Participation追記: ${entry.userId} ${entry.eventRecordId} ${entry.action}`,
    );
  } catch (error) {
    console.error('[Sheet] Participation追記エラー:', error);
  }
}

/**
 * 直近のイベントを取得する
 * Eventシートから今日以降のイベントを日付/時間昇順に並べ、先頭limit件を返す
 */
export function getUpcomingEvents(
  limit: number = 3,
): Array<Record<string, unknown>> {
  const config = getConfig();
  try {
    const sheet = SpreadsheetApp.openById(config.SPREADSHEET_ID).getSheetByName(
      'Event',
    );
    if (!sheet) throw new Error('Eventシートが見つかりません');

    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();
    if (lastRow < 2) return [];

    const headers: string[] = sheet
      .getRange(1, 1, 1, lastCol)
      .getValues()[0] as string[];

    const all = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const records = all
      .map((row) => {
        const rec: Record<string, unknown> = {};
        headers.forEach((h, i) => (rec[h] = row[i]));
        return rec;
      })
      .filter((rec) => {
        const d = new Date(String(rec['開催日'] || ''));
        if (isNaN(d.getTime())) return false;
        d.setHours(0, 0, 0, 0);
        const status = String(rec['ステータス'] || '');
        return d >= today && status !== '終了' && status !== 'キャンセル';
      })
      .sort((a, b) => {
        const ad = new Date(String(a['開催日'] || ''));
        const bd = new Date(String(b['開催日'] || ''));
        const at = String(a['開始時間'] || '00:00');
        const bt = String(b['開始時間'] || '00:00');
        const av = ad.getTime() + timeToMinutes(at) * 60_000;
        const bv = bd.getTime() + timeToMinutes(bt) * 60_000;
        return av - bv;
      })
      .slice(0, Math.max(0, limit));

    return records;
  } catch (e) {
    console.error('[Sheet] 直近イベント取得エラー:', e);
    return [];
  }
}

function timeToMinutes(hhmm: string): number {
  const m = String(hhmm).match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return 0;
  const h = parseInt(m[1], 10) || 0;
  const mi = parseInt(m[2], 10) || 0;
  return h * 60 + mi;
}
