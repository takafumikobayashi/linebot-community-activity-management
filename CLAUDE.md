# Claude Code Assistant Guide

## プロジェクト概要

**LINE × AI コミュニティ活動管理システム**：

- LINE Messaging API + OpenAI API + Google Apps Script
- TypeScript + Jest（11スイート、243テスト）
- 全8機能実装完了（v1.4.0）

### システム構成

- **プラットフォーム**: Google Apps Script (GAS)
- **チャットボット**: LINE Messaging API
- **AI機能**: OpenAI API (GPT-4o-mini, text-embedding-3-small)
- **データ管理**: Google Spreadsheet + kintone
- **開発言語**: TypeScript
- **テスト**: Jest

## 開発ルール

### 必須実行手順

```bash
# 開発前の確認
npm run typecheck  # TypeScript型チェック
npm run lint       # ESLint + Prettier
npm test           # 全テスト実行（243テスト）

# コミット前の必須確認
npm run lint && npm test && npm run typecheck
```

### コミットメッセージルール

**Conventional Commits形式を使用**:

```bash
<type>(<scope>): <description>

[optional body]

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

#### Type（必須）

- **feat**: 新機能追加
- **fix**: バグ修正
- **docs**: ドキュメント更新
- **style**: コードフォーマット（機能に影響しない変更）
- **refactor**: リファクタリング
- **test**: テスト追加・修正
- **chore**: ビルド・設定変更

#### Scope（推奨）

- **api**: LINE/OpenAI/kintone API関連
- **router**: メッセージルーティング
- **scheduled**: 定期実行機能
- **rsvp**: 参加確認機能
- **faq**: FAQ自動応答
- **sheet**: スプレッドシート操作
- **ui**: ユーザーインターフェース
- **tests**: テスト関連

#### 言語ルール

- **type(scope)**: 英語（Conventional Commits準拠）
- **description**: **日本語**（プロジェクトチーム内の可読性重視）
- **body**: 日本語（詳細説明が必要な場合）

#### 実例

```bash
# 機能追加
feat(scheduled): 前日リマインダーとお礼メッセージに画像表示機能を追加

# バグ修正
fix(rsvp): 同時リクエスト時の重複登録問題を修正

# ドキュメント
docs(api): 画像付きLINE API関数の仕様を追記

# テスト
test(scheduled): 画像フォールバック機能のテストケースを追加

# リファクタリング
refactor(router): 日付解析ロジックを簡略化

# 設定変更
chore(deps): Jestをv29.0.0にアップデート
```

#### 必須フッター

Claude Codeで開発する場合は、必ずフッターを含める:

```bash
🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

### 品質基準

- **テストカバレッジ**: 90%以上目標
- **全テスト成功**: 243テスト全てpass必須
- **型安全性**: TypeScript strictモード、エラー0件
- **コード品質**: ESLint clean、Prettier適用済み

## アーキテクチャ

### ディレクトリ構造

```bash
src/
├── handlers/     # 各機能の処理ハンドラー
├── services/     # 外部サービス連携（LINE/OpenAI/kintone/sheet）
├── utils/        # ユーティリティ関数
├── types/        # 型定義
├── main.ts       # エントリーポイント
└── router.ts     # メッセージルーティング
```

### 重要な設計パターン

#### 1. 画像表示の統一仕様

- **Eventシート「画像URL」列を優先使用**
- **空白時は環境変数FALLBACK_IMagesからフォールバック**
- **同一イベントは常に同じ画像を表示**（recordIdベースの決定的選択）
- **対象機能**: 月次カルーセル、前日リマインダー、お礼メッセージ

#### 2. RSVP機能の排他制御

- **必須**: `LockService`による行レベル排他制御
- **データ整合性**: EventシートとParticipationシートの同期
- **戻り値**: 8種類の状態コード（added/removed/already_registered等）

#### 3. エラーハンドリング

- **必須**: 全ての外部API呼び出しでtry-catch
- **ログ出力**: console.error()でスタックトレース記録
- **ユーザー体験**: エラー時も適切なフィードバック

## 主要機能（8機能）

### 1. FAQ自動応答

- **最優先トリガー**: 「組織教えて」
- **ベクトル検索**: OpenAI embeddings + 類似度計算
- **フォールバック**: FAQ不一致時は雑談AI（履歴付き）

### 2. 活動予定配信（定期実行）

- **月次カルーセル**: 最大10列、RSVP ボタン付き
- **前日リマインダー**: 画像付きメッセージ + Confirmテンプレート
- **お礼メッセージ**: 画像付きメッセージ
- **kintone同期**: 重複防止・キャンセル状態管理

### 3. 参加確認（RSVP）

- **テキスト入力**: 「参加する」「不参加」等の固定文言
- **日付指定**: 「9/15(日) 参加します」形式対応
- **ボタン式**: postbackによるConfirmテンプレート
- **データ記録**: EventシートとParticipation台帳への二重記録

### 4. 雑談対応

- **文脈維持**: 直近3往復の会話履歴参照
- **統一システムメッセージ**: FAQ応答と雑談で共通の品質

