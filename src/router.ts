/**
 * LINE イベントルーティング
 * draw.ioの分岐ロジックに基づく実装
 */

import { LineEvent } from './types/index';
import { handleFaq } from './handlers/faq';
import { replyMessage, pushMessage } from './services/line';
import { generateChatWithHistory } from './services/openai';
import {
  getConfig,
  getSingleWordFaqTriggers,
  getConversationContextConfig,
} from './utils/env';
import { getSystemMessage } from './utils/prompts';
import {
  getOrganizationConfig,
  getMessageTemplates,
  getFaqTriggerPattern,
} from './utils/config';
import {
  saveNewUser,
  getEventsForDate,
  recordRSVPInEvent,
  writeLog,
  getRecentConversationForUser,
  getUpcomingEvents,
} from './services/sheet';

/**
 * LINEイベントを処理する
 * @param event LINEイベントオブジェクト
 */
export function routeEvent(event: LineEvent): void {
  console.log(`[Router] イベント処理開始: ${event.type}`);

  switch (event.type) {
    case 'message':
      handleMessageEvent(event);
      break;
    case 'follow':
      handleFollowEvent(event);
      break;
    case 'postback':
      handlePostbackEvent(event);
      break;
    default:
      console.log(`[Router] 未対応のイベントタイプ: ${event.type}`);
      break;
  }
}

/**
 * メッセージイベントを処理する
 * draw.ioの分岐ロジック: 固定文言返信 → 特定キーワード → 質問判断
 * @param event メッセージイベント
 */
function handleMessageEvent(event: LineEvent): void {
  // テキストメッセージ以外は無視
  if (!event.message || event.message.type !== 'text' || !event.message.text) {
    replyMessage(
      event.replyToken,
      'テキストメッセージ以外はまだ対応していません。ごめんなさい！',
    );
    return;
  }

  const userMessage = event.message.text;
  const userId = event.source.userId;

  console.log(`[Router] ユーザーメッセージ: ${userMessage}`);

  // 日付指定 + RSVP（例: "9/19 参加します", "2025/09/19 不参加"）の優先ハンドリング
  // 固定文言の完全一致より先に、テキスト内に含まれるRSVP語と日付を検出して処理する
  const specifiedDate = extractMonthDayOrYmd(userMessage);
  if (specifiedDate) {
    if (containsRsvpYes(userMessage)) {
      handleRsvpBySpecifiedDate(event.replyToken, userId, specifiedDate, 'yes');
      return;
    }
    if (containsRsvpNo(userMessage)) {
      handleRsvpBySpecifiedDate(event.replyToken, userId, specifiedDate, 'no');
      return;
    }
  }

  // 最優先: FAQ トリガーフレーズ
  // ただし文面がスケジュール問い合わせの場合はFAQではなく予定応答に分岐
  if (isFaqTrigger(userMessage)) {
    if (isScheduleInquiry(userMessage)) {
      handleScheduleInquiry(event.replyToken);
    } else {
      handleFaq(event.replyToken, userMessage, userId);
    }
    return;
  }

  // ステップ0a: 日付付きRSVPメッセージの判定
  const dateRsvpMatch = parseRsvpWithDate(userMessage);
  if (dateRsvpMatch) {
    handleRsvpWithDate(
      event.replyToken,
      userId,
      dateRsvpMatch.date,
      dateRsvpMatch.status,
    );
    return;
  }

  // ステップ0b: 参加可否の固定文言（優先判定）
  if (
    isRsvpYes(userMessage) ||
    isRsvpNo(userMessage) ||
    isRsvpCancel(userMessage)
  ) {
    // 日付指定のRSVP（例: "9/19 参加します", "2025/09/19 不参加"）を優先処理
    const desired = extractMonthDayOrYmd(userMessage);
    if (desired && !isRsvpCancel(userMessage)) {
      // キャンセルは日付指定対象外。yes/noのみ日付を解釈して処理
      handleRsvpBySpecifiedDate(
        event.replyToken,
        userId,
        desired,
        isRsvpYes(userMessage) ? 'yes' : 'no',
      );
    } else {
      // 既存の固定文言ロジック（翌日のイベント1件に適用）
      handleRsvpFixedMessage(
        event.replyToken,
        userId,
        isRsvpYes(userMessage) ? 'yes' : 'no',
      );
    }
    return;
  }

  // ステップ1: 固定文言返信の判定
  if (isFixedReplyMessage(userMessage)) {
    handleFixedReply(event.replyToken, userMessage);
    return;
  }

  // ステップ1.5: スケジュール問い合わせ（活動日・日程）
  if (isScheduleInquiry(userMessage)) {
    handleScheduleInquiry(event.replyToken);
    return;
  }

  // ステップ2: 特定キーワードの検出
  if (hasAlertKeywords(userMessage)) {
    handleKeywordAlert(event.replyToken, userMessage, userId);
    return;
  }

  // ステップ2.5: 単語のみのFAQトリガー
  if (isSingleWordFaqTrigger(userMessage)) {
    handleFaq(event.replyToken, userMessage, userId);
    return;
  }

  // ステップ2.8: 雑談系の疑問はFAQではなく雑談へ
  if (isSmalltalkQuestion(userMessage)) {
    handleGeneralChat(event.replyToken, userMessage, userId);
    return;
  }

  // ステップ3: 質問判断（FAQ検索 or 雑談）
  if (isQuestionMessage(userMessage)) {
    // FAQ処理に委譲
    handleFaq(event.replyToken, userMessage, userId);
  } else {
    // 雑談・相談処理
    handleGeneralChat(event.replyToken, userMessage, userId);
  }
}

