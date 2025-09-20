# コミュニティ活動管理システム (Community Activity Management System)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Google Apps Script](https://img.shields.io/badge/Google%20Apps%20Script-4285F4?logo=google&logoColor=white)](https://script.google.com/)
[![Tests](https://img.shields.io/badge/Tests-220%20passed-green)](https://github.com/takafumikobayashi/linebot-community-activity-management)

> **🎉 Open Source Release**: This project has been open sourced and is now available for any community or organization to use and customize!

## 概要

LINEとOpenAI APIを活用した**設定可能な**コミュニティ活動管理システムです。FAQ自動応答、活動予定管理、参加者管理などの機能を提供し、任意の組織やコミュニティの運営効率化を支援します。

### ✨ 主な特徴

- **完全設定可能**: 組織名、活動タイプ、FAQトリガーフレーズを自由にカスタマイズ
- **多言語対応準備**: メッセージテンプレートベースの多言語対応インフラ
- **オープンソース**: MITライセンスで自由に利用・改変可能
- **プラグイン型設計**: 機能の追加・削除が容易

## 🚀 Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/takafumikobayashi/linebot-community-activity-management.git
cd linebot-community-activity-management

# 2. Install dependencies
npm install

# 3. Run tests to verify setup
npm test

# 4. Follow the deployment guide
# See docs/deployment-guide.md for detailed setup instructions
```

## システム構成

- **プラットフォーム**: Google Apps Script (GAS)
- **チャットボット**: LINE Messaging API
- **AI機能**: OpenAI API (GPT-4o-mini, text-embedding-3-small)
- **データ管理**: Google Spreadsheet + kintone
- **開発言語**: TypeScript
- **テスト**: Jest

## 主要機能 (8つの機能)

### 実装済み機能

1. ✅ **FAQ自動応答** - AIによる質問回答システム
   - 「組織名教えて」最優先トリガー機能
   - ベクトル検索による類似質問の検出
   - GPTによる自然な回答生成
   - 類似度閾値による回答品質制御
   - 単語トリガー対応（「持ち物」「集合場所」など）

2. ✅ **アラート配信** - 重要なお知らせの一斉配信
   - 緊急キーワード検出システム
   - 管理者向けプッシュメッセージ
   - ユーザーサポートメッセージの自動送信

3. ✅ **スプレッドシート連携** - データの保存・管理
   - FAQ データの管理
   - ログ記録システム
   - Embedding ベクトルの保存
   - ユーザー管理機能（新規フォロワーの自動保存）

4. ✅ **活動予定配信** - 月次活動スケジュールの自動配信
   - kintone からのイベント取得
   - スプレッドシートへの同期機能（重複防止・キャンセル状態管理機能付き）
   - 月初の予定一斉配信機能（カルーセル形式・RSVP ボタン付き）
   - イベント前日のリマインダー機能
   - イベント当日のお礼メッセージ機能

5. ✅ **参加確認** - 活動参加の意思確認
   - テキスト入力での参加確認（「参加する」「不参加」「キャンセル」等）
   - Confirmテンプレートによるボタン式参加確認
   - 参加状況のEventシートへの自動記録 + Participation台帳へ即時追記
   - 満席チェックと重複登録防止
   - 排他制御によるデータ整合性保証

6. ✅ **雑談対応** - AI による日常会話（文脈維持機能付き）
   - 気分・体調に関する質問の自動検出
   - モチベーション系質問への対応
   - 元気づけ・励まし系会話への対応
   - カジュアルな会話への自然な応答
   - **NEW**: 会話履歴を参照した文脈維持機能（最大7往復、24時間以内）
   - **設定可能なコンテキスト**: 環境変数で往復数・時間範囲を調整可能

7. ✅ **参加者管理（高度機能）**
   - 基礎はParticipation台帳（真実の記録）を導入済み
   - 未実装: 参加統計・ランキング・ダッシュボード、未回答者の自動再通知、待機/繰上げ管理

8. ✅ **スケジュール問い合わせ機能** - 活動日程に関する質問への自動応答
   - 「活動日」「日程」「スケジュール」等のキーワード検出
   - スプレッドシートから今日以降の直近イベントを自動取得
   - 日付・時間順でのソート表示（親しみやすい絵文字付きフォーマット）
   - 「組織名教えて」との優先順位制御
   - テスト: 統合テスト `__tests__/e2e.schedule.test.ts` を追加（「組織名教えて + 活動日はいつですか？」でEventシートの予定を返信することを検証）

## 🔧 組織設定（カスタマイズ）

このシステムは完全に設定可能で、任意の組織やコミュニティに対応できます：

### 基本設定

```bash
# Google Apps Script のスクリプトプロパティに設定
ORGANIZATION_NAME=あなたの組織名      # 例: "地域サークル", "清掃クラブ"
ACTIVITY_TYPE=活動の種類             # 例: "ボランティア活動", "地域活動"
FAQ_TRIGGER_PHRASE=教えて            # 例: "質問", "聞きたい"
```

### カスタマイズ例

#### ボランティア団体の場合

- `ORGANIZATION_NAME=緑の会`
- `ACTIVITY_TYPE=ボランティア活動`
- FAQトリガー: `緑の会教えて 集合場所はどこ？`

#### 地域サークルの場合

- `ORGANIZATION_NAME=地域サークル`
- `ACTIVITY_TYPE=地域活動`
- FAQトリガー: `地域サークル教えて 参加費はいくら？`

📖 詳細は [docs/configuration.md](docs/configuration.md) をご覧ください。

## プロジェクト構造

```bash
kuru2-lineaibot-volunteer/
├── src/                      # ソースコード
├── __tests__/               # テスト
├── docs/                     # ドキュメント
├── CLAUDE.md                 # 開発者向けガイド
├── package.json              # npm設定
└── README.md                 # このファイル
```

## 環境設定

### 必要な環境変数

Google Apps Script のスクリプトプロパティに以下を設定してください：

```bash
OPENAI_API_KEY=your_openai_api_key
CHANNEL_ACCESS_TOKEN=your_line_channel_access_token
SIMILARITY_THRESHOLD=0.75
SPREADSHEET_ID=your_google_spreadsheet_id
KINTONE_DOMAIN=your_kintone_domain
KINTONE_EVENT_APP_ID=your_event_app_id
KINTONE_EVENT_API_TOKEN=your_event_api_token
FAQ_SINGLE_WORD_TRIGGERS=["持ち物","集合場所","アクセス","時間","日程"]  # 任意（JSON配列 or CSV）
# 月次カルーセル用のデフォルト画像（画像URLが空のときに使用、任意）
# JSON配列 または CSV で指定可能（HTTPS公開URLのみ）
# 例:
# FALLBACK_IMAGES=["https://cdn.example.com/images/volunteer-1.jpg","https://cdn.example.com/images/volunteer-2.jpg"]
# または
# FALLBACK_IMAGES=https://cdn.example.com/images/volunteer-1.jpg,https://cdn.example.com/images/volunteer-2.jpg

# 会話コンテキスト設定（NEW）
MAX_CONVERSATION_PAIRS=7     # 雑談で参照する最大往復数（デフォルト: 7）
MAX_CONTEXT_HOURS=24         # 会話履歴の有効時間（時間、デフォルト: 24）
```

補足（署名検証に関する将来の設定・現状は未使用）:

- CHANNEL_SECRET: LINE Channel Secret（将来、`X-Line-Signature` 検証をプロキシまたはGASで行う場合に使用）
- PROXY_SHARED_SECRET: プロキシ→GAS間の改ざん検知用共有鍵（将来、プロキシ採用時に使用）

### Google Spreadsheet 構成

以下のシートを作成してください：

1. **FAQ シート**
   - A列: 質問 (question)
   - B列: 回答 (answer)
   - C列: Embedding (JSON形式のベクトル)

2. **Log シート**
   - A列: タイムスタンプ
   - B列: ユーザーID
   - C列: メッセージ
   - D列: 応答
   - E列: 類似度
   - 用途補足: 雑談の文脈保持のため、直近の会話ペア（メッセージ/応答）を参照します（既定: 7往復、24時間以内）。
   - 機能詳細: ユーザーごとに会話履歴を記録し、AIが前の会話を踏まえて一貫性のある応答を生成します。
   - 設定可能: MAX_CONVERSATION_PAIRS（往復数）、MAX_CONTEXT_HOURS（時間範囲）で調整可能

3. **Users シート** (NEW)
   - A列: ユーザーID
   - B列: 登録日時

4. **Event シート** (NEW)
   - A列: kintoneRecordId （**RSVP機能に必須**。kintone同期で自動設定）
   - B列: ステータス
   - C列: イベント名
   - D列: 開催日
   - E列: 開始時間
   - F列: 終了時間
   - G列〜U列: 出席者1〜15 (参加確認機能で使用)

5. **Participation シート** (NEW)
   - 自動作成: 初回のRSVP成功時に自動生成され、ヘッダーも自動付与されます
   - 列: `timestamp`, `eventRecordId`, `userId`, `action(yes|no|...)`, `source(text|postback|admin)`, `note`
   - 用途: 参加履歴レジャー（真実の台帳）。Eventは表示用ビュー、Participationは履歴・集計・監査の基盤

## 文脈維持機能の詳細 (NEW)

### 実装した機能

新しく追加した文脈維持機能により、AIが以前の会話を覚えて一貫性のある応答を行います：

1. **会話履歴の記録・取得**
   - `writeLog()`: ユーザーメッセージと応答をLogシートに記録
   - `getRecentConversationForUser()`: 指定ユーザーの直近N往復の会話を取得
   - パフォーマンス最適化: 最大200行の読み込み制限
   - **時間ベースフィルタリング**: 指定時間以内の会話のみ取得（デフォルト24時間）

2. **統一システムメッセージによる文脈継承強化** (NEW)
   - `generateChatWithHistory()`: OpenAI Chat APIへの直接統合による履歴付き会話生成
   - `KURUHOUSE_SYSTEM_MESSAGE`: 共有システムメッセージ定数（`src/utils/prompts.ts`）
   - FAQ応答と雑談応答で統一されたAI応答品質を実現
   - temperature: 0.3（文脈重視で安定化）、frequency_penalty: 0.2（反復抑止）
   - FAQ不一致時も同一システムメッセージで雑談にフォールバック（履歴参照あり）

3. **ルーティング統合**
   - `handleGeneralChat()`で文脈維持機能を統合
   - エラーハンドリングとフォールバック機能
   - ISOタイムスタンプでの会話ログ記録

4. **設定可能なコンテキスト** (NEW)
   - `getConversationContextConfig()`: 環境変数からコンテキスト設定を取得
   - MAX_CONVERSATION_PAIRS: 最大往復数（デフォルト: 7）
   - MAX_CONTEXT_HOURS: 会話履歴の有効時間（デフォルト: 24時間）

### 技術的な実装ポイント

- **メッセージ配列**: historyは `{ role: 'user' | 'assistant', content: string }[]`、systemは別途先頭に付与
- **温度/ペナルティ**: temperature=0.3、frequency_penalty=0.2（反復抑止）、presence_penalty=0.0
- **履歴制限**: デフォルト7往復（14件）、環境変数で調整可能
- **時間フィルタリング**: 24時間以内の会話のみ取得、環境変数で調整可能
- **フィルタリング**: ユーザーID別の会話履歴取得（Log末尾最大200行から抽出）
- **フォールバック**: FAQ不一致時は同一のsystem+history方式で雑談へ切替
- **エラー処理**: 履歴取得失敗時はhistory空で動作継続、テスト環境対応済み

### 使用例

```typescript
// 履歴なしの場合
ユーザー: "今日は良い天気ですね"
AI: "そうですね！良い天気だと気分も上がりますね。"

// 履歴ありの場合（前回: "散歩に行きたい"）
ユーザー: "今日は良い天気ですね"
AI: "そうですね！先ほど散歩のお話をされていましたが、今日みたいな日はお散歩日和ですね。"
```

### 設定例

```bash
# 会話コンテキストを拡張したい場合
MAX_CONVERSATION_PAIRS=10    # 最大10往復まで参照
MAX_CONTEXT_HOURS=48         # 48時間以内の会話を対象

# 軽量な設定にしたい場合
MAX_CONVERSATION_PAIRS=3     # 最大3往復のみ参照
MAX_CONTEXT_HOURS=12         # 12時間以内の会話を対象
```

## 開発者向け情報

開発・保守に関する詳細情報は **[CLAUDE.md](./CLAUDE.md)** を参照してください：

- 開発環境セットアップ
- コーディング規約・テスト方法
- アーキテクチャ・実装パターン
- デバッグ・トラブルシューティング

## テスト

**テスト概要**: 10スイート、220テスト、90%以上カバレッジ

詳細なテスト構成・実行方法は [CLAUDE.md](./CLAUDE.md) を参照してください。

## デプロイ手順

### 環境別デプロイ対応

本プロジェクトは開発（dev）、ステージング（stg）、本番（prod）の3環境をサポートしています。

#### 初回セットアップ

1. 各環境用のGoogle Apps Scriptプロジェクトを作成
2. テンプレートから設定ファイルを作成し、スクリプトIDを設定:

   ```bash
   cp .clasp.dev.json.template .clasp.dev.json
   cp .clasp.stg.json.template .clasp.stg.json
   cp .clasp.prod.json.template .clasp.prod.json
   ```

#### デプロイコマンド

```bash
# 開発環境へのデプロイ
npm run deploy        # または npm run deploy:dev

# ステージング環境へのデプロイ  
npm run deploy:stg

# 本番環境へのデプロイ
npm run deploy:prod
```

詳細な設定手順は [Deployment Guide](docs/deployment-guide.md) を参照してください。

### Google Apps Script へのデプロイ（従来手順）

1. [Google Apps Script](https://script.google.com/) でプロジェクトを作成
2. clasp設定ファイル（`.clasp.*.json`）にスクリプトIDを設定
3. スクリプトプロパティで環境変数を設定
4. LINE Webhook URL として GAS の Web アプリ URL を設定
5. 必要な Google API を有効化

### LINE Messaging API 設定

1. [LINE Developers Console](https://developers.line.biz/) でチャンネル作成
2. Webhook URL を GAS の Web アプリ URL に設定
3. チャンネルアクセストークンを取得・設定

## 📚 Documentation

### User Guides

- **[Configuration Guide](docs/configuration.md)** - Organization customization and environment setup
- **[Deployment Guide](docs/deployment-guide.md)** - Step-by-step deployment instructions
- **[FAQ Data Samples](docs/sample-faq-data.md)** - Template FAQ content for your organization

### Developer Documentation

- **[CLAUDE.md](CLAUDE.md)** - Complete developer guide with coding standards and implementation details
- **[Technical Overview](docs/technical-overview.md)** - System architecture and design patterns
- **[API Reference](docs/api-reference.md)** - Detailed API documentation and usage examples

### Getting Started

1. 📖 Read the [Configuration Guide](docs/configuration.md) to understand customization options
2. 🚀 Follow the [Deployment Guide](docs/deployment-guide.md) to set up your system
3. 💬 Customize FAQ content using [sample templates](docs/sample-faq-data.md)
4. 🛠️ For development, consult [CLAUDE.md](CLAUDE.md) and [Technical Overview](docs/technical-overview.md)

## API仕様

### LINE Webhook エンドポイント

```bash
POST /webhook
Content-Type: application/json

{
  "events": [
    {
      "type": "message",
      "message": {
        "type": "text",
        "text": "ユーザーメッセージ"
      },
      "replyToken": "reply_token",
      "source": {
        "userId": "user_id"
      }
    }
  ]
}
```

### メッセージ処理の優先順位

router.tsでは以下の優先順位でメッセージを処理します：

1. **最優先：「組織名教えて」トリガー** - FAQ処理へ即座に誘導（ただしスケジュール問い合わせの場合は予定応答）
2. **日付指定RSVP処理** - 「9/15(日) 参加します」「9/20 不参加」等の日付付き参加意思表示（NEW）
3. **RSVP固定文言処理** - 「参加する」「不参加」「キャンセル」等の参加意思表示
4. **固定文言返信** - 「はい」「こんにちは」等の定型あいさつ
5. **スケジュール問い合わせ検出** - 「活動日」「日程」「スケジュール」「いつ」等のキーワード
6. **アラートキーワード検出** - 「やめたい」「困った」等の緊急対応
7. **単語トリガー** - 「持ち物」「集合場所」等の単語でFAQ誘導
8. **雑談質問検出** - 「元気ですか？」等の気分・励まし系質問
9. **一般質問判定** - 質問形式ならFAQ、そうでなければ雑談処理

補足: 雑談は直近の会話履歴（既定: 7往復、24時間以内）を参照し、前後の文脈がつながるように応答します。
FAQフォールバック: FAQ検索の類似度が閾値未満の場合は、固定の「情報なし」メッセージではなく雑談応答に自動フォールバックします（履歴参照あり）。

**統一システムメッセージによる文脈継承機能の詳細** (NEW):

- `KURUHOUSE_SYSTEM_MESSAGE`: FAQ応答と雑談応答で共通のシステムメッセージ定数
- `generateChatWithHistory()`: OpenAI Chat APIへの直接統合による履歴付き会話生成
- ユーザーごとに会話履歴を`Log`シートから自動取得（最大7往復、24時間以内）
- FAQ不一致時も同一システムメッセージで雑談フォールバック
- エラー時は空履歴配列で処理継続（応答品質は統一システムメッセージで保持）
- 設定可能なコンテキスト: MAX_CONVERSATION_PAIRS、MAX_CONTEXT_HOURS で調整可能

### 参加確認（RSVP）のpostback仕様

- 形式: `rsvp:yes:<eventRecordId>` または `rsvp:no:<eventRecordId>`
- 動作:
  - yes: Eventシートの出席者1〜15の空きセルにユーザーIDを追加（重複は無視）。満席時は案内を返答。
  - no: 既に登録済みなら該当セルを空にして削除、未登録ならその旨を返答。
  - 競合対策: `LockService`で該当行更新をロック

### 固定文言での参加確認

- **肯定**: 「参加する」「参加します」
- **否定**: 「不参加」「参加しない」「参加しません」「欠席」  
- **取消**: 「キャンセル」「参加取り消し」
- 固定文言は「翌日のイベントが1件」の場合に自動適用（複数ある場合はボタンで選択を促す）

## 参加確認機能 (NEW)

### 実装済みの参加確認機能

1. **テキスト入力式参加確認**
   - 「参加する」「不参加」の固定文言対応
   - 翌日開催イベントの自動判定
   - 複数イベント時のエラーハンドリング
   - 日付指定RSVP（テキスト起点）対応（NEW）
     - 例: 「9/15 参加します」「9/15(日) 不参加」「2025/09/15 参加します」
     - 年なし指定は「本年の未来→本年」「過去→翌年」として解釈
     - 直近イベントから「年/月/日」一致→見つからなければ「月/日」一致で厳密に特定
     - 同日複数イベント時は確認ボタンで対象選択を案内

2. **Confirmテンプレート式参加確認**
   - リマインダー時の「参加する」/「不参加」ボタン
   - ポストバックデータでのイベント特定
   - イベント毎の個別管理

3. **RSVPデータ管理**
   - Eventシートの出席者1～15列への自動記録
   - Participationシートに即時追記（action=yes/no、source=text/postback を記録）
   - 排他制御（LockService）でのデータ整合性保証
   - 満席チェックと重複登録防止
   - 8種類の結果コードで細かい状態管理

### 使用方法

```javascript
// テキスト入力での参加確認
ユーザー: "参加する"  // 翌日のイベントに自動参加登録
ユーザー: "不参加"    // 翌日のイベントから除外

// 日付を含むテキストでの参加確認（NEW）
ユーザー: "9/15 参加します"      // 当年の9/15に参加登録（過去なら翌年）
ユーザー: "9/15(日) 不参加"      // 当該日付のイベントを不参加に
ユーザー: "2025/09/15 参加します" // 指定年のイベントに参加登録

// ボタン式での参加確認
pushConfirmParticipation(userId, message, eventRecordId);
// → ユーザーがボタンを押すと自動でRSVP処理
```

### 参加履歴レジャー（Participation）

- 目的: 参加の状態変化を「一件一行」で記録する真実の台帳。
- 自動作成: 初回のRSVP成功時に `Participation` シートを自動生成し、ヘッダーも自動付与。
- 記録内容: `timestamp, eventRecordId, userId, action(yes/no), source(text/postback), note`。
- 記録条件: 状態変化があった時のみ記録（already_registered / not_registered / full などは記録しない）。
- 利用例: 未回答者抽出、参加率・再通知効果の分析、監査トレース。

## 定期実行機能

### 実装済みの定期実行機能

1. **kintoneイベント同期** (`syncEventsFromKintone`)
   - kintoneからイベントデータを取得
   - スプレッドシートEventシートに保存・更新（Upsert）
   - 同一の `kintoneRecordId` は追加せず更新（厳密突合）
   - 取得対象月の既存行のうち、`kintoneRecordId` が取得結果に含まれない「未開催」の行だけを「キャンセル」に更新
   - 取得0件時は安全のため「キャンセル」更新をスキップ（誤キャンセル防止）
   - 以前「キャンセル」だった行が再取得された場合は「未開催」に復活

2. **月次予定配信** (`sendMonthlySchedule`)
   - 月初に全ユーザーへ活動予定をカルーセル形式で一斉配信
   - 各活動に「参加する」「不参加」ボタンを付与（メッセージ送信方式）
   - ボタンタップで「日付 参加します」形式のメッセージを自動送信
   - 日付指定RSVP機能: 送信されたメッセージから自動でイベント特定・参加登録
   - 日付フォーマットの統一（M/D(曜日)形式）
   - 親しみやすい絵文字付きメッセージ
   - 送信方式をマルチキャストに変更（150ユーザー/回でバッチ送信、バッチ間1秒待機）
   - カルーセルはLINE仕様上 最大10列（イベント数が多い場合は先頭10件を配信）
   - 表示改善: タイトル/本文に親しみやすい絵文字を追加（例: 📌, 🕒）
   - 画像対応: Eventシートに「画像URL」列がある場合、サムネイル画像を表示（HTTPS公開URL）
   - 画像フォールバック: 「画像URL」が空/無効のときはデフォルト画像リストから決定的に選択
   - 設定: GASスクリプトプロパティ `FALLBACK_IMAGES`（JSON配列 or CSV、HTTPS公開URL）
   - 同一イベントは毎回同じデフォルト画像になるように割り当て（recordIdベース）

3. **前日リマインダー（参加確認ボタン付き）** (`sendEventReminders`)
   - イベント前日に参加者へConfirmテンプレート（「参加する/不参加」）を送信
   - 親しみやすい絵文字付きの文面（NEW）: 例「🔔 リマインダー / 📅 明日は… / 🕒 時間: …」
   - **画像表示対応（NEW）**: 月次カルーセルと同じ画像ロジック（Eventシート「画像URL」→ フォールバック画像）
   - postbackデータ: `rsvp:yes|no:<eventRecordId>`
   - 参加者情報は出席者1〜15カラムから取得

4. **お礼メッセージ** (`sendThankYouMessages`)
   - イベント当日夜に参加者へお礼メッセージ送信
   - 親しみやすい絵文字付きの文面（NEW）: 例「🙏 活動のお礼 / ✨ 皆さまのご協力… / 😊 また次回…」
   - **画像表示対応（NEW）**: 月次カルーセルと同じ画像ロジック（Eventシート「画像URL」→ フォールバック画像）
   - 参加者への感謝の気持ちを伝達

### 実行方法

```javascript
// Google Apps Script のトリガーで設定
syncEventsFromKintone();       // 毎日実行
sendMonthlySchedule();         // 月初実行
sendEventReminders();          // 毎日夜実行
sendThankYouMessages();        // 毎日夜実行
```

## 品質保証・テスト戦略

### 多層テスト構造

1. **ユニットテスト** (217テスト) - 各機能の詳細動作確認
2. **E2E統合テスト** (4テスト) - ユーザーシナリオ全体の動作確認
3. **要件トレーサビリティ** - requirements.feature ↔ テストケースの対応

### テスト実行

```bash
# 全テスト実行（ユニット + E2E）
npm test

# E2Eテストのみ
npm test -- __tests__/e2e.test.ts

# 特定ペルソナのテスト確認
npm test -- -t "スポットワーカー"
```

### 要件ベース開発

新機能開発時は以下の順序で実施：

1. `requirements.feature` にビジネス要件追加
2. 設計書でアーキテクチャ決定
3. テストケース作成（TDD）
4. 実装・テスト実行
5. ドキュメント整合性確認

## よくある問題

### 利用者向け

1. **メッセージが反応しない**: 「組織名教えて」を付けて質問してください
2. **参加登録ができない**: 「参加する」または「9/15 参加します」で入力してください
3. **活動日程がわからない**: 「活動日はいつですか？」と質問してください

### 管理者向け

1. **OpenAI API エラー**: API キーとクォータを確認
2. **スプレッドシート権限エラー**: GAS サービスアカウントの権限確認
3. **LINE Webhook エラー**: SSL証明書と URL 設定を確認
4. **kintone 接続エラー**: ドメインと API トークンを確認

開発者向けの詳細なトラブルシューティングは [CLAUDE.md](./CLAUDE.md) を参照してください。

## 利用ガイド（ユーザー向け）

### 質問のしかた（FAQへ誘導）

- **最優先トリガー**: 「組織名教えて」
  - 例: 「組織名教えて 集合場所はどこ？」「組織名教えて 持ち物は？」
  - 他のキーワードより優先され、確実にFAQ検索が実行されます
  
- **単語トリガー**: 特定の単語だけでもFAQ検索可能
  - 例: 「持ち物」「集合場所」「アクセス」「時間」
  - スペースを含む場合は通常の質問として処理されます

- **質問形式**: 通常の質問文も自動検出
  - 例: 「集合場所について教えて」「持ち物は何が必要ですか？」
  - 疑問符（？）や疑問詞（いつ、どこ、何など）で自動判定

### スケジュール問い合わせ (NEW)

活動日程に関する質問は専用の機能で自動応答します：

- **スケジュール問い合わせキーワード**:
  - 「活動日」「活動予定」「開催日」「日程」「スケジュール」
  - 「いつ」「何時」「何日」
  - 例: 「活動日はいつですか？」「次の日程を教えて」「組織名教えて スケジュール」

- **応答内容**:
  - 今日以降の直近イベント（最大3件）
  - 開催日、開始・終了時間、イベント名を表示
  - 日付・時間順でソート表示
  - イベントがない場合は「直近の活動予定は未登録です」と応答

### 雑談のしかた（カジュアルな会話）

システムが自動で雑談質問を検出し、FAQ検索ではなく雑談AIで応答します：

- **気分・体調系**: 「元気ですか？」「調子はどう？」
- **励まし・モチベーション系**: 「やる気が出ないです」「元気が出る方法は？」
- **一般的な会話**: 「今日の天気は良いですね」

**文脈保持機能**: 直近の会話（既定: 7往復、24時間以内）を参照して、会話の前後関係がつながるように応答します。

- 履歴取得失敗時は通常の雑談モードで動作
- パフォーマンス対策：Logシートから最大200行のみ読込
- ユーザー別の会話フィルタリング

**活動情報の使い分け**：

- 活動日程・スケジュール → 専用機能で自動応答
- 具体的な情報（場所/持ち物/詳細） → 「組織名教えて」を付けて質問

### 参加可否の回答

- **前日リマインド**: 「参加する/不参加」ボタンで回答
- **固定文言**: 「参加する」「不参加」「キャンセル」「参加取り消し」
- 翌日のイベントが1件の場合に自動適用されます

## Git Hooks（秘密情報の漏洩ガード）

本リポジトリには、コミット前に機密情報の混入を検出する pre-commit フックを同梱しています。

- 有効化（初回のみ）:
  - フックの配置パスを .githooks/ に設定:
  - git config core.hooksPath .githooks
- 実行権限を付与（必要に応じて）:
  - chmod +x .githooks/pre-commit

- 検出対象の例（代表）:
  - 秘密鍵: -----BEGIN ... PRIVATE KEY-----
  - OpenAIトークン: sk-...
  - AWSキー: AKIA... / AWS_SECRET_ACCESS_KEY=...
  - メールアドレス: `name@example.com` など
  - 認証情報を含むURL: `https://user:pass@host/`...
  - Markdownの ID: @something 表記（個人IDの誤掲載）
  - Markdownの ID: @something 表記（個人IDの誤掲載）
- 除外・緩和:
  - {{KEY}} 形式のプレースホルダ行
  - docs/.secrets.env（.gitignore 済み）
- 一時的にスキップする場合（推奨しません）:
  - LEAK_BYPASS=1 git commit -m "..."
  - または（全フックを無効化）:
  - git commit --no-verify -m "..."

- ドキュメントの秘密情報の扱い:
  - ドキュメントには実値を直書きせず、必ず {{KEY}} で記述してください。
  - ローカル専用の実値は docs/.secrets.env に定義します（コミット禁止）。
  - 置換は clean/smudge フィルタで自動化（.gitattributes, scripts/smudge.sh, scripts/clean.sh）。

補足

- すでに pre-commit フック本体は追加済み（.githooks/pre-commit）。未有効化の場合は「有効化（初回のみ）」
の2コマンドを実行してください。
- 今後、個人IDやメールなどを設計書に記載する必要が生じた際は、{{KEY}} でのプレースホルダ化をご利用くださ
い。必要なら設計書内の該当セクションもテンプレ化します。

## 貢献者

- プロジェクト作成: [あなたの名前]
- AI アシスタント: Claude (Anthropic)

---

**最終更新**: 2025年9月20日
**バージョン**: 1.5.0 (会話コンテキスト拡張機能追加：7往復・24時間・設定可能)

## 実装状況サマリー

### ✅ 完了した機能 (8/8 機能)

- **FAQ自動応答システム** - 「組織名教えて」最優先トリガー対応
- **アラート配信機能** - 緊急キーワード検出・通知システム  
- **スプレッドシート連携** - データ管理とユーザー管理
- **活動予定配信** - 5つの定期実行機能（同期・カルーセル配信・リマインド・お礼・重複防止）
- **参加確認機能** - テキスト・ボタン両対応のRSVPシステム
- **雑談対応機能** - 気分・励まし系質問の自動検出・応答
- **参加者管理（基礎）** - Participation台帳で参加履歴を一件一行で記録（Eventはビュー、Participationは履歴基盤）
- **スケジュール問い合わせ機能** - 活動日程に関する質問への自動応答システム

### 🔧 テスト実装状況

- **10つのテストスイート、220個のテストケース**（スケジュール問い合わせ機能・月次カルーセル配信機能・画像付きリマインダー機能・会話コンテキスト拡張機能対応）
- **カバレッジ**: 主要機能100%、回帰テスト充実
- **モック駆動型テスト設計**で安定した品質保証
- **最新テスト**: router.tsの優先順位ロジック完全対応
- **E2E統合テスト**: 実際のユーザーシナリオを模擬したワークフローテスト

### 📈 次の開発予定（オプション機能）

- 統計/ランキング/ダッシュボード: Participationを基盤に可視化
- 未回答者の自動再通知: セグメント抽出＋期日/回数制御
- 待機リスト/繰上げ管理: 定員超の繰上げ通知（自動/半自動）
- 当日チェックイン: RSVPと出席の分離（action=checkin）
- 署名検証のプロキシ化: `X-Line-Signature` をプロキシで検証＋GAS側時刻窓検証

## 技術的特徴

### アーキテクチャ

- **マイクロサービス構成**: 機能別に分離されたサービス層
- **モジュラー設計**: handlers/services/utilsの明確な分離
- **型安全性**: TypeScript strictモードでの開発

### 品質保証

- **包括的テスト**: 全主要機能に対するユニットテスト
- **モック駆動**: 外部API依存を排除した安定テスト
- **回帰テスト**: 機能追加時のデグレード防止

### セキュリティ

- **排他制御**: LockServiceでの同時実行制御
- **入力バリデーション**: 無効なデータのフィルタリング
- **エラーハンドリング**: 例外時の適切なユーザーフィードバック
- **会話ログの取り扱い**: Logシートに会話内容（ユーザーメッセージ/応答）を保存します。個人情報の扱いに注意し、保存期間やアクセス制御の設定を推奨します。

#### LINE署名検証（暫定方針）

- **現状**: ミニマム構成のため、`X-Line-Signature` の検証は一旦「未実装」。GASの仕様上、Webhookヘッダーに直接アクセスできない制約もあります。
- **リスク**: WebアプリURLが第三者に知られた場合、改ざん・なりすまし・リプレイによる不正リクエストの受け入れリスクがあります。
- **当面の運用**: WebアプリURLの秘匿、監視ログの確認（短時間の大量アクセスや不自然なイベントを確認）、必要に応じたURL再デプロイでのローテーション。
- **今後の対策案**: 信頼できるプロキシ（Cloudflare Workers / Cloud Functions / Cloud Run 等）でLINE署名を検証し、生ボディを改変せずにGASへ転送。GAS側は `PROXY_SHARED_SECRET` と時刻トークンで再検証（リプレイ防止）。必要になった時点で `CHANNEL_SECRET`/`PROXY_SHARED_SECRET` を導入し、有効化します。
