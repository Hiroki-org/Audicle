import { NextRequest } from 'next/server';
import { POST } from '../route';
import { auth } from '@/lib/auth';
import { removeCachedChunk } from '@/lib/db/cacheIndex';
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
    beforeEach(() => {
        jest.clearAllMocks();
        // Setup default auth mock
        (auth as jest.Mock).mockResolvedValue({ user: { email: 'test@example.com' } });
        (calculateTextHash as jest.Mock).mockReturnValue('mock-hash-123');
    });

    const createRequest = (body: any) => {
        return new NextRequest('http://localhost/api/cache/remove', {
            method: 'POST',
            body: JSON.stringify(body),
            headers: new Headers({
                'Content-Type': 'application/json',
                'x-request-id': 'req-123'
            }),
        });
    };

    const validBody = {
        articleUrl: 'https://example.com',
        voice: 'en-US-Wavenet-D',
        text: 'Hello world',
        index: 0
    };

    it('returns 401 when unauthorized', async () => {
        (auth as jest.Mock).mockResolvedValue(null);

        const request = createRequest(validBody);
        const response = await POST(request);

        expect(response.status).toBe(401);
        const data = await response.json();
        expect(data).toEqual({ error: 'Unauthorized' });
    });

    it('returns 400 when required fields are missing', async () => {
        const invalidBody = {
            articleUrl: 'https://example.com',
            // voice missing
            text: 'Hello world',
            index: 0
        };

        const request = createRequest(invalidBody);
        const response = await POST(request);

        expect(response.status).toBe(400);
        const data = await response.json();
        expect(data.error).toContain('required');
    });

    it('returns 400 when index is missing (undefined)', async () => {
         const invalidBody = {
            articleUrl: 'https://example.com',
            voice: 'en-US-Wavenet-D',
            text: 'Hello world',
            // index missing
        };

        const request = createRequest(invalidBody);
        const response = await POST(request);

        expect(response.status).toBe(400);
    });

    it('returns 200 when index is 0 (falsy but valid)', async () => {
         const request = createRequest({ ...validBody, index: 0 });
         const response = await POST(request);
         expect(response.status).toBe(200);
    });

    it('calls removeCachedChunk with correct parameters and returns 200', async () => {
        const request = createRequest(validBody);
        const response = await POST(request);

        expect(calculateTextHash).toHaveBeenCalledWith(validBody.text, validBody.index);
        expect(removeCachedChunk).toHaveBeenCalledWith(
            validBody.articleUrl,
            validBody.voice,
            'mock-hash-123'
        );

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data).toEqual({ success: true });
    });

    it('returns 500 when removeCachedChunk throws an error', async () => {
        (removeCachedChunk as jest.Mock).mockRejectedValue(new Error('DB error'));

        const request = createRequest(validBody);
        const response = await POST(request);

        expect(response.status).toBe(500);
        const data = await response.json();
        expect(data).toEqual({ error: 'Failed to remove cached chunk' });
    });
});
