import { GET } from '../route';
import { auth } from '@/lib/auth';
import { DEFAULT_SETTINGS } from '@/types/settings';

// Mock auth
jest.mock('@/lib/auth', () => ({
    auth: jest.fn(),
}));

// Simplify supabase mock setup
const mockSingle = jest.fn();
jest.mock('@/lib/supabase', () => {
    const mockChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: () => mockSingle(),
    };
    return {
        supabase: {
            from: jest.fn(() => mockChain),
        },
    };
});

describe('GET /api/settings/get', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockSingle.mockReset();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('returns 401 when unauthenticated', async () => {
        (auth as jest.Mock).mockResolvedValue(null);

        const res = await GET();
        expect(res.status).toBe(401);
    });

    it('returns 401 when session exists but has no user id', async () => {
        (auth as jest.Mock).mockResolvedValue({ user: { name: 'Test' } });

        const res = await GET();
        expect(res.status).toBe(401);
    });

    it('returns 200 and user settings when found', async () => {
        (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-123' } });

        const mockSettings = {
            playback_speed: 1.5,
            voice_model: 'en-US-Wavenet-C',
            language: 'en-US',
            color_theme: 'purple',
        };

        mockSingle.mockResolvedValue({ data: mockSettings, error: null });

        const res = await GET();
        expect(res.status).toBe(200);

        const data = await res.json();
        expect(data).toEqual(mockSettings);
    });

    it('returns 200 and default settings when no settings exist (PGRST116)', async () => {
        (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-123' } });

        mockSingle.mockResolvedValue({
            data: null,
            error: { code: 'PGRST116' }
        });

        const res = await GET();
        expect(res.status).toBe(200);

        const data = await res.json();
        expect(data).toMatchObject(DEFAULT_SETTINGS);
    });

    it('returns 500 when supabase throws a general error', async () => {
        (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-123' } });

        mockSingle.mockResolvedValue({
            data: null,
            error: { message: 'Database connection failed' }
        });

        jest.spyOn(console, 'error').mockImplementation(() => {});

        const res = await GET();
        expect(res.status).toBe(500);
    });

    it('returns 500 on unexpected exceptions', async () => {
        (auth as jest.Mock).mockRejectedValue(new Error('Unexpected auth failure'));

        jest.spyOn(console, 'error').mockImplementation(() => {});

        const res = await GET();
        expect(res.status).toBe(500);
    });
});