## 重要な実装ポイント

### LINE API関数の使い分け

```typescript
// ❌ 非推奨（旧関数）
pushMessage(userId, text)
pushConfirmParticipation(userId, text, eventId)

// ✅ 推奨（新関数・画像対応）
pushMessageWithImage(userId, text, imageUrl?)
pushConfirmParticipationWithImage(userId, text, eventId, imageUrl?)
```

### メッセージルーティング優先順位

1. **「組織教えて」トリガー** → FAQ処理
2. **日付指定RSVP** → 「9/15(日) 参加」等
3. **固定文言RSVP** → 「参加する」「不参加」等
4. **スケジュール問い合わせ** → 「活動日」「日程」等
5. **アラートキーワード** → 「やめたい」「困った」等
6. **雑談処理** → 文脈維持機能付き

### スプレッドシート構成

- **FAQ**: 質問/回答/Embedding
- **Log**: 会話履歴（文脈維持用）
- **Users**: ユーザー管理
- **Event**: イベントビュー（kintone同期）
- **Participation**: 参加履歴台帳（真実の記録）

## 開発時の注意点

### 必須チェック項目

- [ ] 新しい外部API呼び出しにはモックテスト追加
- [ ] 排他制御が必要な処理にはLockService使用
- [ ] 画像表示機能は統一仕様に従う
- [ ] エラーハンドリングを必ず実装
- [ ] 型定義を適切に設定

### 禁止事項

- ❌ 旧LINE API関数（pushMessage等）の使用
- ❌ テスト・リント・型チェックを通さないコミット
- ❌ モック化していない外部API呼び出し
- ❌ LockServiceなしでのEventシート更新
- ❌ 機密情報のハードコーディング

### パフォーマンス考慮

- **会話履歴**: 最大200行読み込み制限
- **バッチ送信**: 150ユーザー/回、1秒間隔
- **API制限**: OpenAI呼び出し最小化
- **スプレッドシート**: 不要な読み込み回避

## テスト戦略

### テスト構成（11ファイル/243テスト）

- **FAQ**: faq.test.ts（雑談フォールバック対応）
- **定期実行**: scheduled.test.ts（画像付きリマインダー機能）
- **LINE API**: line.test.ts（画像付きメッセージ機能）
- **ルーティング**: router.test.ts（日付指定RSVP機能）
- **E2E**: e2e.test.ts、e2e.schedule.test.ts

### モック設定

- `UrlFetchApp`: HTTP通信
- `SpreadsheetApp`: スプレッドシート操作
- `Utilities`: GAS ユーティリティ

## 環境設定

### 必要な環境変数（スクリプトプロパティ）

```bash
OPENAI_API_KEY=your_openai_api_key
CHANNEL_ACCESS_TOKEN=your_line_channel_access_token
SIMILARITY_THRESHOLD=0.75
SPREADSHEET_ID=your_google_spreadsheet_id
KINTONE_DOMAIN=your_kintone_domain
KINTONE_EVENT_APP_ID=your_event_app_id
KINTONE_EVENT_API_TOKEN=your_event_api_token
FAQ_SINGLE_WORD_TRIGGERS=["持ち物","集合場所","アクセス","時間","日程"]
FALLBACK_IMAGES=["https://example.com/image1.jpg","https://example.com/image2.jpg"]
```

## デプロイ

### 環境別デプロイ

```bash
npm run deploy        # 開発環境（デフォルト）
npm run deploy:dev    # 開発環境
npm run deploy:stg    # ステージング環境
npm run deploy:prod   # 本番環境
```

### デプロイ前チェックリスト

- [ ] 全テスト成功（243テスト）
- [ ] リント・型チェック clean
- [ ] 環境変数設定確認
- [ ] スプレッドシート権限確認
- [ ] LINE Webhook URL設定

## トラブルシューティング

### よくある問題

1. **OpenAI API エラー**: API キーとクォータを確認
2. **スプレッドシート権限エラー**: GAS サービスアカウントの権限確認
3. **LINE Webhook エラー**: SSL証明書と URL 設定を確認
4. **kintone 接続エラー**: ドメインと API トークンを確認

### デバッグ方法

- **GAS**: 実行ログから `console.log` 出力を確認
- **LINE**: Webhook の配信状況をコンソールで確認
- **テスト**: Jest の詳細出力で問題箇所を特定

## セキュリティ・品質

### セキュリティ考慮

- **排他制御**: LockServiceでの同時実行制御
- **入力バリデーション**: 無効なデータのフィルタリング
- **会話ログ**: 個人情報の扱いに注意
- **機密情報**: Git Hooksで漏洩防止

### 品質保証

- **マイクロサービス構成**: 機能別分離
- **型安全性**: TypeScript strictモード
- **回帰テスト**: 機能追加時のデグレード防止
- **モック駆動**: 外部API依存排除

---

**最終更新**: 2025年9月20日
**バージョン**: v1.4.0
**ステータス**: 全8機能実装完了
