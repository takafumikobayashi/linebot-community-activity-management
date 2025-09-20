/**
 * LINE API クライアント
 */

import { getConfig } from '../utils/env';

/**
 * LINE返信メッセージを送信する
 * @param replyToken 返信トークン
 * @param text 送信テキスト
 */
export function replyMessage(replyToken: string, text: string): void {
  const config = getConfig();

  const url = 'https://api.line.me/v2/bot/message/reply';
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${config.CHANNEL_ACCESS_TOKEN}`,
  };

  const payload = {
    replyToken: replyToken,
    messages: [
      {
        type: 'text',
        text: text,
      },
    ],
  };

  const options: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions = {
    method: 'post',
    headers: headers,
    payload: JSON.stringify(payload),
  };

  try {
    const response = UrlFetchApp.fetch(url, options);
    const statusCode = response.getResponseCode();

    if (statusCode === 200) {
      console.log(`[LINE] メッセージ送信成功: ${text.substring(0, 50)}...`);
    } else {
      console.error(`[LINE] メッセージ送信失敗: ${statusCode}`);
      console.error(`[LINE] レスポンス: ${response.getContentText()}`);
    }
  } catch (error) {
    console.error('[LINE] メッセージ送信エラー:', error);
    throw error;
  }
}

/**
 * LINEプッシュメッセージを送信する
 * @param userId 送信対象ユーザーID
 * @param text 送信テキスト
 */
export function pushMessage(userId: string, text: string): void {
  const config = getConfig();

  const url = 'https://api.line.me/v2/bot/message/push';
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${config.CHANNEL_ACCESS_TOKEN}`,
  };

  const payload = {
    to: userId,
    messages: [
      {
        type: 'text',
        text: text,
      },
    ],
  };

  const options: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions = {
    method: 'post',
    headers: headers,
    payload: JSON.stringify(payload),
  };

  try {
    const response = UrlFetchApp.fetch(url, options);
    const statusCode = response.getResponseCode();

    if (statusCode === 200) {
      console.log(`[LINE] プッシュメッセージ送信成功: ${userId}`);
    } else {
      console.error(`[LINE] プッシュメッセージ送信失敗: ${statusCode}`);
      console.error(`[LINE] レスポンス: ${response.getContentText()}`);
    }
  } catch (error) {
    console.error('[LINE] プッシュメッセージ送信エラー:', error);
    throw error;
  }
}

/**
 * LINEマルチキャストメッセージを送信する
 * @param userIds 送信対象ユーザーID配列 (最大150件)
 * @param messages 送信メッセージオブジェクト配列
 */
export function multicastMessages(userIds: string[], messages: object[]): void {
  if (!userIds || userIds.length === 0) {
    console.log('[LINE] マルチキャストの宛先がいないためスキップします');
    return;
  }
  if (userIds.length > 150) {
    console.warn(
      `[LINE] マルチキャストの宛先が150件を超えています（${userIds.length}件）。150件に分割して送信します。`,
    );
  }

  const config = getConfig();

  const url = 'https://api.line.me/v2/bot/message/multicast';
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${config.CHANNEL_ACCESS_TOKEN}`,
  };

  const payload = {
    to: userIds.slice(0, 150), // 念のため150件に制限
    messages: messages,
  };

  const options: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions = {
    method: 'post',
    headers: headers,
    payload: JSON.stringify(payload),
  };

  try {
    const response = UrlFetchApp.fetch(url, options);
    const statusCode = response.getResponseCode();

    if (statusCode === 200) {
      console.log(
        `[LINE] マルチキャストメッセージ送信成功: ${userIds.length}件`,
      );
    } else {
      console.error(`[LINE] マルチキャストメッセージ送信失敗: ${statusCode}`);
      console.error(`[LINE] レスポンス: ${response.getContentText()}`);
    }
  } catch (error) {
    console.error('[LINE] マルチキャストメッセージ送信エラー:', error);
    throw error;
  }
}

/**
 * 参加確認のConfirmテンプレートをプッシュ送信する
 * @param userId 送信対象ユーザーID
 * @param text メッセージテキスト（上部に表示）
 * @param eventRecordId 対象イベントのkintoneレコードID
 */
export function pushConfirmParticipation(
  userId: string,
  text: string,
  eventRecordId: string,
): void {
  const config = getConfig();

  const url = 'https://api.line.me/v2/bot/message/push';
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${config.CHANNEL_ACCESS_TOKEN}`,
  };

  const payload = {
    to: userId,
    messages: [
      {
        type: 'template',
        altText: '参加確認: はい／いいえ',
        template: {
          type: 'confirm',
          text,
          actions: [
            {
              type: 'postback',
              label: '参加する',
              data: `rsvp:yes:${eventRecordId}`,
            },
            {
              type: 'postback',
              label: '不参加',
              data: `rsvp:no:${eventRecordId}`,
            },
          ],
        },
      },
    ],
  };

  const options: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions = {
    method: 'post',
    headers: headers,
    payload: JSON.stringify(payload),
  };

  try {
    const response = UrlFetchApp.fetch(url, options);
    const statusCode = response.getResponseCode();

    if (statusCode === 200) {
      console.log(`[LINE] 参加確認テンプレート送信成功: ${userId}`);
    } else {
      console.error(`[LINE] 参加確認テンプレート送信失敗: ${statusCode}`);
      console.error(`[LINE] レスポンス: ${response.getContentText()}`);
    }
  } catch (error) {
    console.error('[LINE] 参加確認テンプレート送信エラー:', error);
    throw error;
  }
}