/**
 * フォローイベントを処理する
 * @param event フォローイベント
 */
function handleFollowEvent(event: LineEvent): void {
  // あいさつメッセージを送信
  const config = getOrganizationConfig();
  const templates = getMessageTemplates(config);
  replyMessage(event.replyToken, templates.welcome);

  // 新規ユーザーをシートに保存
  if (event.source.userId) {
    saveNewUser(event.source.userId);
  }

  console.log(`[Router] フォローイベント処理完了: ${event.source.userId}`);
}

/**
 * ポストバックイベントを処理する（参加確認ボタン等）
 * @param event ポストバックイベント
 */
function handlePostbackEvent(event: LineEvent): void {
  if (!event.postback) {
    return;
  }

  const data = event.postback.data;
  console.log(`[Router] ポストバック受信: ${data}`);
  // RSVP: rsvp:yes|no:<eventRecordId>
  const m = data.match(/^rsvp:(yes|no):(.+)$/);
  if (m) {
    const status = m[1] as 'yes' | 'no';
    const eventRecordId = m[2];
    console.log(
      `[Router] RSVP処理: status=${status}, eventRecordId=${eventRecordId}`,
    );

    // recordIdが空でないことを確認
    if (!eventRecordId || eventRecordId.trim() === '') {
      console.error(`[Router] 無効なrecordId: ${eventRecordId}`);
      replyMessage(event.replyToken, 'イベントIDが無効です。');
      return;
    }

    const result = recordRSVPInEvent(
      eventRecordId,
      event.source.userId,
      status,
      'postback',
    );
    console.log(`[Router] RSVP結果: ${result}`);

    switch (result) {
      case 'added':
        replyMessage(
          event.replyToken,
          '参加ありがとうございます！当日お待ちしています。',
        );
        break;
      case 'already_registered':
        replyMessage(
          event.replyToken,
          'すでに参加登録されています。変更が必要な場合は「不参加」と返信してください。',
        );
        break;
      case 'removed':
        replyMessage(
          event.replyToken,
          '不参加として承知しました。次の機会にぜひ！',
        );
        break;
      case 'not_registered':
        replyMessage(
          event.replyToken,
          '現在参加登録はありません。参加をご希望の場合は「参加する」とお知らせください。',
        );
        break;
      case 'full':
        replyMessage(
          event.replyToken,
          '申し訳ありません、このイベントは満席です。',
        );
        break;
      case 'event_not_found':
        replyMessage(
          event.replyToken,
          '対象のイベントが見つかりませんでした。',
        );
        break;
      default:
        replyMessage(event.replyToken, '不明なアクションです。');
        break;
    }
    return;
  }

  replyMessage(event.replyToken, '不明なアクションです。');
}

