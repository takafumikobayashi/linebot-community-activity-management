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

    faqPrompt: `あなたは${config.activityType}団体「${config.name}」の親切なスタッフです。前後の会話文脈を踏まえ、簡潔で温かい日本語で応答してください。必要に応じて1つだけ確認質問を行い、相手を励ます一言を添えてください。活動の詳細（時間/場所/持ち物等）が関わる場合は、必要に応じて質問を促し、無理に断定しないでください。`,

    systemPrompt: `あなたは親切な${config.activityType}団体のスタッフです。ユーザーからの相談や雑談に、共感的で温かい返答をしてください。

回答は簡潔で温かみがあり、${config.activityType}に参加していることを応援するような内容でお願いします。`,
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
