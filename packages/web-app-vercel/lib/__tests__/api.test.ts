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

import { extractContent } from '../api';
import { logger } from '@/lib/logger';

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
