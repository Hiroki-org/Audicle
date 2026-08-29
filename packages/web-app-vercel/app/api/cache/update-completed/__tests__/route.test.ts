// Auth mock
jest.mock('@/lib/auth', () => ({
    auth: jest.fn(),
}));

// DB mock
jest.mock('@/lib/db/cacheIndex', () => ({
    updateCompletedPlayback: jest.fn(),
}));

import { NextRequest } from 'next/server';
import { POST } from '../route';
import { auth } from '@/lib/auth';
import { updateCompletedPlayback } from '@/lib/db/cacheIndex';

describe('POST /api/cache/update-completed', () => {
    let consoleErrorMock: jest.SpyInstance;

    beforeAll(() => {
        // Suppress expected console.error logs during error tests
        consoleErrorMock = jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterAll(() => {
        consoleErrorMock.mockRestore();
    });

    beforeEach(() => {
        jest.resetAllMocks();
    });

    const mockRequest = (body: any) => {
        return new NextRequest('http://localhost:3000/api/cache/update-completed', {
            method: 'POST',
            body: JSON.stringify(body),
            headers: new Headers({ 'x-request-id': 'test-request-id' }),
        });
    };

    it('returns 401 if user is not authenticated', async () => {
        (auth as jest.Mock).mockResolvedValue(null);

        const request = mockRequest({ articleUrl: 'https://example.com', voice: 'en-US-Wavenet-D', completed: true });
        const response = await POST(request);

        expect(response.status).toBe(401);
        const data = await response.json();
        expect(data).toEqual({ error: 'Unauthorized' });
        expect(consoleErrorMock).toHaveBeenCalledWith(
            '[Cache Update Completed] ❌ Unauthorized',
            expect.objectContaining({ requestId: 'test-request-id' })
        );
    });

    it('returns 400 if articleUrl is missing', async () => {
        (auth as jest.Mock).mockResolvedValue({ user: { id: 'test-user-id' } });

        const request = mockRequest({ voice: 'en-US-Wavenet-D', completed: true });
        const response = await POST(request);

        expect(response.status).toBe(400);
        const data = await response.json();
        expect(data).toEqual({ error: 'articleUrl, voice, and completed are required' });
    });

    it('returns 400 if voice is missing', async () => {
        (auth as jest.Mock).mockResolvedValue({ user: { id: 'test-user-id' } });

        const request = mockRequest({ articleUrl: 'https://example.com', completed: true });
        const response = await POST(request);

        expect(response.status).toBe(400);
        const data = await response.json();
        expect(data).toEqual({ error: 'articleUrl, voice, and completed are required' });
    });

    it('returns 400 if completed is missing', async () => {
        (auth as jest.Mock).mockResolvedValue({ user: { id: 'test-user-id' } });

        const request = mockRequest({ articleUrl: 'https://example.com', voice: 'en-US-Wavenet-D' });
        const response = await POST(request);

        expect(response.status).toBe(400);
        const data = await response.json();
        expect(data).toEqual({ error: 'articleUrl, voice, and completed are required' });
    });

    it('returns 400 if completed is not a boolean', async () => {
        (auth as jest.Mock).mockResolvedValue({ user: { id: 'test-user-id' } });

        const request = mockRequest({ articleUrl: 'https://example.com', voice: 'en-US-Wavenet-D', completed: 'true' });
        const response = await POST(request);

        expect(response.status).toBe(400);
        const data = await response.json();
        expect(data).toEqual({ error: 'articleUrl, voice, and completed are required' });
    });

    it('returns 500 if updateCompletedPlayback fails', async () => {
        (auth as jest.Mock).mockResolvedValue({ user: { id: 'test-user-id' } });
        (updateCompletedPlayback as jest.Mock).mockRejectedValue(new Error('DB Error'));

        const request = mockRequest({ articleUrl: 'https://example.com', voice: 'en-US-Wavenet-D', completed: true });
        const response = await POST(request);

        expect(response.status).toBe(500);
        const data = await response.json();
        expect(data).toEqual({ error: 'Failed to update completed playback' });
        expect(consoleErrorMock).toHaveBeenCalledWith('[Cache Update Completed API] Error:', expect.any(Error));
    });

    it('returns 500 if an unexpected exception occurs (e.g. JSON parsing error)', async () => {
        (auth as jest.Mock).mockResolvedValue({ user: { id: 'test-user-id' } });

        // Mock a request that throws when json() is called
        const request = new NextRequest('http://localhost:3000/api/cache/update-completed', {
            method: 'POST',
            body: 'invalid-json',
        });

        const response = await POST(request);

        expect(response.status).toBe(500);
        const data = await response.json();
        expect(data).toEqual({ error: 'Failed to update completed playback' });
    });

    it('successfully updates completed status and returns 200', async () => {
        (auth as jest.Mock).mockResolvedValue({ user: { id: 'test-user-id' } });
        (updateCompletedPlayback as jest.Mock).mockResolvedValue(undefined);

        const request = mockRequest({ articleUrl: 'https://example.com', voice: 'en-US-Wavenet-D', completed: true });
        const response = await POST(request);

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data).toEqual({ success: true });

        // Verify updateCompletedPlayback was called with correct arguments
        expect(updateCompletedPlayback).toHaveBeenCalledWith('https://example.com', 'en-US-Wavenet-D', true);
    });
});
