/**
 * GAS エントリポイント(main.ts)の防御的挙動を検証するテスト
 */

jest.mock('../src/router', () => ({
  routeEvent: jest.fn(),
}));

jest.mock('../src/utils/env', () => ({
  validateConfig: jest.fn().mockReturnValue(true),
}));

import { routeEvent } from '../src/router';
import { validateConfig } from '../src/utils/env';

import '../src/main';

type EntryPoints = {
  doPost: (
    e: GoogleAppsScript.Events.DoPost,
  ) => GoogleAppsScript.Content.TextOutput;
  doGet: () => GoogleAppsScript.Content.TextOutput;
  checkConfiguration: () => void;
};

const getEntryPoints = (): EntryPoints => globalThis as unknown as EntryPoints;

const contentService = global.ContentService as unknown as {
  createTextOutput: jest.Mock;
  MimeType: { JSON: string };
};
const consoleMock = global.console as jest.Mocked<typeof console>;

const routeEventMock = routeEvent as jest.MockedFunction<typeof routeEvent>;
const validateConfigMock = validateConfig as jest.MockedFunction<
  typeof validateConfig
>;

const getTextOutputInstance = () =>
  (contentService.createTextOutput as jest.Mock).mock.results[
    (contentService.createTextOutput as jest.Mock).mock.results.length - 1
  ]?.value as {
    setMimeType: jest.Mock;
  };

const getLastPayload = () => {
  const calls = (contentService.createTextOutput as jest.Mock).mock.calls;
  const lastCall = calls[calls.length - 1];
  return lastCall ? JSON.parse(lastCall[0]) : undefined;
};

describe('main entrypoints', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    routeEventMock.mockReset();
    validateConfigMock.mockReset();
    validateConfigMock.mockReturnValue(true);
  });

  it('doPost returns error when request body is missing', () => {
    const { doPost } = getEntryPoints();

    const response = doPost({} as unknown as GoogleAppsScript.Events.DoPost);

    expect(response).toBeDefined();
    expect(routeEventMock).not.toHaveBeenCalled();

    const payload = getLastPayload();
    expect(payload).toEqual({
      status: 'error',
      message: 'Invalid request',
      timestamp: expect.any(String),
    });
    const textOutput = getTextOutputInstance();
    expect(textOutput.setMimeType).toHaveBeenCalledWith(
      contentService.MimeType.JSON,
    );
    expect(consoleMock.error).toHaveBeenCalledWith('[Entry] 無効なリクエスト');
  });

  it('doPost returns error when events are missing', () => {
    const { doPost } = getEntryPoints();

    const event = {
      postData: { contents: JSON.stringify({}) },
    } as unknown as GoogleAppsScript.Events.DoPost;

    doPost(event);

    expect(routeEventMock).not.toHaveBeenCalled();

    const payload = getLastPayload();
    expect(payload).toEqual({
      status: 'error',
      message: 'No events found',
      timestamp: expect.any(String),
    });
    expect(consoleMock.error).toHaveBeenCalledWith(
      '[Entry] イベントデータが不正',
    );
  });

  it('doPost returns ok even when routeEvent throws', () => {
    routeEventMock.mockImplementation(() => {
      throw new Error('route failure');
    });
    const { doPost } = getEntryPoints();

    const event = {
      postData: {
        contents: JSON.stringify({ events: [{ type: 'message' }] }),
      },
    } as unknown as GoogleAppsScript.Events.DoPost;

    doPost(event);

    expect(routeEventMock).toHaveBeenCalledTimes(1);

    const payload = getLastPayload();
    expect(payload).toEqual({ status: 'ok' });
    const textOutput = getTextOutputInstance();
    expect(textOutput.setMimeType).toHaveBeenCalledWith(
      contentService.MimeType.JSON,
    );
    expect(consoleMock.error).toHaveBeenCalledWith(
      '[Entry] イベント1処理エラー:',
      expect.any(Error),
    );
  });

  it('doGet logs success and returns config status', () => {
    const { doGet } = getEntryPoints();

    doGet();

    expect(validateConfigMock).toHaveBeenCalled();
    expect(consoleMock.log).toHaveBeenCalledWith('[Entry] doGet 実行');

    const payload = getLastPayload();
    expect(payload.status).toBe('ok');
    expect(payload.config_valid).toBe(true);

    const textOutput = getTextOutputInstance();
    expect(textOutput.setMimeType).toHaveBeenCalledWith(
      contentService.MimeType.JSON,
    );
  });

  it('doGet handles validation failures', () => {
    validateConfigMock.mockImplementationOnce(() => {
      throw new Error('config error');
    });
    const { doGet } = getEntryPoints();

    doGet();

    expect(consoleMock.error).toHaveBeenCalledWith(
      '[Entry] doGet エラー:',
      expect.any(Error),
    );
    const payload = getLastPayload();
    expect(payload).toEqual({
      status: 'error',
      message: 'Configuration error',
      timestamp: expect.any(String),
      error: 'Error: config error',
    });
  });

  it('checkConfiguration logs successful validation', () => {
    const { checkConfiguration } = getEntryPoints();

    checkConfiguration();

    expect(consoleMock.log).toHaveBeenCalledWith('[Entry] 設定確認開始');
    expect(consoleMock.log).toHaveBeenCalledWith('[Entry] 設定確認結果: 成功');
  });

  it('checkConfiguration logs validation errors', () => {
    validateConfigMock.mockImplementationOnce(() => {
      throw new Error('boom');
    });
    const { checkConfiguration } = getEntryPoints();

    checkConfiguration();

    expect(consoleMock.error).toHaveBeenCalledWith(
      '[Entry] 設定確認エラー:',
      expect.any(Error),
    );
  });
});
