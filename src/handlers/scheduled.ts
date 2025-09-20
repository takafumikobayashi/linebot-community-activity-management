/**
 * 定期実行タスクのハンドラ
 */

import {
  getAllUserIds,
  getEventsForMonth,
  getEventsForDate,
} from '../services/sheet';
import { getOrganizationConfig, getMessageTemplates } from '../utils/config';
import {
  pushConfirmParticipationWithImage,
  pushMessageWithImage,
  multicastMessages,
} from '../services/line';
import { getFallbackImages } from '../utils/env';

function isValidImageUrl(url: unknown): boolean {
  return typeof url === 'string' && /^https?:\/\//.test(url);
}

function getFallbackPool(): string[] {
  // 環境変数（スクリプトプロパティ）で明示設定された配列のみを使用
  return getFallbackImages();
}

function pickFallbackImage(key: string): string | undefined {
  const pool = getFallbackPool();
  if (!pool.length) return undefined;
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash << 5) - hash + key.charCodeAt(i);
    hash |= 0;
  }
  return pool[Math.abs(hash) % pool.length];
}

/**
 * 日付文字列を表示用にフォーマットする
 * @param dateStr YYYY/MM/DD形式の日付文字列
 * @returns MM/DD(曜日)形式の文字列
 */
function formatDateForDisplay(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      return dateStr; // 無効な日付の場合はそのまま返す
    }

    const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const weekday = weekdays[date.getDay()];

    return `${month}/${day}(${weekday})`;
  } catch (_e) {
    return dateStr; // エラー時はそのまま返す
  }
}

/**
 * 時間オブジェクトを表示用にフォーマットする
 * @param timeObj DateオブジェクトまたはHH:MM形式の文字列
 * @returns HH:MM形式の文字列
 */
function formatTimeForDisplay(timeObj: unknown): string {
  if (!timeObj) return '';

  try {
    // 既に文字列でHH:MM形式の場合はそのまま返す
    if (typeof timeObj === 'string' && /^\d{1,2}:\d{2}$/.test(timeObj)) {
      return timeObj;
    }

    // Dateオブジェクトの場合は時間部分を抽出
    let date: Date;
    if (timeObj instanceof Date) {
      date = timeObj;
    } else if (typeof timeObj === 'string') {
      date = new Date(timeObj);
    } else {
      return '';
    }

    if (isNaN(date.getTime())) {
      return '';
    }

    // Utilitiesを使用してJST(Asia/Tokyo)で時刻をフォーマット
    if (typeof Utilities !== 'undefined' && Utilities.formatDate) {
      return Utilities.formatDate(date, 'Asia/Tokyo', 'HH:mm');
    } else {
      // テスト環境用のフォールバック（UTC+9時間を追加）
      const jstDate = new Date(date.getTime() + 9 * 60 * 60 * 1000);
      const hours = jstDate.getUTCHours().toString().padStart(2, '0');
      const minutes = jstDate.getUTCMinutes().toString().padStart(2, '0');
      return `${hours}:${minutes}`;
    }
  } catch (_e) {
    return '';
  }
}

/**
 * 月初の活動予定をLINEで一斉配信する
 */