/**
 * 固定文言返信の判定
 * @param message ユーザーメッセージ
 * @returns 固定文言対象かどうか
 */
function isFixedReplyMessage(message: string): boolean {
  const fixedPatterns = [
    /^(はい|yes|ok|了解|わかりました)$/i,
    /^(いいえ|no|いえ|違います)$/i,
    /^(こんにちは|こんばんは|おはよう)$/i,
  ];

  return fixedPatterns.some((pattern) => pattern.test(message.trim()));
}

/**
 * FAQ トリガーフレーズ判定
 * 設定されたトリガーフレーズで始まる場合にFAQへ誘導
 */
function isFaqTrigger(message: string): boolean {
  const text = message.trim();
  const config = getOrganizationConfig();
  const pattern = getFaqTriggerPattern(config);
  return pattern.test(text);
}

/**
 * 単語だけのFAQトリガー判定
 * 正規化後、設定された単語リストのいずれかと完全一致すればFAQへ
 */
function isSingleWordFaqTrigger(message: string): boolean {
  const triggers = getSingleWordFaqTriggers();
  if (!triggers || triggers.length === 0) return false;

  const normalized = normalizeForSingleWord(message);
  if (!normalized) return false;

  return triggers.some((w) => w === normalized);
}

function normalizeForSingleWord(message: string): string {
  if (!message) return '';
  // 前後空白除去 → 末尾の句読点・記号を除去 → もう一度trim
  const s = message
    .trim()
    .replace(/[。．.!！？、，\s]+$/g, '')
    .trim();
  // スペースを含む場合は単語ではないとみなす
  if (/\s/.test(s)) return '';
  return s;
}

/**
 * 参加・不参加の固定文言判定
 */
function isRsvpYes(message: string): boolean {
  const yesPatterns = [/^参加(?:する|します)?$/i];
  return yesPatterns.some((p) => p.test(message.trim()));
}

function isRsvpNo(message: string): boolean {
  const noPatterns = [/^(?:不参加|参加しない|参加しません|欠席)$/i];
  return noPatterns.some((p) => p.test(message.trim()));
}

function isRsvpCancel(message: string): boolean {
  const cancelPatterns = [/^(?:参加取り消し|キャンセル)$/i];
  return cancelPatterns.some((p) => p.test(message.trim()));
}

// テキスト中にRSVPの肯定/否定語が含まれるか（完全一致ではなく含有判定）
function containsRsvpYes(message: string): boolean {
  const txt = (message || '').trim();
  // 「不参加」などを除外するため、否定的な語が含まれていない場合のみ肯定とみなす
  if (/(不参加|参加しない|参加しません|欠席)/i.test(txt)) {
    return false;
  }
  return /(参加します|参加する)/i.test(txt);
}

function containsRsvpNo(message: string): boolean {
  const txt = (message || '').trim();
  return /(不参加|参加しない|参加しません|欠席)/i.test(txt);
}

/**
 * メッセージ中から M/D または YYYY/M/D 形式の日付を抽出する
 * - 例: "9/19 参加します", "2025/9/19 不参加", "9/19(火) 参加します"
 * - 戻り値は厳密なYYYY/MM/DD文字列
 * - 年が無い場合: 本年で作成し、今日より過去なら翌年に繰り上げ
 */
