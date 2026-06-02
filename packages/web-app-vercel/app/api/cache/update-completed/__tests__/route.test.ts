import { POST } from '../route';
import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { updateCompletedPlayback } from '@/lib/db/cacheIndex';

jest.mock('@/lib/auth', () => ({
    auth: jest.fn(),
}));

jest.mock('@/lib/db/cacheIndex', () => ({
    updateCompletedPlayback: jest.fn(),
}));

describe('POST /api/cache/update-completed', () => {
    let originalConsoleError: typeof console.error;

    beforeAll(() => {
        originalConsoleError = console.error;
        console.error = jest.fn(); // Suppress console.error during tests
    });

    afterAll(() => {
        console.error = originalConsoleError;
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    const createRequest = (body: any, headers?: Record<string, string>) => {
        return new NextRequest('http://localhost:3000/api/cache/update-completed', {
            method: 'POST',
            headers: new Headers({
                'Content-Type': 'application/json',
                ...headers,
            }),
            body: JSON.stringify(body),
        });
    };

    it('returns 401 when not authenticated', async () => {
        (auth as jest.Mock).mockResolvedValue(null);

        const request = createRequest({ articleUrl: 'https://example.com', voice: 'ja-JP-Standard-A', completed: true });
        const response = await POST(request);

        expect(response.status).toBe(401);
        const data = await response.json();
        expect(data).toEqual({ error: 'Unauthorized' });
    });

    it('returns 400 when missing parameters', async () => {
        (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });

        const request = createRequest({ articleUrl: 'https://example.com' }); // missing voice and completed
        const response = await POST(request);

        expect(response.status).toBe(400);
        const data = await response.json();
        expect(data).toEqual({ error: 'articleUrl, voice, and completed are required' });
    });

    it('returns 400 when completed is not a boolean', async () => {
        (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });

        const request = createRequest({ articleUrl: 'https://example.com', voice: 'ja-JP-Standard-A', completed: 'true' });
        const response = await POST(request);

        expect(response.status).toBe(400);
        const data = await response.json();
        expect(data).toEqual({ error: 'articleUrl, voice, and completed are required' });
    });

    it('returns 200 and updates completed playback on success', async () => {
        (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });
        (updateCompletedPlayback as jest.Mock).mockResolvedValue(undefined);

        const request = createRequest({ articleUrl: 'https://example.com', voice: 'ja-JP-Standard-A', completed: true });
        const response = await POST(request);

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data).toEqual({ success: true });

        expect(updateCompletedPlayback).toHaveBeenCalledWith('https://example.com', 'ja-JP-Standard-A', true);
    });

    it('returns 500 when updateCompletedPlayback throws an error', async () => {
        (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });
        (updateCompletedPlayback as jest.Mock).mockRejectedValue(new Error('DB Error'));

        const request = createRequest({ articleUrl: 'https://example.com', voice: 'ja-JP-Standard-A', completed: true });
        const response = await POST(request);

        expect(response.status).toBe(500);
        const data = await response.json();
        expect(data).toEqual({ error: 'Failed to update completed playback' });
    });

    it('returns 500 when request.json() throws an error', async () => {
        (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });

        const request = new NextRequest('http://localhost:3000/api/cache/update-completed', {
            method: 'POST',
            body: 'invalid json'
        });
        const response = await POST(request);

        expect(response.status).toBe(500);
        const data = await response.json();
        expect(data).toEqual({ error: 'Failed to update completed playback' });
    });
});
