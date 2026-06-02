import { NextRequest } from 'next/server';
import { POST } from '../route';
import { removeCachedChunk } from '@/lib/db/cacheIndex';
import { auth } from '@/lib/auth';
import { calculateTextHash } from '@/lib/textHash';

jest.mock('@/lib/auth', () => ({
    auth: jest.fn(),
}));

jest.mock('@/lib/db/cacheIndex', () => ({
    removeCachedChunk: jest.fn(),
}));

jest.mock('@/lib/textHash', () => ({
    calculateTextHash: jest.fn(),
}));

describe('POST /api/cache/remove', () => {
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
        return new NextRequest('http://localhost:3000/api/cache/remove', {
            method: 'POST',
            body: JSON.stringify(body),
        });
    };

    it('returns 401 if user is not authenticated', async () => {
        (auth as jest.Mock).mockResolvedValue(null);

        const request = mockRequest({ articleUrl: 'url', voice: 'v1', text: 'txt', index: 0 });
        const response = await POST(request);

        expect(response.status).toBe(401);
        const data = await response.json();
        expect(data).toEqual({ error: 'Unauthorized' });
        expect(consoleErrorMock).toHaveBeenCalled();
    });

    it('returns 400 if required parameters are missing', async () => {
        (auth as jest.Mock).mockResolvedValue({ user: { id: 'test-user' } });

        const request = mockRequest({ articleUrl: 'url' }); // missing voice, text, index
        const response = await POST(request);

        expect(response.status).toBe(400);
        const data = await response.json();
        expect(data).toEqual({ error: 'articleUrl, voice, text, and index are required' });
    });

    it('returns 400 if index is missing', async () => {
        (auth as jest.Mock).mockResolvedValue({ user: { id: 'test-user' } });

        const request = mockRequest({ articleUrl: 'url', voice: 'v1', text: 'txt' });
        const response = await POST(request);

        expect(response.status).toBe(400);
    });

    it('returns 500 if an error occurs during removal', async () => {
        (auth as jest.Mock).mockResolvedValue({ user: { id: 'test-user' } });
        (calculateTextHash as jest.Mock).mockReturnValue('mock-hash');
        (removeCachedChunk as jest.Mock).mockRejectedValue(new Error('DB error'));

        const request = mockRequest({ articleUrl: 'url', voice: 'v1', text: 'txt', index: 0 });
        const response = await POST(request);

        expect(response.status).toBe(500);
        const data = await response.json();
        expect(data).toEqual({ error: 'Failed to remove cached chunk' });
        expect(consoleErrorMock).toHaveBeenCalled();
    });

    it('returns 200 on successful removal', async () => {
        (auth as jest.Mock).mockResolvedValue({ user: { id: 'test-user' } });
        (calculateTextHash as jest.Mock).mockReturnValue('mock-hash');
        (removeCachedChunk as jest.Mock).mockResolvedValue(undefined);

        const request = mockRequest({ articleUrl: 'url', voice: 'v1', text: 'txt', index: 0 });
        const response = await POST(request);

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data).toEqual({ success: true });

        expect(calculateTextHash).toHaveBeenCalledWith('txt', 0);
        expect(removeCachedChunk).toHaveBeenCalledWith('url', 'v1', 'mock-hash');
    });
});
