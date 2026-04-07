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

    it.each([
        ['session is null', null],
        ['session exists but user is missing', {}],
        ['session exists but user email is missing', { user: { name: 'Test User' } }],
        ['session exists but user email is an empty string', { user: { email: '' } }],
    ])('returns 401 Unauthorized when %s', async (_scenario, mockSession) => {
        (auth as jest.Mock).mockResolvedValue(mockSession);

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
