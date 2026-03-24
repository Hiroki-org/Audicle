/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server';

// Mock dependencies
jest.mock('@/lib/auth', () => ({
    auth: jest.fn(),
}));

const mockSelect = jest.fn();
const mockSingle = jest.fn();
const mockUpsert = jest.fn();

jest.mock('@/lib/supabase', () => ({
    supabase: {
        from: jest.fn(() => ({
            upsert: mockUpsert,
        })),
    },
}));

// Mock NextRequest and NextResponse
jest.mock('next/server', () => ({
    NextRequest: jest.fn().mockImplementation((url, init) => ({
        json: jest.fn().mockResolvedValue(init?.body ? JSON.parse(init.body as string) : {}),
        url,
    })),
    NextResponse: {
        json: jest.fn().mockImplementation((body, init) => {
            return {
                status: init?.status ?? 200,
                json: async () => body,
            };
        }),
    },
}));

import { auth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { PUT } from '../route';

// Helper to create a mocked NextRequest with a JSON body
const createMockRequest = (body: Record<string, unknown>) => {
    return new NextRequest('http://localhost/api/settings/update', {
        method: 'PUT',
        body: JSON.stringify(body),
    });
};

describe('PUT /api/settings/update', () => {
    beforeEach(() => {
        jest.clearAllMocks();

        // Setup default mock returns for Supabase chain
        mockUpsert.mockReturnValue({ select: mockSelect });
        mockSelect.mockReturnValue({ single: mockSingle });
        mockSingle.mockResolvedValue({
            data: {
                playback_speed: 1.5,
                voice_model: 'ja-JP-Standard-B',
                language: 'ja-JP',
                color_theme: 'ocean',
            },
            error: null,
        });

        // Setup default authenticated user
        (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-123' } });
    });

    it('returns 401 when unauthenticated', async () => {
        (auth as jest.Mock).mockResolvedValue(null);

        const req = createMockRequest({ playback_speed: 1.5 });
        const res = await PUT(req);
        const body = await (res as any).json();

        expect(res.status).toBe(401);
        expect(body.error).toBe('Unauthorized');
        expect(body.success).toBe(false);
    });

    it('returns 401 when session has no user ID', async () => {
        (auth as jest.Mock).mockResolvedValue({ user: { email: 'test@example.com' } }); // No id

        const req = createMockRequest({ playback_speed: 1.5 });
        const res = await PUT(req);
        const body = await (res as any).json();

        expect(res.status).toBe(401);
        expect(body.error).toBe('Unauthorized');
        expect(body.success).toBe(false);
    });

    it('returns 400 when playback_speed is invalid', async () => {
        const req = createMockRequest({ playback_speed: 5.0 }); // Invalid speed (> 3.0)
        const res = await PUT(req);
        const body = await (res as any).json();

        expect(res.status).toBe(400);
        expect(body.error).toContain('Invalid playback_speed');
        expect(body.success).toBe(false);
    });

    it('returns 400 when voice_model is invalid', async () => {
        const req = createMockRequest({ voice_model: 'invalid-model' });
        const res = await PUT(req);
        const body = await (res as any).json();

        expect(res.status).toBe(400);
        expect(body.error).toContain('Invalid voice_model');
        expect(body.success).toBe(false);
    });

    it('returns 400 when language is invalid', async () => {
        const req = createMockRequest({ language: 'fr-FR' });
        const res = await PUT(req);
        const body = await (res as any).json();

        expect(res.status).toBe(400);
        expect(body.error).toContain('Invalid language');
        expect(body.success).toBe(false);
    });

    it('returns 400 when color_theme is invalid', async () => {
        const req = createMockRequest({ color_theme: 'neon' });
        const res = await PUT(req);
        const body = await (res as any).json();

        expect(res.status).toBe(400);
        expect(body.error).toContain('Invalid color_theme');
        expect(body.success).toBe(false);
    });

    it('returns 400 with combined error messages for multiple invalid inputs', async () => {
        const req = createMockRequest({
            playback_speed: 0.1, // invalid
            language: 'es-ES' // invalid
        });
        const res = await PUT(req);
        const body = await (res as any).json();

        expect(res.status).toBe(400);
        expect(body.error).toContain('Invalid playback_speed');
        expect(body.error).toContain('Invalid language');
        expect(body.success).toBe(false);
    });

    it('returns 200 and updates settings on success', async () => {
        const req = createMockRequest({
            playback_speed: 1.5,
            voice_model: 'ja-JP-Standard-B',
        });
        const res = await PUT(req);
        const body = await (res as any).json();

        expect(res.status).toBe(200);
        expect(body.success).toBe(true);
        expect(body.message).toBe('Settings updated successfully');
        expect(body.data).toBeDefined();

        // Verify Supabase was called with correct data
        expect(supabase.from).toHaveBeenCalledWith('user_settings');
        expect(mockUpsert).toHaveBeenCalledWith(
            {
                user_id: 'user-123',
                playback_speed: 1.5,
                voice_model: 'ja-JP-Standard-B',
            },
            { onConflict: 'user_id' }
        );
    });

    it('returns 500 when Supabase update fails', async () => {
        // Simulate Supabase error
        mockSingle.mockResolvedValue({
            data: null,
            error: new Error('Database error'),
        });

        const req = createMockRequest({ playback_speed: 1.5 });
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

        const res = await PUT(req);
        const body = await (res as any).json();

        expect(res.status).toBe(500);
        expect(body.success).toBe(false);
        expect(body.error).toBe('Failed to update settings');

        consoleSpy.mockRestore();
    });

    it('returns 500 on unexpected server error (e.g. JSON parsing fails)', async () => {
        // Create a request that throws when json() is called
        const req = {
            json: jest.fn().mockRejectedValue(new Error('Failed to parse JSON')),
        } as unknown as NextRequest;

        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

        const res = await PUT(req);
        const body = await (res as any).json();

        expect(res.status).toBe(500);
        expect(body.success).toBe(false);
        expect(body.error).toBe('Internal server error');

        consoleSpy.mockRestore();
    });
});
