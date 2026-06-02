import { NextRequest } from 'next/server';
import { POST } from '../route';
import { getKv } from '@/lib/kv';
import { parseArticleMetadata, serializeArticleMetadata } from '@/lib/kv-helpers';
import { auth } from '@/lib/auth';

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

describe('POST /api/cache/update-completed-kv', () => {
    let consoleErrorMock: jest.SpyInstance;
    let mockKv: any;

    beforeAll(() => {
        consoleErrorMock = jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterAll(() => {
        consoleErrorMock.mockRestore();
    });

    beforeEach(() => {
        jest.resetAllMocks();

        mockKv = {
            hgetall: jest.fn(),
            hset: jest.fn(),
        };

        (getKv as jest.Mock).mockResolvedValue(mockKv);
        (auth as jest.Mock).mockResolvedValue({ user: { id: 'test-user-id' } });
    });

    const mockRequest = (body: any) => {
        return new NextRequest('http://localhost:3000/api/cache/update-completed-kv', {
            method: 'POST',
            body: JSON.stringify(body),
            headers: new Headers({ 'x-request-id': 'req-123' })
        });
    };

    it('returns 401 if user is not authenticated', async () => {
        (auth as jest.Mock).mockResolvedValue(null);

        const request = mockRequest({ articleUrl: 'https://example.com', voice: 'en-US-1', completed: true });
        const response = await POST(request);

        expect(response.status).toBe(401);
        const data = await response.json();
        expect(data).toEqual({ error: 'Unauthorized' });
        expect(consoleErrorMock).toHaveBeenCalledWith(
            expect.stringContaining('[KV Update] ❌ Unauthorized'),
            { requestId: 'req-123' }
        );
    });

    it('returns 400 if required fields are missing', async () => {
        const request = mockRequest({ voice: 'en-US-1', completed: true }); // Missing articleUrl
        const response = await POST(request);

        expect(response.status).toBe(400);
        const data = await response.json();
        expect(data).toEqual({ error: 'Missing required fields: articleUrl, voice, completed' });
    });

    it('returns 400 if completed is not a boolean', async () => {
        const request = mockRequest({ articleUrl: 'https://example.com', voice: 'en-US-1', completed: 'true' });
        const response = await POST(request);

        expect(response.status).toBe(400);
        const data = await response.json();
        expect(data).toEqual({ error: 'Missing required fields: articleUrl, voice, completed' });
    });

    it('returns 500 if getKv returns null', async () => {
        (getKv as jest.Mock).mockResolvedValue(null);

        const request = mockRequest({ articleUrl: 'https://example.com', voice: 'en-US-1', completed: true });
        const response = await POST(request);

        expect(response.status).toBe(500);
        const data = await response.json();
        expect(data).toEqual({ error: 'KV client is not configured' });
    });

    it('returns 404 if metadata is not found', async () => {
        mockKv.hgetall.mockResolvedValue({});
        (parseArticleMetadata as jest.Mock).mockReturnValue(null);

        const request = mockRequest({ articleUrl: 'https://example.com', voice: 'en-US-1', completed: true });
        const response = await POST(request);

        expect(response.status).toBe(404);
        const data = await response.json();
        expect(data).toEqual({ error: 'Article metadata not found' });
        expect(mockKv.hgetall).toHaveBeenCalledWith('article:https://example.com:en-US-1');
    });

    it('successfully updates metadata and returns 200', async () => {
        mockKv.hgetall.mockResolvedValue({ some: 'data' });
        (parseArticleMetadata as jest.Mock).mockReturnValue({ existing: 'meta' });
        (serializeArticleMetadata as jest.Mock).mockReturnValue({ serialized: 'data' });

        const request = mockRequest({ articleUrl: 'https://example.com', voice: 'en-US-1', completed: true });
        const response = await POST(request);

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data).toEqual({
            success: true,
            articleUrl: 'https://example.com',
            voice: 'en-US-1',
            completedPlayback: true,
        });

        expect(mockKv.hgetall).toHaveBeenCalledWith('article:https://example.com:en-US-1');
        expect(serializeArticleMetadata).toHaveBeenCalledWith({
            completedPlayback: true,
            lastUpdated: expect.any(String), // Since we use new Date().toISOString()
        });
        expect(mockKv.hset).toHaveBeenCalledWith(
            'article:https://example.com:en-US-1',
            { serialized: 'data' }
        );
    });

    it('returns 500 on unexpected errors', async () => {
        // Force an error inside the function (e.g., throwing from request.json())
        const request = new NextRequest('http://localhost:3000/api/cache/update-completed-kv', {
            method: 'POST',
            body: 'invalid-json' // This will throw when calling await request.json()
        });

        const response = await POST(request);

        expect(response.status).toBe(500);
        const data = await response.json();
        expect(data).toEqual({ error: 'Internal server error' });
        expect(consoleErrorMock).toHaveBeenCalledWith(
            expect.stringContaining('[KV Update] ❌ Error:'),
            expect.any(Error)
        );
    });
});
