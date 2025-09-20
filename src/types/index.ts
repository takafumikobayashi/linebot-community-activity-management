/**
 * 共通型定義
 */

// LINE API関連
export interface LineEvent {
  type: 'message' | 'follow' | 'unfollow' | 'postback';
  replyToken: string;
  source: {
    userId: string;
    type: 'user' | 'group' | 'room';
  };
  timestamp: number;
  message?: LineMessage;
  postback?: {
    data: string;
  };
}

export interface LineMessage {
  id: string;
  type: 'text' | 'image' | 'video' | 'audio' | 'file' | 'location' | 'sticker';
  text?: string;
}

export interface LineWebhookRequest {
  events: LineEvent[];
  destination: string;
}

// FAQ検索関連
export interface FaqEntry {
  question: string;
  answer: string;
  embedding?: number[];
}

export interface SearchResult {
  question: string;
  answer: string;
  similarity: number;
}

// OpenAI API関連
export interface OpenAIEmbeddingResponse {
  data: Array<{
    embedding: number[];
    index: number;
  }>;
  model: string;
  usage: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

export interface OpenAIChatResponse {
  choices: Array<{
    message: {
      content: string;
      role: string;
    };
    finish_reason: string;
    index: number;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// 設定関連
export interface Config {
  CHANNEL_ACCESS_TOKEN: string;
  OPENAI_API_KEY: string;
  SPREADSHEET_ID: string;
  STAFF_USER_ID: string;
  SIMILARITY_THRESHOLD: number;

  // kintone
  KINTONE_DOMAIN: string;
  KINTONE_EVENT_APP_ID: string;
  KINTONE_EVENT_API_TOKEN: string;
}

// エラー関連
export interface AppError {
  code: string;
  message: string;
  details?: unknown;
}

// レスポンス関連
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: AppError;
}

// kintone API関連
export interface KintoneFieldValue {
  type: string;
  value: unknown;
}

export interface KintoneRecord {
  $id: KintoneFieldValue;
  [key: string]: KintoneFieldValue;
}

export interface KintoneRecordResponse {
  records: KintoneRecord[];
}

export interface KintoneEventRecord extends KintoneRecord {
  イベント名: KintoneFieldValue;
  開始日時: KintoneFieldValue;
  終了日時: KintoneFieldValue;
}

export interface KintoneEventResponse {
  records: KintoneEventRecord[];
}