function extractMonthDayOrYmd(message: string): string | null {
  const text = (message || '').trim();
  // YYYY/M/D or YYYY-MM-DD
  const mYmd = text.match(/(\d{4})\s*[/-]\s*(\d{1,2})\s*[/-]\s*(\d{1,2})/);
  if (mYmd) {
    const y = parseInt(mYmd[1], 10);
    const mo = parseInt(mYmd[2], 10);
    const d = parseInt(mYmd[3], 10);
    if (!isValidMonthDay(mo, d)) return null;
    return `${y}/${String(mo).padStart(2, '0')}/${String(d).padStart(2, '0')}`;
  }

  // M/D (optional weekday in parentheses)
  const mMd = text.match(
    /\b(\d{1,2})\s*[/-]\s*(\d{1,2})(?:\s*[（(][^)）]+[)）])?(?=\D|$)/,
  );
  if (mMd) {
    const mo = parseInt(mMd[1], 10);
    const d = parseInt(mMd[2], 10);
    if (!isValidMonthDay(mo, d)) return null;
    const today = new Date();
    const yearCandidate = today.getFullYear();
    const candidate = new Date(yearCandidate, mo - 1, d);
    candidate.setHours(0, 0, 0, 0);
    const today0 = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
    );
    today0.setHours(0, 0, 0, 0);
    const year = candidate < today0 ? yearCandidate + 1 : yearCandidate;
    return `${year}/${String(mo).padStart(2, '0')}/${String(d).padStart(2, '0')}`;
  }

  return null;
}

function isValidMonthDay(m: number, d: number): boolean {
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  // 簡易妥当性（31日超や2/30などの厳密チェックは不要なら省略）
  return true;
}

/**
 * 指定日付(YYYY/MM/DD)のイベントに対してRSVPを反映する
 */
function handleRsvpBySpecifiedDate(
  replyToken: string,
  userId: string,
  ymd: string,
  status: 'yes' | 'no',
): void {
  try {
    const [y, m, d] = ymd.split('/').map((v) => parseInt(v, 10));
    const target = new Date(y, m - 1, d);
    target.setHours(0, 0, 0, 0);

    // まずは直近イベントから対象日付の候補を抽出
    const events = getUpcomingEvents(50);
    const ymdString = `${y}/${String(m).padStart(2, '0')}/${String(d).padStart(2, '0')}`;
    let matched = events.filter((e) => {
      const v = String(e['開催日'] || '');
      const dt = new Date(v);
      if (isNaN(dt.getTime())) return false;
      dt.setHours(0, 0, 0, 0);
      return (
        dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d
      );
    });
    if (matched.length === 0) {
      // 年指定がない運用（テキスト起点）に備え、月日一致で再検索
      matched = events.filter((e) => {
        const v = String(e['開催日'] || '');
        const dt = new Date(v);
        if (isNaN(dt.getTime())) return false;
        dt.setHours(0, 0, 0, 0);
        return dt.getMonth() === m - 1 && dt.getDate() === d;
      });
    }
    if (matched.length === 0) {
      // さらに見つからない場合は日付でEventシートから直接取得（テスト互換）
      const direct = getEventsForDate(target);
      matched = direct.filter((e) => String(e['開催日'] || '') === ymdString);
    }

    if (matched.length === 0) {
      const friendly = formatDateForDisplay(ymdString);
      replyMessage(replyToken, `${friendly}のイベントが見つかりませんでした`);
      return;
    }
    if (matched.length > 1) {
      replyMessage(
        replyToken,
        `同日のイベントが複数あります。確認ボタンから対象を選択してください。`,
      );
      return;
    }

    const eventRecordId = String(matched[0]['kintoneRecordId'] || '');
    const eventName = String(matched[0]['イベント名'] || '');
    if (!eventRecordId) {
      replyMessage(replyToken, 'イベントIDが不明です。');
      return;
    }

    const result = recordRSVPInEvent(eventRecordId, userId, status, 'text');
    const friendly = formatDateForDisplay(
      `${y}/${String(m).padStart(2, '0')}/${String(d).padStart(2, '0')}`,
    );
    if (status === 'yes') {
      if (result === 'added') {
        replyMessage(
          replyToken,
          `✅ ${friendly}「${eventName}」への参加を承りました！`,
        );
        return;
      }
      if (result === 'already_registered') {
        replyMessage(
          replyToken,
          `📌 ${friendly}「${eventName}」にはすでに参加登録済みです`,
        );
        return;
      }
      if (result === 'full') {
        replyMessage(replyToken, '申し訳ありません、このイベントは満席です。');
        return;
      }
    } else if (status === 'no') {
      if (result === 'removed') {
        replyMessage(
          replyToken,
          `📝 ${friendly}「${eventName}」への不参加を承りました。`,
        );
        return;
      }
      if (result === 'not_registered') {
        replyMessage(
          replyToken,
          '現在参加登録はありません。参加をご希望の場合は「参加する」とお知らせください。',
        );
        return;
      }
    }
    replyMessage(replyToken, '処理中に問題が発生しました。');
  } catch (e) {
    console.error('[Router] RSVP日付指定処理エラー:', e);
    replyMessage(replyToken, '処理中に問題が発生しました。');
  }
}

