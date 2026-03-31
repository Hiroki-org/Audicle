/** @jest-environment node */
import { requireAuth } from '../api-auth';
import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';

jest.mock('@/lib/auth', () => ({
    auth: jest.fn(),
}));

jest.mock('next/server', () => ({
    NextResponse: {
        json: jest.fn((body, init) => ({
            status: init?.status ?? 200,
            json: async () => body,
        })),
    },
}));

describe('requireAuth', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('returns 401 response if session is null', async () => {
        (auth as jest.Mock).mockResolvedValueOnce(null);

        const result = await requireAuth();

        expect(result.userEmail).toBeNull();
        expect(result.response).not.toBeNull();
        expect(result.response?.status).toBe(401);
        const body = await result.response?.json();
        expect(body).toEqual({ error: 'Unauthorized' });
        expect(NextResponse.json).toHaveBeenCalledWith(
            { error: 'Unauthorized' },
            { status: 401 }
        );
    });

    it('returns 401 response if user email is missing', async () => {
        (auth as jest.Mock).mockResolvedValueOnce({
            user: { name: 'Test User' } // no email
        });

        const result = await requireAuth();

        expect(result.userEmail).toBeNull();
        expect(result.response).not.toBeNull();
        expect(result.response?.status).toBe(401);
        const body = await result.response?.json();
        expect(body).toEqual({ error: 'Unauthorized' });
    });

    it('returns userEmail if session is valid', async () => {
        (auth as jest.Mock).mockResolvedValueOnce({
            user: { email: 'test@example.com' }
        });

        const result = await requireAuth();

        expect(result.userEmail).toBe('test@example.com');
        expect(result.response).toBeNull();
    });
});
