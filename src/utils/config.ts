/**
 * 組織設定とメッセージテンプレートの管理
 */

/**
 * 組織の基本設定
 */
export interface OrganizationConfig {
  name: string;
  activityType: string;
  faqTriggerPhrase: string;
}

/**
 * メッセージテンプレート設定
 */
export interface MessageTemplates {
  welcome: string;
  monthlyScheduleHeader: (month: number) => string;
  faqPrompt: string;
  systemPrompt: string;
}

/**
 * 環境変数から組織設定を取得
 */
export function getOrganizationConfig(): OrganizationConfig {
  return {
    name:
      PropertiesService.getScriptProperties().getProperty(
        'ORGANIZATION_NAME',
      ) || 'コミュニティ',
    activityType:
      PropertiesService.getScriptProperties().getProperty('ACTIVITY_TYPE') ||
      '活動',
    faqTriggerPhrase:
      PropertiesService.getScriptProperties().getProperty(
        'FAQ_TRIGGER_PHRASE',
      ) || '教えて',
  };
}

/**
 * 組織設定に基づいてメッセージテンプレートを生成
 */
export function getMessageTemplates(
  config: OrganizationConfig,
): MessageTemplates {
  return {
    welcome: `友達追加ありがとうございます！

ここでは${config.activityType}に関する質問に答えたり、活動の案内をしたりします。

質問があるときは、まず「${config.name}${config.faqTriggerPhrase}」を付けて送ってください。
例）${config.name}${config.faqTriggerPhrase} 集合場所はどこ？／${config.name}${config.faqTriggerPhrase} 持ち物は？`,

    monthlyScheduleHeader: (month: number) =>
      `📅 ${month}月の${config.activityType}予定です！\n\n各活動の参加・不参加を選択してください。`,

    faqPrompt: `あなたは${config.activityType}団体「${config.name}」のスタッフとして地域活動を支援する相談窓口AIです。敬意と共感を示し、平易で簡潔な日本語で回答してください。情報は確認可能な根拠や手順をわかりやすく示し、憶測で断定せず必要に応じて1件のみ確認質問を行ってください。利用者の主体性と安心を尊重する励ましの言葉を添え、緊急性や専門的支援が必要な際は人の担当窓口や安全な連絡方法を案内してください。`,

    systemPrompt: `あなたは${config.activityType}団体「${config.name}」の相談窓口AIです。常に共感と敬意をもって応対し、地域活動に関わる利用者が次の行動を取りやすいよう、簡潔で分かりやすく案内してください。判断が難しい場合は推測で断定せず、必要に応じて専門窓口や人の担当者へつないでください。`,
  };
}

/**
 * FAQ トリガーフレーズの正規表現パターンを生成
 */
export function getFaqTriggerPattern(config: OrganizationConfig): RegExp {
  // 全角/半角スペースを許容して組織名+教えてトリガーを検出
  const escapedName = config.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const escapedTrigger = config.faqTriggerPhrase.replace(
    /[.*+?^${}()|[\]\\]/g,
    '\\$&',
  );
  return new RegExp(`^(${escapedName}[\\s\\u3000]*${escapedTrigger})`, 'i');
}

/**
 * FAQ トリガーフレーズの除去パターンを生成
 */
export function getFaqTriggerRemovalPattern(
  config: OrganizationConfig,
): RegExp {
  const escapedName = config.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const escapedTrigger = config.faqTriggerPhrase.replace(
    /[.*+?^${}()|[\]\\]/g,
    '\\$&',
  );
  return new RegExp(
    `^(${escapedName}[\\s\\u3000]*${escapedTrigger})[\\s\\u3000]*`,
    'i',
  );
}