/**
 * 参加確認のConfirmテンプレート（画像付き）をプッシュ送信する
 * @param userId 送信対象ユーザーID
 * @param text メッセージテキスト（上部に表示）
 * @param eventRecordId 対象イベントのkintoneレコードID
 * @param imageUrl 画像URL（オプション）
 */
export function pushConfirmParticipationWithImage(
  userId: string,
  text: string,
  eventRecordId: string,
  imageUrl?: string,
): void {
  const config = getConfig();

  const url = 'https://api.line.me/v2/bot/message/push';
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${config.CHANNEL_ACCESS_TOKEN}`,
  };

  // 画像付きメッセージを作成
  const messages: unknown[] = [];

  // 画像がある場合は先に画像メッセージを送信
  if (imageUrl) {
    messages.push({
      type: 'image',
      originalContentUrl: imageUrl,
      previewImageUrl: imageUrl,
    });
  }

  // Confirmテンプレートを追加
  messages.push({
    type: 'template',
    altText: '参加確認: はい／いいえ',
    template: {
      type: 'confirm',
      text,
      actions: [
        {
          type: 'postback',
          label: '参加する',
          data: `rsvp:yes:${eventRecordId}`,
        },
        {
          type: 'postback',
          label: '不参加',
          data: `rsvp:no:${eventRecordId}`,
        },
      ],
    },
  });

  const payload = {
    to: userId,
    messages,
  };

  const options: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions = {
    method: 'post',
    headers: headers,
    payload: JSON.stringify(payload),
  };

  try {
    const response = UrlFetchApp.fetch(url, options);
    const statusCode = response.getResponseCode();

    if (statusCode === 200) {
      console.log(`[LINE] 参加確認テンプレート（画像付き）送信成功: ${userId}`);
    } else {
      console.error(
        `[LINE] 参加確認テンプレート（画像付き）送信失敗: ${statusCode}`,
      );
      console.error(`[LINE] レスポンス: ${response.getContentText()}`);
    }
  } catch (error) {
    console.error('[LINE] 参加確認テンプレート（画像付き）送信エラー:', error);
    throw error;
  }
}

/**
 * 画像付きプッシュメッセージを送信する
 * @param userId 送信対象ユーザーID
 * @param text メッセージテキスト
 * @param imageUrl 画像URL（オプション）
 */
export function pushMessageWithImage(
  userId: string,
  text: string,
  imageUrl?: string,
): void {
  const config = getConfig();

  const url = 'https://api.line.me/v2/bot/message/push';
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${config.CHANNEL_ACCESS_TOKEN}`,
  };

  const messages: unknown[] = [];

  // 画像がある場合は先に画像メッセージを送信
  if (imageUrl) {
    messages.push({
      type: 'image',
      originalContentUrl: imageUrl,
      previewImageUrl: imageUrl,
    });
  }

  // テキストメッセージを追加
  messages.push({
    type: 'text',
    text,
  });

  const payload = {
    to: userId,
    messages,
  };

  const options: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions = {
    method: 'post',
    headers: headers,
    payload: JSON.stringify(payload),
  };

  try {
    const response = UrlFetchApp.fetch(url, options);
    const statusCode = response.getResponseCode();

    if (statusCode === 200) {
      console.log(`[LINE] プッシュメッセージ（画像付き）送信成功: ${userId}`);
    } else {
      console.error(
        `[LINE] プッシュメッセージ（画像付き）送信失敗: ${statusCode}`,
      );
      console.error(`[LINE] レスポンス: ${response.getContentText()}`);
    }
  } catch (error) {
    console.error('[LINE] プッシュメッセージ（画像付き）送信エラー:', error);
    throw error;
  }
}

/**
 * Quick Replyボタン付きメッセージを送信する
 * @param replyToken 返信トークン
 * @param text メッセージテキスト
 * @param buttons ボタン配列
 */
export function replyWithQuickReply(
  replyToken: string,
  text: string,
  buttons: Array<{ label: string; text: string }>,
): void {
  const config = getConfig();

  const url = 'https://api.line.me/v2/bot/message/reply';
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${config.CHANNEL_ACCESS_TOKEN}`,
  };

  const payload = {
    replyToken: replyToken,
    messages: [
      {
        type: 'text',
        text: text,
        quickReply: {
          items: buttons.map((button) => ({
            type: 'action',
            action: {
              type: 'message',
              label: button.label,
              text: button.text,
            },
          })),
        },
      },
    ],
  };

  const options: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions = {
    method: 'post',
    headers: headers,
    payload: JSON.stringify(payload),
  };

  try {
    const response = UrlFetchApp.fetch(url, options);
    const statusCode = response.getResponseCode();

    if (statusCode === 200) {
      console.log(`[LINE] Quick Replyメッセージ送信成功`);
    } else {
      console.error(`[LINE] Quick Replyメッセージ送信失敗: ${statusCode}`);
    }
  } catch (error) {
    console.error('[LINE] Quick Replyメッセージ送信エラー:', error);
    throw error;
  }
}