/**
 * スケジュール問い合わせ判定
 * 例: 活動日はいつですか？ / 日程 / スケジュール / いつ開催 など
 */
function isScheduleInquiry(message: string): boolean {
  const text = (message || '').trim();
  // スケジュール関連のキーワードを含む場合のみスケジュール問い合わせとして判定
  const scheduleKeywords = /(活動日|活動予定|開催日|日程|スケジュール)/;
  const timeKeywords = /(いつ|何時|何日)/;

  // スケジュール関連キーワードが含まれているか、または時間を問う表現が含まれている
  return scheduleKeywords.test(text) || timeKeywords.test(text);
}

/**
 * スケジュール問い合わせ応答
 * Eventシートから今日以降の直近予定を返す
 */
function handleScheduleInquiry(replyToken: string): void {
  try {
    const events = getUpcomingEvents(3);
    if (!events || events.length === 0) {
      replyMessage(
        replyToken,
        '📅 直近の活動予定は未登録です。\nしばらくお待ちください！',
      );
      return;
    }

    const lines = ['📅 直近の活動予定'];
    for (const e of events) {
      const rec = e as Record<string, unknown>;
      const dateStr = String(rec['開催日'] || '');
      const startTime = rec['開始時間'];
      const endTime = rec['終了時間'];
      const name = String(rec['イベント名'] || '');

      // 日付をフォーマット（YYYY/MM/DD → MM/DD(曜日)形式）
      const formattedDate = formatDateForDisplay(dateStr);

      // 時間をフォーマット（HH:MM形式に変換）
      const formattedStartTime = formatTimeForDisplay(startTime);
      const formattedEndTime = formatTimeForDisplay(endTime);
      const timeRange =
        formattedStartTime && formattedEndTime
          ? `${formattedStartTime} - ${formattedEndTime}`
          : formattedStartTime;

      lines.push(`🔸 ${formattedDate} ${timeRange} ${name}`);
    }

    lines.push('');
    lines.push('📝 参加希望は「参加する」と送信してくださいね！');

    replyMessage(replyToken, lines.join('\n'));
  } catch (e) {
    console.error('[Router] スケジュール応答エラー:', e);
    replyMessage(replyToken, '予定の取得中にエラーが発生しました。');
  }
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
 * 固定文言によるRSVP処理（直近＝翌日のイベントを対象）
 */
function handleRsvpFixedMessage(
  replyToken: string,
  userId: string,
  status: 'yes' | 'no',
): void {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  const events = getEventsForDate(tomorrow);

  if (!events || events.length === 0) {
    replyMessage(
      replyToken,
      '対象イベントが見つかりません。直近のリマインドの確認ボタンから回答してください。',
    );
    return;
  }

  if (events.length > 1) {
    replyMessage(
      replyToken,
      '対象イベントが複数あります。直近のリマインドの確認ボタンから選択してください。',
    );
    return;
  }

  const eventRecordId = String(events[0]['kintoneRecordId']);
  const result = recordRSVPInEvent(eventRecordId, userId, status, 'text');

  switch (result) {
    case 'added':
      replyMessage(
        replyToken,
        '参加ありがとうございます！当日お待ちしています。',
      );
      break;
    case 'already_registered':
      replyMessage(replyToken, 'すでに参加登録されています。');
      break;
    case 'removed':
      replyMessage(replyToken, '不参加として承知しました。次の機会にぜひ！');
      break;
    case 'not_registered':
      replyMessage(
        replyToken,
        '現在参加登録はありません。参加をご希望の場合は「参加する」とお知らせください。',
      );
      break;
    case 'full':
      replyMessage(replyToken, '申し訳ありません、このイベントは満席です。');
      break;
    case 'event_not_found':
      replyMessage(replyToken, '対象のイベントが見つかりませんでした。');
      break;
    default:
      replyMessage(replyToken, '処理中に問題が発生しました。');
      break;
  }
}

/**
 * 固定文言返信を処理する
 * @param replyToken 返信トークン
 * @param message ユーザーメッセージ
 */
function handleFixedReply(replyToken: string, message: string): void {
  let reply = 'ありがとうございます！';

  if (/^(はい|yes|ok|了解|わかりました)$/i.test(message.trim())) {
    reply = 'ありがとうございます！何かご質問があればお気軽にどうぞ。';
  } else if (/^(いいえ|no|いえ|違います)$/i.test(message.trim())) {
    reply = '承知いたしました。他にご質問があればお聞かせください。';
  } else if (/^(こんにちは|こんばんは|おはよう)$/i.test(message.trim())) {
    reply =
      'こんにちは！今日もお疲れさまです。何かお手伝いできることはありませんか？';
  }

  replyMessage(replyToken, reply);
  console.log(`[Router] 固定文言返信: ${message} → ${reply}`);
}

/**
 * 特定キーワードの検出
 * @param message ユーザーメッセージ
 * @returns アラートキーワードが含まれているか
 */
function hasAlertKeywords(message: string): boolean {
  const alertKeywords = [
    'やめたい',
    '辞めたい',
    'もう無理',
    '疲れた',
    'つらい',
    'しんどい',
    '不安',
    '心配',
    '助けて',
    '困った',
    '問題',
    'トラブル',
    '体調',
    '具合',
    '病気',
    'けが',
    '怪我',
  ];

  return alertKeywords.some((keyword) => message.includes(keyword));
}

/**
 * FAQ対象のキーワードを含むかどうかを判定する
 * 例: FAQ トリガーフレーズ、「集合場所どこ」「持ち物」など
 */
// hasFaqKeywords は削除（行数削減のため）

/**
 * 特定キーワードアラート処理
 * @param replyToken 返信トークン
 * @param message ユーザーメッセージ
 * @param userId ユーザーID
 */
export function handleKeywordAlert(
  replyToken: string,
  message: string,
  userId: string,
): void {
  console.warn(
    `[Router] アラートキーワード検出 - User: ${userId}, Message: ${message}`,
  );

  const config = getConfig();
  const staffUserIds = config.STAFF_USER_ID.split(',')
    .map((id) => id.trim())
    .filter((id) => id.length > 0);

  if (staffUserIds.length === 0) {
    console.error(
      '[Router] STAFF_USER_IDが設定されていません。職員通知をスキップします。',
    );
  } else {
    const notificationMessage = `【緊急通知】
  ユーザーID: ${userId}
  ユーザーメッセージ: ${message}
  上記メッセージにアラートキーワードが含まれていました。`;

    staffUserIds.forEach((staffId) => {
      pushMessage(staffId, notificationMessage);
    });
    console.log(
      `[Router] 職員に通知を送信しました: ${staffUserIds.join(', ')}`,
    );
  }

  const supportMessage = `お疲れさまです。お話を聞かせていただき、ありがとうございます。
  スタッフが確認いたしますので、少々お待ちください。
  必要でしたら直接お電話でもお話しできます。
  一人で抱え込まず、いつでもお声かけくださいね。`;
  replyMessage(replyToken, supportMessage);
}

/**
 * 質問メッセージの判定
 * @param message ユーザーメッセージ
 * @returns 質問形式かどうか
 */
function isQuestionMessage(message: string): boolean {
  const questionPatterns = [
    /[？?]$/, // 疑問符で終わる
    /^(いつ|どこ|何|誰|どう|どのよう|なぜ|どうして)/, // 疑問詞で始まる
    /^(教えて|知りたい|わからない|分からない)/, // 質問の意図を示す
    /(方法|やり方|手順|流れ)/, // 手順を聞いている
    /(時間|場所|日程|スケジュール)/, // 具体的情報を聞いている
    /(について|に関して|関連|詳細)/, // 情報を求める表現
  ];

  return questionPatterns.some((pattern) => pattern.test(message));
}

/**
 * 雑談系の質問を検出する
 * 例: 「元気ですか？」「どうすれば元気が出ますか？」など
 */
function isSmalltalkQuestion(message: string): boolean {
  const smalltalkPatterns = [
    /(元気|ご機嫌|調子)/, // 体調・気分系
    /(気分|気持ち|落ち込|励ま|勇気|癒や|癒し)/, // メンタル系
    /(やる気|モチベ|モチベーション)/, // モチベーション系
    /(元気が出|元気出|気合|テンション)/, // 元気づけ表現
  ];
  const text = message || '';
  return smalltalkPatterns.some((p) => p.test(text));
}

/**
 * 雑談・相談処理
 * @param replyToken 返信トークン
 * @param message ユーザーメッセージ
 * @param userId ユーザーID
 */
export function handleGeneralChat(
  replyToken: string,
  message: string,
  userId: string,
): void {
  console.log(`[Router] 雑談処理: ${userId} - ${message}`);

  try {
    // 直近の会話履歴（最大3往復）を取り込み、文脈を維持
    let history: Array<{
      role: 'user' | 'assistant' | 'system';
      content: string;
    }> = [];
    try {
      if (typeof getRecentConversationForUser === 'function') {
        // 設定可能なコンテキスト拡張
        const contextConfig = getConversationContextConfig();

        const h = getRecentConversationForUser(
          userId,
          contextConfig.maxConversationPairs,
          contextConfig.maxContextHours,
        );
        if (Array.isArray(h)) history = h;
      }
    } catch (e) {
      console.warn('[Router] 会話履歴の取得に失敗しました:', e);
    }

    const chatReply = generateChatWithHistory(
      getSystemMessage(),
      history,
      message,
      200,
      0.3,
    );
    replyMessage(replyToken, chatReply);

    // 会話ログを記録（文脈維持のため）
    writeLog({
      timestamp: new Date().toISOString(),
      userId,
      message,
      response: chatReply,
    });
  } catch (error) {
    console.error(`[Router] 雑談処理エラー: ${error}`);
    replyMessage(
      replyToken,
      '申し訳ありません、雑談応答中にエラーが発生しました。',
    );
  }
}

/**
 * 日付付きRSVPメッセージを解析する
 * 例: "9/15(日) 参加します" -> { date: "9/15(日)", status: "yes" }
 * @param message ユーザーメッセージ
 * @returns 解析結果またはnull
 */
function parseRsvpWithDate(
  message: string,
): { date: string; status: 'yes' | 'no' } | null {
  // 日付形式を認識: M/D(曜日) または M/D 形式
  const dateRsvpPattern =
    /^(\d{1,2}\/\d{1,2}(?:\([日月火水木金土]\))?)\s+(参加します|参加する|不参加|参加しない)$/;
  const match = message.trim().match(dateRsvpPattern);

  if (match) {
    const date = match[1];
    const action = match[2];
    const status =
      action.includes('参加します') || action.includes('参加する')
        ? 'yes'
        : 'no';
    return { date, status };
  }

  return null;
}

/**
 * 日付を指定したRSVP処理
 * @param replyToken 返信トークン
 * @param userId ユーザーID
 * @param date 日付文字列
 * @param status 参加状況
 */
function handleRsvpWithDate(
  replyToken: string,
  userId: string,
  date: string,
  status: 'yes' | 'no',
): void {
  console.log(
    `[Router] 日付指定RSVP処理: date=${date}, status=${status}, userId=${userId}`,
  );

  try {
    // 指定された日付のイベントを検索
    const targetEvent = findEventByDisplayDate(date);

    if (!targetEvent) {
      console.warn(`[Router] 指定日付のイベントが見つかりません: ${date}`);
      replyMessage(
        replyToken,
        `${date}のイベントが見つかりませんでした。現在参加受付中のイベントをご確認ください。`,
      );
      return;
    }

    console.log(
      `[Router] 対象イベント特定: ${targetEvent.イベント名}, recordId=${targetEvent.kintoneRecordId}`,
    );

    // RSVP処理実行
    const result = recordRSVPInEvent(
      targetEvent.kintoneRecordId,
      userId,
      status,
      'text', // カルーセルから送信されたメッセージであることを記録
    );

    // 結果に応じて返信メッセージを生成
    const eventName = targetEvent.イベント名;
    let responseMessage: string;

    switch (result) {
      case 'added':
        responseMessage =
          status === 'yes'
            ? `✅ ${date}「${eventName}」への参加を承りました！当日お待ちしております。`
            : `📝 ${date}「${eventName}」への不参加を承りました。`;
        break;
      case 'removed':
        responseMessage = `🔄 ${date}「${eventName}」の参加を取り消しました。`;
        break;
      case 'already_registered':
        responseMessage = `📌 ${date}「${eventName}」にはすでに参加登録済みです。`;
        break;
      case 'not_registered':
        responseMessage = `❓ ${date}「${eventName}」には参加登録されていないため、取り消しできませんでした。`;
        break;
      case 'full':
        responseMessage = `😔 申し訳ありません。${date}「${eventName}」は満席です。`;
        break;
      case 'event_not_found':
        responseMessage = `❌ ${date}のイベントが見つかりませんでした。`;
        break;
      default:
        responseMessage = `⚠️ 処理中にエラーが発生しました。しばらく時間をおいて再度お試しください。`;
    }

    replyMessage(replyToken, responseMessage);

    // ログ記録
    writeLog({
      timestamp: new Date().toISOString(),
      userId,
      message: `${date} ${status === 'yes' ? '参加します' : '不参加'}`,
      response: responseMessage,
    });
  } catch (error) {
    console.error(`[Router] 日付指定RSVP処理エラー:`, error);
    replyMessage(
      replyToken,
      '申し訳ありません、処理中にエラーが発生しました。しばらく時間をおいて再度お試しください。',
    );
  }
}

/**
 * 表示日付からイベントを検索
 * @param displayDate 表示日付 (例: "9/15(日)")
 * @returns 該当するイベント、またはnull
 */
function findEventByDisplayDate(
  displayDate: string,
): { 開催日: string; イベント名: string; kintoneRecordId: string } | null {
  try {
    // 今日から30日以内のイベントを取得
    const upcomingEvents = getUpcomingEvents(30);

    if (!Array.isArray(upcomingEvents) || upcomingEvents.length === 0) {
      return null;
    }

    // 表示日付でマッチするイベントを検索
    for (const event of upcomingEvents) {
      const eventDisplayDate = formatDateForDisplay(String(event.開催日));

      // 完全一致または日付部分の一致を確認
      if (
        eventDisplayDate === displayDate ||
        eventDisplayDate.replace(/\([日月火水木金土]\)/, '') ===
          displayDate.replace(/\([日月火水木金土]\)/, '')
      ) {
        return {
          開催日: String(event.開催日 || ''),
          イベント名: String(event.イベント名 || ''),
          kintoneRecordId: String(event.kintoneRecordId || ''),
        };
      }
    }

    return null;
  } catch (error) {
    console.error(`[Router] イベント検索エラー:`, error);
    return null;
  }
}
