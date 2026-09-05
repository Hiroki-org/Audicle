// DB mock
jest.mock('@/lib/db/cacheIndex', () => ({
    updateCompletedPlayback: jest.fn(),
}));

// Auth mock
jest.mock('@/lib/auth', () => ({
    auth: jest.fn(),
}));

import { NextRequest } from 'next/server';
import { POST } from '../route';
import { auth } from '@/lib/auth';
import { updateCompletedPlayback } from '@/lib/db/cacheIndex';

describe('POST /api/cache/update-completed', () => {
    let consoleErrorMock: jest.SpyInstance;

    beforeAll(() => {
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
        });
    };

    it('returns 401 if user is not authenticated', async () => {
        (auth as jest.Mock).mockResolvedValue(null);

        const request = mockRequest({ articleUrl: 'http://test.com', voice: 'test-voice', completed: true });
        const response = await POST(request);

        expect(response.status).toBe(401);
        const data = await response.json();
        expect(data).toEqual({ error: 'Unauthorized' });
        expect(consoleErrorMock).toHaveBeenCalledWith(
            '[Cache Update Completed] ❌ Unauthorized',
            expect.objectContaining({ requestId: null })
        );
    });

    it('returns 400 if articleUrl is missing', async () => {
        (auth as jest.Mock).mockResolvedValue({ user: { id: 'test-user' } });

        const request = mockRequest({ voice: 'test-voice', completed: true });
        const response = await POST(request);

        expect(response.status).toBe(400);
        const data = await response.json();
        expect(data).toEqual({ error: 'articleUrl, voice, and completed are required' });
    });

    it('returns 400 if voice is missing', async () => {
        (auth as jest.Mock).mockResolvedValue({ user: { id: 'test-user' } });

        const request = mockRequest({ articleUrl: 'http://test.com', completed: true });
        const response = await POST(request);

        expect(response.status).toBe(400);
        const data = await response.json();
        expect(data).toEqual({ error: 'articleUrl, voice, and completed are required' });
    });

    it('returns 400 if completed is missing', async () => {
        (auth as jest.Mock).mockResolvedValue({ user: { id: 'test-user' } });

        const request = mockRequest({ articleUrl: 'http://test.com', voice: 'test-voice' });
        const response = await POST(request);

        expect(response.status).toBe(400);
        const data = await response.json();
        expect(data).toEqual({ error: 'articleUrl, voice, and completed are required' });
    });

    it('returns 400 if completed is not a boolean', async () => {
        (auth as jest.Mock).mockResolvedValue({ user: { id: 'test-user' } });

        const request = mockRequest({ articleUrl: 'http://test.com', voice: 'test-voice', completed: 'true' });
        const response = await POST(request);

        expect(response.status).toBe(400);
        const data = await response.json();
        expect(data).toEqual({ error: 'articleUrl, voice, and completed are required' });
    });

    it('returns 200 on success', async () => {
        (auth as jest.Mock).mockResolvedValue({ user: { id: 'test-user' } });
        (updateCompletedPlayback as jest.Mock).mockResolvedValue(undefined);

        const request = mockRequest({ articleUrl: 'http://test.com', voice: 'test-voice', completed: true });
        const response = await POST(request);

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data).toEqual({ success: true });
        expect(updateCompletedPlayback).toHaveBeenCalledWith('http://test.com', 'test-voice', true);
    });

    it('returns 500 if DB update fails', async () => {
        (auth as jest.Mock).mockResolvedValue({ user: { id: 'test-user' } });
        const dbError = new Error('DB error');
        (updateCompletedPlayback as jest.Mock).mockRejectedValue(dbError);

        const request = mockRequest({ articleUrl: 'http://test.com', voice: 'test-voice', completed: true });
        const response = await POST(request);

        expect(response.status).toBe(500);
        const data = await response.json();
        expect(data).toEqual({ error: 'Failed to update completed playback' });
        expect(consoleErrorMock).toHaveBeenCalledWith('[Cache Update Completed API] Error:', dbError);
    });

    it('returns 500 if auth throws an error', async () => {
        const authError = new Error('Auth error');
        (auth as jest.Mock).mockRejectedValue(authError);

        const request = mockRequest({ articleUrl: 'http://test.com', voice: 'test-voice', completed: true });
        const response = await POST(request);

        expect(response.status).toBe(500);
        const data = await response.json();
        expect(data).toEqual({ error: 'Failed to update completed playback' });
        expect(consoleErrorMock).toHaveBeenCalledWith('[Cache Update Completed API] Error:', authError);
    });
});
