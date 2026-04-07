/** @jest-environment node */

import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { auth } from '@/lib/auth';

// Mock the auth function
jest.mock('@/lib/auth', () => ({
    auth: jest.fn(),
}));

// Mock NextResponse
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

    it('returns 401 Unauthorized when session is null', async () => {
        (auth as jest.Mock).mockResolvedValue(null);

        const result = await requireAuth();

        expect(auth).toHaveBeenCalledTimes(1);
        expect(result.userEmail).toBeNull();
        expect(NextResponse.json).toHaveBeenCalledWith(
            { error: 'Unauthorized' },
            { status: 401 }
        );
        expect(result.response?.status).toBe(401);
    });

    it('returns 401 Unauthorized when session exists but user email is missing', async () => {
        (auth as jest.Mock).mockResolvedValue({
            user: { name: 'Test User' }, // email is missing
        });

        const result = await requireAuth();

        expect(auth).toHaveBeenCalledTimes(1);
        expect(result.userEmail).toBeNull();
        expect(NextResponse.json).toHaveBeenCalledWith(
            { error: 'Unauthorized' },
            { status: 401 }
        );
        expect(result.response?.status).toBe(401);
    });

    it('returns 401 Unauthorized when session exists but user is missing', async () => {
        (auth as jest.Mock).mockResolvedValue({}); // user is missing

        const result = await requireAuth();

        expect(auth).toHaveBeenCalledTimes(1);
        expect(result.userEmail).toBeNull();
        expect(NextResponse.json).toHaveBeenCalledWith(
            { error: 'Unauthorized' },
            { status: 401 }
        );
        expect(result.response?.status).toBe(401);
    });

    it('returns userEmail and null response when session and email are valid', async () => {
        const testEmail = 'test@example.com';
        (auth as jest.Mock).mockResolvedValue({
            user: { email: testEmail },
        });

        const result = await requireAuth();

        expect(auth).toHaveBeenCalledTimes(1);
        expect(result.userEmail).toBe(testEmail);
        expect(result.response).toBeNull();
        expect(NextResponse.json).not.toHaveBeenCalled();
    });
});
