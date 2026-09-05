// Mock implementations
const mockHgetall = jest.fn();
const mockHset = jest.fn();

jest.mock('@/lib/kv', () => ({
    getKv: jest.fn(),
}));

jest.mock('@/lib/kv-helpers', () => ({
    parseArticleMetadata: jest.fn(),
    serializeArticleMetadata: jest.fn(),
}));

jest.mock('@/lib/auth', () => ({
    auth: jest.fn(),
}));

import { NextRequest } from 'next/server';
import { POST } from '../route';
import { getKv } from '@/lib/kv';
import { parseArticleMetadata, serializeArticleMetadata } from '@/lib/kv-helpers';
import { auth } from '@/lib/auth';

describe('POST /api/cache/update-completed-kv', () => {
    let consoleErrorMock: jest.SpyInstance;

    beforeAll(() => {
        consoleErrorMock = jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterAll(() => {
        consoleErrorMock.mockRestore();
    });

    beforeEach(() => {
        jest.resetAllMocks();

        // Default auth mock to authenticated user
        (auth as jest.Mock).mockResolvedValue({
            user: { id: 'user-1' },
        });

        // Default KV mock
        (getKv as jest.Mock).mockResolvedValue({
            hgetall: mockHgetall,
            hset: mockHset,
        });

        // Default kv-helpers mocks
        (parseArticleMetadata as jest.Mock).mockReturnValue({
            url: 'https://example.com',
            voice: 'voice-1',
        });
        (serializeArticleMetadata as jest.Mock).mockReturnValue('serialized-data');
    });

    const mockRequest = (body: any, headers: Record<string, string> = {}) => {
        const reqHeaders = new Headers();
        Object.entries(headers).forEach(([key, value]) => reqHeaders.set(key, value));

        return new NextRequest('http://localhost:3000/api/cache/update-completed-kv', {
            method: 'POST',
            body: JSON.stringify(body),
            headers: reqHeaders,
        });
    };

    it('returns 401 if user is not authenticated', async () => {
        (auth as jest.Mock).mockResolvedValue(null);

        const request = mockRequest(
            { articleUrl: 'https://example.com', voice: 'voice-1', completed: true },
            { 'x-request-id': 'req-1' }
        );
        const response = await POST(request);

        expect(response.status).toBe(401);
        const data = await response.json();
        expect(data).toEqual({ error: 'Unauthorized' });
        expect(consoleErrorMock).toHaveBeenCalledWith(
            '[KV Update] ❌ Unauthorized',
            { requestId: 'req-1' }
        );
    });

    it('returns 400 if required fields are missing', async () => {
        const testCases = [
            { body: { voice: 'voice-1', completed: true }, missing: 'articleUrl' },
            { body: { articleUrl: 'https://example.com', completed: true }, missing: 'voice' },
            { body: { articleUrl: 'https://example.com', voice: 'voice-1' }, missing: 'completed' },
            { body: { articleUrl: 'https://example.com', voice: 'voice-1', completed: 'yes' }, missing: 'completed (wrong type)' }
        ];

        for (const testCase of testCases) {
            const request = mockRequest(testCase.body);
            const response = await POST(request);

            expect(response.status).toBe(400);
            const data = await response.json();
            expect(data).toEqual({ error: 'Missing required fields: articleUrl, voice, completed' });
        }
    });

    it('returns 500 if KV client is not configured', async () => {
        (getKv as jest.Mock).mockResolvedValue(null);

        const request = mockRequest({ articleUrl: 'https://example.com', voice: 'voice-1', completed: true });
        const response = await POST(request);

        expect(response.status).toBe(500);
        const data = await response.json();
        expect(data).toEqual({ error: 'KV client is not configured' });
    });

    it('returns 404 if article metadata is not found', async () => {
        mockHgetall.mockResolvedValue(null);
        (parseArticleMetadata as jest.Mock).mockReturnValue(null);

        const request = mockRequest({ articleUrl: 'https://example.com', voice: 'voice-1', completed: true });
        const response = await POST(request);

        expect(response.status).toBe(404);
        const data = await response.json();
        expect(data).toEqual({ error: 'Article metadata not found' });
        expect(mockHgetall).toHaveBeenCalledWith('article:https://example.com:voice-1');
    });

    it('successfully updates completed playback status', async () => {
        const existingData = { some: 'data' };
        mockHgetall.mockResolvedValue(existingData);

        const beforeDate = new Date();
        const request = mockRequest({ articleUrl: 'https://example.com', voice: 'voice-1', completed: true });
        const response = await POST(request);
        const afterDate = new Date();

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data).toEqual({
            success: true,
            articleUrl: 'https://example.com',
            voice: 'voice-1',
            completedPlayback: true,
        });

        expect(parseArticleMetadata).toHaveBeenCalledWith(existingData);

        // Verify serializeArticleMetadata was called with correct structure
        expect(serializeArticleMetadata).toHaveBeenCalled();
        const serializeArgs = (serializeArticleMetadata as jest.Mock).mock.calls[0][0];
        expect(serializeArgs.completedPlayback).toBe(true);
        expect(new Date(serializeArgs.lastUpdated).getTime()).toBeGreaterThanOrEqual(beforeDate.getTime());
        expect(new Date(serializeArgs.lastUpdated).getTime()).toBeLessThanOrEqual(afterDate.getTime());

        expect(mockHset).toHaveBeenCalledWith(
            'article:https://example.com:voice-1',
            'serialized-data'
        );
    });

    it('returns 500 on unexpected errors', async () => {
        const error = new Error('Unexpected DB error');
        mockHgetall.mockRejectedValue(error);

        const request = mockRequest({ articleUrl: 'https://example.com', voice: 'voice-1', completed: true });
        const response = await POST(request);

        expect(response.status).toBe(500);
        const data = await response.json();
        expect(data).toEqual({ error: 'Internal server error' });
        expect(consoleErrorMock).toHaveBeenCalledWith('[KV Update] ❌ Error:', error);
    });
});
