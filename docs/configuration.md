# Configuration Guide

This guide explains how to configure the Community Activity Management System for your organization.

## Environment Variables

Set these variables in Google Apps Script's Properties Service (スクリプトプロパティ):

### Required Variables

```bash
# LINE Messaging API
CHANNEL_ACCESS_TOKEN=your_line_channel_access_token

# OpenAI API
OPENAI_API_KEY=your_openai_api_key

# Google Spreadsheet
SPREADSHEET_ID=your_google_spreadsheet_id

# kintone Integration
KINTONE_DOMAIN=your_kintone_domain
KINTONE_EVENT_APP_ID=your_event_app_id
KINTONE_EVENT_API_TOKEN=your_event_api_token
```

### Optional Configuration Variables

```bash
# Organization Settings (defaults provided)
ORGANIZATION_NAME=コミュニティ           # Default: コミュニティ
ACTIVITY_TYPE=活動                      # Default: 活動
FAQ_TRIGGER_PHRASE=教えて               # Default: 教えて

# AI Settings
SIMILARITY_THRESHOLD=0.75               # Default: 0.75

# FAQ Triggers (JSON array)
FAQ_SINGLE_WORD_TRIGGERS=["持ち物","集合場所","アクセス","時間","日程"]

# Fallback Images (JSON array)
FALLBACK_IMAGES=["https://example.com/image1.jpg","https://example.com/image2.jpg"]
# 画像URLが空のイベントに対し、recordIdをハッシュして決定的に割り当て（カルーセル／リマインダーで常に同じ画像が選択されます）

# Conversation Context Settings (NEW)
MAX_CONVERSATION_PAIRS=7     # Maximum conversation pairs to reference (default: 7)
MAX_CONTEXT_HOURS=24         # Time window for conversation history in hours (default: 24)
```

## Organization Customization

### Basic Setup

1. **Organization Name** (`ORGANIZATION_NAME`)
   - Default: `コミュニティ`
   - Example: `緑の会`, `地域サークル`, `ボランティア団体`

2. **Activity Type** (`ACTIVITY_TYPE`)
   - Default: `活動`
   - Example: `ボランティア活動`, `地域活動`, `清掃活動`

3. **FAQ Trigger Phrase** (`FAQ_TRIGGER_PHRASE`)
   - Default: `教えて`
   - Example: `質問`, `聞きたい`, `知りたい`

### Message Templates

The system automatically generates messages using your configuration:

#### Welcome Message

```bash
友達追加ありがとうございます！

ここでは{ACTIVITY_TYPE}に関する質問に答えたり、活動の案内をしたりします。

質問があるときは、まず「{ORGANIZATION_NAME}{FAQ_TRIGGER_PHRASE}」を付けて送ってください。
例）{ORGANIZATION_NAME}{FAQ_TRIGGER_PHRASE} 集合場所はどこ？／{ORGANIZATION_NAME}{FAQ_TRIGGER_PHRASE} 持ち物は？
```

#### Monthly Schedule Header

```bash
📅 {month}月の{ACTIVITY_TYPE}予定です！

各活動の参加・不参加を選択してください。
```

#### AI System Prompts

- FAQ responses: `あなたは{ACTIVITY_TYPE}団体「{ORGANIZATION_NAME}」の親切なスタッフです。`
- Chat responses: `あなたは親切な{ACTIVITY_TYPE}団体のスタッフです。`

## Examples

### Example 1: Volunteer Organization

```bash
ORGANIZATION_NAME=緑の会
ACTIVITY_TYPE=ボランティア活動
FAQ_TRIGGER_PHRASE=教えて
```

Result:

- Welcome: `「緑の会教えて」を付けて送ってください`
- Schedule: `📅 9月のボランティア活動予定です！`
- AI: `あなたはボランティア活動団体「緑の会」の親切なスタッフです`

### Example 2: Community Circle

```bash
ORGANIZATION_NAME=地域サークル
ACTIVITY_TYPE=地域活動
FAQ_TRIGGER_PHRASE=質問
```

Result:

- Welcome: `「地域サークル質問」を付けて送ってください`
- Schedule: `📅 9月の地域活動予定です！`
- AI: `あなたは地域活動団体「地域サークル」の親切なスタッフです`

### Example 3: Generic Community

```bash
# Use defaults - no custom variables needed
```

Result:

- Welcome: `「コミュニティ教えて」を付けて送ってください`
- Schedule: `📅 9月の活動予定です！`
- AI: `あなたは活動団体「コミュニティ」の親切なスタッフです`

## Migration from Kuruhouse

If migrating from the original Kuruhouse-specific version:

1. Set your organization variables:

   ```bash
   ORGANIZATION_NAME=あなたの組織名
   ACTIVITY_TYPE=ボランティア活動  # or your activity type
   FAQ_TRIGGER_PHRASE=教えて
   ```

2. Update your FAQ content in the spreadsheet to use generic terms

3. Test the configuration with the FAQ trigger phrase  
   - `__tests__/config.prompts.test.ts` verifies template生成・`getSystemMessage`のカスタマイズ結果  
   - `__tests__/main.test.ts` で `doPost`/`doGet`/`checkConfiguration` の防御処理を検証済み

## Advanced Configuration

### Custom FAQ Triggers

You can set multiple single-word triggers that automatically route to FAQ:

```bash
FAQ_SINGLE_WORD_TRIGGERS=["持ち物","集合場所","アクセス","時間","日程","駐車場","費用"]
```

### Image Fallbacks

Set fallback images for events without specific images. The handler hashes the event recordId so that the same event always reuses the same fallback image:

```bash
FALLBACK_IMAGES=["https://your-domain.com/default1.jpg","https://your-domain.com/default2.jpg"]
# Deterministic assignment: same recordId ⇒ same image (covered by `__tests__/scheduled.test.ts`)
```

### AI Similarity Threshold

Adjust how strict the FAQ matching is (0.0 to 1.0):

```bash
SIMILARITY_THRESHOLD=0.75  # Higher = stricter matching
```

### Conversation Context Settings

Configure how the AI maintains conversation context in casual chat:

```bash
# Conversation pairs to reference (default: 7)
MAX_CONVERSATION_PAIRS=7     # Range: 1-15, higher = more context

# Time window for conversation history (default: 24 hours)
MAX_CONTEXT_HOURS=24         # Range: 1-168, higher = longer memory

# Examples:
MAX_CONVERSATION_PAIRS=10    # Extended context for better continuity
MAX_CONTEXT_HOURS=48         # Remember conversations for 2 days

MAX_CONVERSATION_PAIRS=3     # Lightweight for performance
MAX_CONTEXT_HOURS=12         # Short-term memory only
```

## Testing Your Configuration

1. Deploy the system with your configuration
2. Send a test message: `{ORGANIZATION_NAME}{FAQ_TRIGGER_PHRASE} テスト`
3. Verify the welcome message uses your organization name
4. Check that monthly schedules use your activity type

## Troubleshooting

### Common Issues

1. **FAQ trigger not working**
   - Check `ORGANIZATION_NAME` and `FAQ_TRIGGER_PHRASE` are set correctly
   - Ensure no extra spaces in the configuration

2. **Wrong activity type in messages**
   - Verify `ACTIVITY_TYPE` is set in script properties
   - Redeploy after changing configuration

3. **Default terms still appearing**
   - Clear script cache and redeploy
   - Check all environment variables are properly set