export function sendMonthlySchedule(): void {
  console.log('[Schedule] 月次予定配信処理 開始');

  try {
    const today = new Date();
    const targetYear = today.getFullYear();
    const targetMonth = today.getMonth() + 1;

    // 1. 配信対象のユーザーIDを取得
    const userIds = getAllUserIds();
    if (userIds.length === 0) {
      console.log(
        '[Schedule] 配信対象のユーザーがいません。処理を終了します。',
      );
      return;
    }

    // 2. 配信対象のイベントを取得
    const events = getEventsForMonth(targetYear, targetMonth);
    if (events.length === 0) {
      console.log(
        `[Schedule] ${targetYear}年${targetMonth}月のイベントが見つかりません。配信をスキップします。`,
      );
      return;
    }

    // 3. イベントデータを変換
    const eventData = events.map((event) => {
      const dateStr = String(event['開催日'] || '');
      const startTime = event['開始時間'];
      const endTime = event['終了時間'];
      const name = String(event['イベント名'] || '');
      const recordId = String(event['kintoneRecordId'] || '');
      const imageUrl = String(
        (event as Record<string, unknown>)['画像URL'] || '',
      );

      // recordIdが空の場合は警告を出力
      if (!recordId || recordId.trim() === '') {
        console.warn(`[Schedule] 空のrecordIdが検出されました: ${name}`);
      }

      // 日付をフォーマット（YYYY/MM/DD → MM/DD(曜日)形式）
      const formattedDate = formatDateForDisplay(dateStr);

      // 時間をフォーマット（HH:MM形式に変換）
      const formattedStartTime = formatTimeForDisplay(startTime);
      const formattedEndTime = formatTimeForDisplay(endTime);
      const timeRange =
        formattedStartTime && formattedEndTime
          ? `${formattedStartTime} - ${formattedEndTime}`
          : formattedStartTime;

      console.log(
        `[Schedule] イベントデータ: ${name}, recordId: ${recordId}, time: ${timeRange}`,
      );

      return {
        recordId,
        title: name,
        date: dateStr,
        time: timeRange,
        displayDate: formattedDate,
        imageUrl,
      };
    });

    // 4. マルチキャストで一斉配信（最大150ユーザー/回）
    const config = getOrganizationConfig();
    const templates = getMessageTemplates(config);
    const headerText = templates.monthlyScheduleHeader(targetMonth);

    // カルーセル列（最大10列）
    const columns = eventData.slice(0, 10).map((ev) => {
      const friendlyTitle = `📌 ${String(ev.title)}`.slice(0, 40);
      const friendlyText =
        `${ev.displayDate}${ev.time ? ` 🕒 ${ev.time}` : ''}`.slice(0, 60);
      const col: Record<string, unknown> = {
        title: friendlyTitle,
        text: friendlyText,
        actions: [
          {
            type: 'message',
            label: '参加する',
            text: `${ev.displayDate} 参加します`,
          },
          {
            type: 'message',
            label: '不参加',
            text: `${ev.displayDate} 不参加`,
          },
        ],
      };
      // 画像URL（シート指定 or フォールバック）
      const chosenImage = isValidImageUrl(ev.imageUrl)
        ? String(ev.imageUrl)
        : pickFallbackImage(String(ev.recordId));
      if (chosenImage) {
        col.thumbnailImageUrl = chosenImage;
        col.imageBackgroundColor = '#FFFFFF';
      }
      return col;
    });

    const messages = [
      { type: 'text', text: headerText },
      {
        type: 'template',
        altText: '月次スケジュールのご案内',
        template: { type: 'carousel', columns },
      },
    ];

    console.log(`[Schedule] ${userIds.length}人のユーザーに配信を開始します。`);
    const BATCH_SIZE = 150;
    for (let i = 0; i < userIds.length; i += BATCH_SIZE) {
      const batch = userIds.slice(i, i + BATCH_SIZE);
      try {
        multicastMessages(batch, messages);
        console.log(
          `[Schedule] バッチ配信成功 (${i + batch.length}/${userIds.length}): ${batch.length}件`,
        );
      } catch (e) {
        console.error('[Schedule] バッチ配信失敗:', e);
      }
      if (i + BATCH_SIZE < userIds.length) {
        Utilities.sleep(1000);
      }
    }

    console.log('[Schedule] 月次予定配信処理 正常終了');
  } catch (error) {
    console.error('[Schedule] 月次予定配信処理でエラーが発生しました:', error);
  }
}

/**
 * イベント前日に参加者へリマインドを送信する
 */
