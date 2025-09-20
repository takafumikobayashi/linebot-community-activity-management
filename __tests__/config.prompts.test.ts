import { getMessageTemplates } from '../src/utils/config';
import { getSystemMessage } from '../src/utils/prompts';

describe('config message templates', () => {
  it('組織設定に基づいてテンプレート文言を生成すべき', () => {
    const config = {
      name: 'テスト団体',
      activityType: 'サポート活動',
      faqTriggerPhrase: '教えてね',
    };

    const templates = getMessageTemplates(config);

    expect(templates.welcome).toContain(config.name);
    expect(templates.welcome).toContain(config.activityType);
    expect(templates.welcome).toContain(config.faqTriggerPhrase);
    expect(templates.monthlyScheduleHeader(7)).toBe(
      '📅 7月のサポート活動予定です！\n\n各活動の参加・不参加を選択してください。',
    );
    expect(templates.faqPrompt).toContain(config.name);
    expect(templates.faqPrompt).toContain(config.activityType);
    expect(templates.systemPrompt).toContain(config.activityType);
  });
});

describe('getSystemMessage', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('スクリプトプロパティの設定を反映したシステムメッセージを返すべき', () => {
    const getScriptPropertiesSpy = jest
      .spyOn(global.PropertiesService as any, 'getScriptProperties')
      .mockReturnValue({
        getProperty: jest.fn((key: string) => {
          switch (key) {
            case 'ORGANIZATION_NAME':
              return 'テスト団体';
            case 'ACTIVITY_TYPE':
              return 'サポート活動';
            case 'FAQ_TRIGGER_PHRASE':
              return '教えてね';
            default:
              return null;
          }
        }),
      } as any);

    const message = getSystemMessage();

    expect(getScriptPropertiesSpy).toHaveBeenCalled();
    expect(message).toContain('テスト団体');
    expect(message).toContain('サポート活動');
  });
});
