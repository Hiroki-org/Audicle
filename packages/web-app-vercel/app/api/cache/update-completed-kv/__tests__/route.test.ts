import { NextRequest } from 'next/server';
import { POST } from '../route';
import { auth } from '@/lib/auth';
import { getKv } from '@/lib/kv';
import { parseArticleMetadata, serializeArticleMetadata } from '@/lib/kv-helpers';

// Mock dependencies
jest.mock('@/lib/auth', () => ({
    auth: jest.fn(),
}));

jest.mock('@/lib/kv', () => ({
    getKv: jest.fn(),
}));

jest.mock('@/lib/kv-helpers', () => ({
    parseArticleMetadata: jest.fn(),
    serializeArticleMetadata: jest.fn(),
}));

describe('POST /api/cache/update-completed-kv', () => {
    let consoleErrorMock: jest.SpyInstance;
    let mockKvClient: any;

    beforeAll(() => {
        // Suppress expected console.error logs during error tests
        consoleErrorMock = jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterAll(() => {
        consoleErrorMock.mockRestore();
    });

    beforeEach(() => {
        jest.resetAllMocks();

        mockKvClient = {
            hgetall: jest.fn(),
            hset: jest.fn(),
        };

        (getKv as jest.Mock).mockResolvedValue(mockKvClient);
    });

    const mockRequest = (body: any, headers = {}) => {
        return new NextRequest('http://localhost:3000/api/cache/update-completed-kv', {
            method: 'POST',
            body: JSON.stringify(body),
            headers: new Headers(headers),
        });
    };

    it('returns 401 if user is not authenticated', async () => {
        (auth as jest.Mock).mockResolvedValue(null);

        const request = mockRequest({ articleUrl: 'https://example.com', voice: 'en-US', completed: true });
        const response = await POST(request);

        expect(response.status).toBe(401);
        const data = await response.json();
        expect(data).toEqual({ error: 'Unauthorized' });
    });

    it('returns 400 for missing articleUrl', async () => {
        (auth as jest.Mock).mockResolvedValue({ user: { id: 'test-user-id' } });

        const request = mockRequest({ voice: 'en-US', completed: true });
        const response = await POST(request);

        expect(response.status).toBe(400);
        const data = await response.json();
        expect(data.error).toContain('Missing required fields');
    });

    it('returns 400 for missing voice', async () => {
        (auth as jest.Mock).mockResolvedValue({ user: { id: 'test-user-id' } });

        const request = mockRequest({ articleUrl: 'https://example.com', completed: true });
        const response = await POST(request);

        expect(response.status).toBe(400);
        const data = await response.json();
        expect(data.error).toContain('Missing required fields');
    });

    it('returns 400 for missing completed flag', async () => {
        (auth as jest.Mock).mockResolvedValue({ user: { id: 'test-user-id' } });

        const request = mockRequest({ articleUrl: 'https://example.com', voice: 'en-US' });
        const response = await POST(request);

        expect(response.status).toBe(400);
        const data = await response.json();
        expect(data.error).toContain('Missing required fields');
    });

    it('returns 400 for invalid completed flag type', async () => {
        (auth as jest.Mock).mockResolvedValue({ user: { id: 'test-user-id' } });

        const request = mockRequest({ articleUrl: 'https://example.com', voice: 'en-US', completed: 'yes' });
        const response = await POST(request);

        expect(response.status).toBe(400);
        const data = await response.json();
        expect(data.error).toContain('Missing required fields');
    });

    it('returns 500 if KV client is not configured', async () => {
        (auth as jest.Mock).mockResolvedValue({ user: { id: 'test-user-id' } });
        (getKv as jest.Mock).mockResolvedValue(null);

        const request = mockRequest({ articleUrl: 'https://example.com', voice: 'en-US', completed: true });
        const response = await POST(request);

        expect(response.status).toBe(500);
        const data = await response.json();
        expect(data.error).toBe('KV client is not configured');
    });

    it('returns 404 if article metadata is not found', async () => {
        (auth as jest.Mock).mockResolvedValue({ user: { id: 'test-user-id' } });
        mockKvClient.hgetall.mockResolvedValue({}); // simulate not found
        (parseArticleMetadata as jest.Mock).mockReturnValue(null);

        const request = mockRequest({ articleUrl: 'https://example.com', voice: 'en-US', completed: true });
        const response = await POST(request);

        expect(response.status).toBe(404);
        const data = await response.json();
        expect(data.error).toBe('Article metadata not found');
    });

    it('successfully updates metadata and returns 200', async () => {
        (auth as jest.Mock).mockResolvedValue({ user: { id: 'test-user-id' } });

        const existingMetadata = { id: '1', completedPlayback: false };
        mockKvClient.hgetall.mockResolvedValue(existingMetadata);
        (parseArticleMetadata as jest.Mock).mockReturnValue(existingMetadata);

        const serializedData = { completedPlayback: 'true', lastUpdated: '2024-01-01T00:00:00Z' };
        (serializeArticleMetadata as jest.Mock).mockReturnValue(serializedData);

        const request = mockRequest({ articleUrl: 'https://example.com', voice: 'en-US', completed: true });
        const response = await POST(request);

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data).toEqual({
            success: true,
            articleUrl: 'https://example.com',
            voice: 'en-US',
            completedPlayback: true,
        });

        const expectedKey = 'article:https://example.com:en-US';
        expect(mockKvClient.hgetall).toHaveBeenCalledWith(expectedKey);
        expect(mockKvClient.hset).toHaveBeenCalledWith(expectedKey, serializedData);
    });

    it('returns 500 if an unexpected exception occurs', async () => {
        (auth as jest.Mock).mockRejectedValue(new Error('Unexpected Error'));

        const request = mockRequest({ articleUrl: 'https://example.com', voice: 'en-US', completed: true });
        const response = await POST(request);

        expect(response.status).toBe(500);
        const data = await response.json();
        expect(data.error).toBe('Internal server error');
        expect(consoleErrorMock).toHaveBeenCalledWith('[KV Update] ❌ Error:', expect.any(Error));
    });
});