export function sendEventReminders(): void {
  console.log('[Schedule] 前日リマインダー処理 開始');

  try {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const events = getEventsForDate(tomorrow);
    if (events.length === 0) {
      console.log(
        '[Schedule] 翌日開催のイベントはありません。処理を終了します。',
      );
      return;
    }

    const allUserIds = getAllUserIds();
    if (allUserIds.length === 0) {
      console.log('[Schedule] 通知対象の全ユーザーが存在しません。');
      return;
    }

    console.log(
      `[Schedule] ${events.length}件のイベントがリマインド対象です。`,
    );

    for (const event of events) {
      const eventName = event['イベント名'];
      const eventTime = `${event['開始時間']}〜${event['終了時間']} `;
      const eventRecordId = String(event['kintoneRecordId'] || '');
      const imageUrl = String(
        (event as Record<string, unknown>)['画像URL'] || '',
      );

      // 画像URL（シート指定 or フォールバック）
      const chosenImage = isValidImageUrl(imageUrl)
        ? String(imageUrl)
        : pickFallbackImage(String(eventRecordId));

      const participants = new Set<string>();
      for (let i = 1; i <= 15; i++) {
        const uid = event[`出席者${i}`];
        if (typeof uid === 'string' && uid.trim() !== '') {
          participants.add(uid);
        }
      }

      const unconfirmedUsers = allUserIds.filter((id) => !participants.has(id));

      // 参加者へのリマインド
      if (participants.size > 0) {
        console.log(
          `[Schedule] 「${eventName}」の参加者${participants.size}名にリマインドを送信します。`,
        );
        const reminderMessage = `🔔 リマインダー\n📅 明日は「${eventName}」の活動日です！\n\n🕒 時間: ${eventTime}\n\n😊 お会いできるのを楽しみにしています！`;
        participants.forEach((userId) => {
          try {
            pushMessageWithImage(userId, reminderMessage, chosenImage);
          } catch (e) {
            console.error(`[Schedule] リマインド失敗: ${userId}`, e);
          }
        });
      } else {
        console.log(
          `[Schedule] イベント「${eventName}」には参加者がいません。`,
        );
      }

      // 未返信者への参加確認
      if (unconfirmedUsers.length > 0 && eventRecordId) {
        console.log(
          `[Schedule] 「${eventName}」の未返信者${unconfirmedUsers.length}名に参加確認を送信します。`,
        );
        const eventDate = String(event['開催日'] || '');
        const formattedEventDate = formatDateForDisplay(eventDate);
        const confirmText = `📝 参加確認\n📅 ${formattedEventDate}、イベント「${eventName}」（${eventTime}）があります。\nご参加されますか？`;
        unconfirmedUsers.forEach((userId) => {
          try {
            pushConfirmParticipationWithImage(
              userId,
              confirmText,
              eventRecordId,
              chosenImage,
            );
          } catch (e) {
            console.error(`[Schedule] 参加確認の送信失敗: ${userId}`, e);
          }
        });
      }

      Utilities.sleep(1000); // イベント間のスリープ
    }

    console.log('[Schedule] 前日リマインダー処理 正常終了');
  } catch (error) {
    console.error(
      '[Schedule] 前日リマインダー処理でエラーが発生しました:',
      error,
    );
  }
}

/**
 * イベント当日の夜に参加者へお礼メッセージを送信する
 */
export function sendThankYouMessages(): void {
  console.log('[Schedule] お礼メッセージ処理 開始');

  try {
    // 1. 本日の日付を取得
    const today = new Date();

    // 2. 本日開催のイベントを取得
    const events = getEventsForDate(today);
    if (events.length === 0) {
      console.log(
        '[Schedule] 本日開催のイベントはありません。処理を終了します。',
      );
      return;
    }

    console.log(
      `[Schedule] ${events.length}件のイベントがお礼メッセージの対象です。`,
    );

    // 3. イベントごとに参加者へお礼を送信
    for (const event of events) {
      const eventName = event['イベント名'];
      const eventRecordId = String(event['kintoneRecordId'] || '');
      const imageUrl = String(
        (event as Record<string, unknown>)['画像URL'] || '',
      );

      // 画像URL（シート指定 or フォールバック）
      const chosenImage = isValidImageUrl(imageUrl)
        ? String(imageUrl)
        : pickFallbackImage(String(eventRecordId));

      // 参加者IDのリストを作成（出席者1〜15）
      const participants: string[] = [];
      for (let i = 1; i <= 15; i++) {
        const uid = event[`出席者${i}`];
        if (typeof uid === 'string' && uid.trim() !== '') {
          participants.push(uid);
        }
      }

      if (participants.length === 0) {
        console.log(
          `[Schedule] イベント「${eventName}」には参加者がいません。`,
        );
        continue;
      }

      // 4. お礼メッセージを作成して送信
      const message = `🙏 活動のお礼\n本日は「${eventName}」にご参加いただき、誠にありがとうございました！\n\n✨ 皆さまのご協力のおかげで、素晴らしい活動になりました。\n😊 また次回お会いできるのを楽しみにしています！`;

      console.log(
        `[Schedule] 「${eventName}」の参加者${participants.length}名にお礼メッセージを送信します。`,
      );
      participants.forEach((userId, index) => {
        try {
          pushMessageWithImage(userId, message, chosenImage);
        } catch (e) {
          console.error(`[Schedule] お礼メッセージ失敗: ${userId}`, e);
        }
        if ((index + 1) % 20 === 0) {
          Utilities.sleep(1000);
        }
      });
    }

    console.log('[Schedule] お礼メッセージ処理 正常終了');
  } catch (error) {
    console.error(
      '[Schedule] お礼メッセージ処理でエラーが発生しました:',
      error,
    );
  }
}
