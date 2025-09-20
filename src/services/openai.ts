/**
 * OpenAI API クライアント
 */

import { getConfig } from '../utils/env';
import { OpenAIEmbeddingResponse, OpenAIChatResponse } from '../types/index';
import { getOrganizationConfig, getMessageTemplates } from '../utils/config';

/**
 * テキストをベクトル化する
 * @param text ベクトル化対象のテキスト
 * @returns ベクトル配列 or null
 */
export function getEmbedding(text: string): number[] | null {
  const config = getConfig();

  const url = 'https://api.openai.com/v1/embeddings';
  const headers = {
    Authorization: `Bearer ${config.OPENAI_API_KEY}`,
    'Content-Type': 'application/json',
  };

  const payload = {
    input: text,
    model: 'text-embedding-3-small',
  };

  const options: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions = {
    method: 'post',
    headers: headers,
    payload: JSON.stringify(payload),
  };

  try {
    const response = UrlFetchApp.fetch(url, options);
    const statusCode = response.getResponseCode();

    if (statusCode !== 200) {
      console.error(`[OpenAI Embedding] APIエラー: ${statusCode}`);
      console.error(
        `[OpenAI Embedding] レスポンス: ${response.getContentText()}`,
      );
      return null;
    }

    const json: OpenAIEmbeddingResponse = JSON.parse(response.getContentText());

    if (!json.data || json.data.length === 0) {
      console.error('[OpenAI Embedding] 空のレスポンス');
      return null;
    }

    console.log(`[OpenAI Embedding] 成功: ${json.usage.total_tokens} tokens`);
    return json.data[0].embedding;
  } catch (error) {
    console.error('[OpenAI Embedding] リクエストエラー:', error);
    return null;
  }
}

/**
 * GPTで回答を生成する
 * @param prompt プロンプト文字列
 * @param maxTokens 最大トークン数
 * @returns 生成された回答 or エラーメッセージ
 */
export function generateAnswer(
  prompt: string,
  maxTokens: number = 200,
): string {
  const config = getConfig();

  const url = 'https://api.openai.com/v1/chat/completions';
  const headers = {
    Authorization: `Bearer ${config.OPENAI_API_KEY}`,
    'Content-Type': 'application/json',
  };

  const payload = {
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: maxTokens,
    temperature: 0.7,
  };

  const options: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions = {
    method: 'post',
    headers: headers,
    payload: JSON.stringify(payload),
  };

  try {
    const response = UrlFetchApp.fetch(url, options);
    const statusCode = response.getResponseCode();

    if (statusCode !== 200) {
      console.error(`[OpenAI Chat] APIエラー: ${statusCode}`);
      console.error(`[OpenAI Chat] レスポンス: ${response.getContentText()}`);
      return '申し訳ありません、AIの応答を取得できませんでした。';
    }

    const json: OpenAIChatResponse = JSON.parse(response.getContentText());

    if (!json.choices || json.choices.length === 0) {
      console.error('[OpenAI Chat] 空のレスポンス');
      return '申し訳ありません、AIの応答を取得できませんでした。';
    }

    const answer = json.choices[0].message.content.trim();
    console.log(`[OpenAI Chat] 成功: ${json.usage?.total_tokens} tokens`);

    return answer;
  } catch (error) {
    console.error('[OpenAI Chat] リクエストエラー:', error);
    return '申し訳ありません、AIの応答を取得できませんでした。';
  }
}

/**
 * system + messages配列を使ってChat APIを呼び出す（履歴対応）
 */
export function generateChatWithHistory(
  systemContent: string,
  history: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
  userContent: string,
  maxTokens: number = 200,
  temperature: number = 0.3,
): string {
  const config = getConfig();

  const url = 'https://api.openai.com/v1/chat/completions';
  const headers = {
    Authorization: `Bearer ${config.OPENAI_API_KEY}`,
    'Content-Type': 'application/json',
  };

  const messages: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
  }> = [
    { role: 'system', content: systemContent },
    ...history,
    { role: 'user', content: userContent },
  ];

  const payload = {
    model: 'gpt-4o-mini',
    messages,
    max_tokens: maxTokens,
    temperature,
    frequency_penalty: 0.2,
    presence_penalty: 0.0,
  } as const;

  const options: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions = {
    method: 'post',
    headers: headers,
    payload: JSON.stringify(payload),
  };

  try {
    const response = UrlFetchApp.fetch(url, options);
    const statusCode = response.getResponseCode();
    if (statusCode !== 200) {
      console.error(`[OpenAI Chat(hist)] APIエラー: ${statusCode}`);
      console.error(
        `[OpenAI Chat(hist)] レスポンス: ${response.getContentText()}`,
      );
      return '申し訳ありません、AIの応答を取得できませんでした。';
    }

    const json: OpenAIChatResponse = JSON.parse(response.getContentText());
    if (!json.choices || json.choices.length === 0) {
      console.error('[OpenAI Chat(hist)] 空のレスポンス');
      return '申し訳ありません、AIの応答を取得できませんでした。';
    }

    const answer = json.choices[0].message.content.trim();
    console.log(`[OpenAI Chat(hist)] 成功: ${json.usage?.total_tokens} tokens`);
    return answer;
  } catch (error) {
    console.error('[OpenAI Chat(hist)] リクエストエラー:', error);
    return '申し訳ありません、AIの応答を取得できませんでした。';
  }
}

/**
 * FAQ応答用のプロンプトを生成する
 * @param userQuestion ユーザーの質問
 * @param faqQuestion FAQ質問
 * @param faqAnswer FAQ回答
 * @returns プロンプト文字列
 */
export function createFaqPrompt(
  userQuestion: string,
  faqQuestion: string,
  faqAnswer: string,
): string {
  const config = getOrganizationConfig();
  return `あなたは親切な${config.activityType}団体のスタッフです。以下の情報を参考にして、ユーザーからの質問に丁寧に回答してください。

--- 参考情報 ---
質問: ${faqQuestion}
回答: ${faqAnswer}

--- ユーザーからの質問 ---
${userQuestion}

回答は簡潔で分かりやすく、親しみやすい口調でお願いします。`;
}

/**
 * 雑談・相談用のプロンプトを生成する
 * @param userMessage ユーザーのメッセージ
 * @returns プロンプト文字列
 */
export function createChatPrompt(userMessage: string): string {
  const config = getOrganizationConfig();
  const templates = getMessageTemplates(config);
  return `${templates.systemPrompt}

--- ユーザーからのメッセージ ---
${userMessage}`;
}

/**
 * 雑談用プロンプト（会話履歴付き）を生成する
 * @param history 古い→新しい順の履歴（user/assistantロール）
 * @param userMessage 現在のユーザー発話
 */
export function createChatPromptWithHistory(
  history: Array<{ role: 'user' | 'assistant'; content: string }>,
  userMessage: string,
): string {
  const config = getOrganizationConfig();
  const lines: string[] = [];
  lines.push(
    `あなたは親切な${config.activityType}団体のスタッフです。会話の文脈を踏まえて、共感的で温かい返答をしてください。`,
  );
  if (history && history.length > 0) {
    lines.push('\n--- これまでの会話（古い→新しい）---');
    for (const turn of history) {
      const speaker = turn.role === 'user' ? 'ユーザー' : 'あなた';
      lines.push(`${speaker}: ${turn.content}`);
    }
  }
  lines.push('\n--- 今回のユーザーからのメッセージ ---');
  lines.push(userMessage);
  lines.push('\n回答は簡潔で温かみがあり、相手を励ます一言を添えてください。');
  return lines.join('\n');
}
