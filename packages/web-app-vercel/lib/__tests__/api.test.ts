/**
 * @jest-environment jsdom
 */

// lib/api.ts のテスト

// loggerをモック
jest.mock('@/lib/logger', () => ({
    logger: {
        apiRequest: jest.fn(),
        apiResponse: jest.fn(),
        error: jest.fn(),
        success: jest.fn(),
        pending: jest.fn(),
    },
}));

import { extractContent, parseApiErrorMessage } from '../api';
import { logger } from '@/lib/logger';

describe('parseApiErrorMessage', () => {
    it('extracts error message from valid JSON with error field', () => {
        const errorText = JSON.stringify({ error: 'エラーメッセージ' });
        expect(parseApiErrorMessage(errorText)).toBe('エラーメッセージ');
    });

    it('returns original text when JSON has no error field', () => {
        const errorText = JSON.stringify({ someOtherField: 'value' });
        expect(parseApiErrorMessage(errorText)).toBe(errorText);
    });

    it('returns original text when JSON parsing fails', () => {
        const errorText = 'Not valid JSON';
        expect(parseApiErrorMessage(errorText)).toBe('Not valid JSON');
    });

    it('returns default message when provided and JSON has no error field', () => {
        const errorText = JSON.stringify({ someOtherField: 'value' });
        expect(parseApiErrorMessage(errorText, 'デフォルトメッセージ')).toBe('デフォルトメッセージ');
    });

    it('returns default message when provided and JSON parsing fails', () => {
        const errorText = 'Not valid JSON';
        expect(parseApiErrorMessage(errorText, 'デフォルトメッセージ')).toBe('デフォルトメッセージ');
    });

    it('returns error field even when default message is provided', () => {
        const errorText = JSON.stringify({ error: 'エラーメッセージ' });
        expect(parseApiErrorMessage(errorText, 'デフォルトメッセージ')).toBe('エラーメッセージ');
    });

    it('returns original text when errorText is "null" (valid JSON but not an object)', () => {
        expect(parseApiErrorMessage('null')).toBe('null');
    });

    it('returns original text when errorText is an array "[]"', () => {
        expect(parseApiErrorMessage('[]')).toBe('[]');
    });

    it('returns original text when errorText is an empty string', () => {
        expect(parseApiErrorMessage('')).toBe('');
    });

    it('returns original text when errorText is an HTML error page', () => {
        const htmlError = '<html><body>502 Bad Gateway</body></html>';
        expect(parseApiErrorMessage(htmlError)).toBe(htmlError);
    });

});

describe('extractContent', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('returns extracted content on success', async () => {
        const mockResponse = {
            title: 'Test Article',
            content: '<p>Test content</p>',
            textLength: 12,
        };

        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve(mockResponse),
        });

        const result = await extractContent('https://example.com');
        expect(result).toEqual(mockResponse);
        expect(logger.apiRequest).toHaveBeenCalledWith('POST', '/api/extract', { url: 'https://example.com' });
    });

    it('throws error with parsed JSON error message on 401 response', async () => {
        const errorJson = { error: 'このURLは認証が必要なサイトです。ログインが必要なページは読み込めません。' };

        global.fetch = jest.fn().mockResolvedValue({
            ok: false,
            status: 401,
            text: () => Promise.resolve(JSON.stringify(errorJson)),
        });

        await expect(extractContent('https://auth-required-site.com')).rejects.toThrow(
            'このURLは認証が必要なサイトです。ログインが必要なページは読み込めません。'
        );
        expect(logger.error).toHaveBeenCalledWith('抽出エラー: このURLは認証が必要なサイトです。ログインが必要なページは読み込めません。');
    });

    it('throws error with parsed JSON error message on 403 response', async () => {
        const errorJson = { error: 'このURLは認証が必要なサイトです。ログインが必要なページは読み込めません。' };

        global.fetch = jest.fn().mockResolvedValue({
            ok: false,
            status: 403,
            text: () => Promise.resolve(JSON.stringify(errorJson)),
        });

        await expect(extractContent('https://forbidden-site.com')).rejects.toThrow(
            'このURLは認証が必要なサイトです。ログインが必要なページは読み込めません。'
        );
    });

    it('throws error with raw text when JSON parsing fails', async () => {
        const rawErrorText = 'Something went wrong';

        global.fetch = jest.fn().mockResolvedValue({
            ok: false,
            status: 500,
            text: () => Promise.resolve(rawErrorText),
        });

        await expect(extractContent('https://example.com')).rejects.toThrow('Something went wrong');
        expect(logger.error).toHaveBeenCalledWith('抽出エラー: Something went wrong');
    });

    it('handles empty error field in JSON response', async () => {
        const errorJson = { someOtherField: 'value' };

        global.fetch = jest.fn().mockResolvedValue({
            ok: false,
            status: 400,
            text: () => Promise.resolve(JSON.stringify(errorJson)),
        });

        await expect(extractContent('https://example.com')).rejects.toThrow(JSON.stringify(errorJson));
    });
});
