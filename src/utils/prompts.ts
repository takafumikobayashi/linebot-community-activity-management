/**
 * プロンプト定数とユーティリティ
 */

import { getOrganizationConfig, getMessageTemplates } from './config';

/**
 * 組織設定に基づく統一システムメッセージを取得
 */
export function getSystemMessage(): string {
  const config = getOrganizationConfig();
  const templates = getMessageTemplates(config);
  return templates.faqPrompt;
}

/**
 * 後方互換性のためのエイリアス
 * @deprecated getSystemMessage() を使用してください
 */
export const SHARED_SYSTEM_MESSAGE = getSystemMessage();
