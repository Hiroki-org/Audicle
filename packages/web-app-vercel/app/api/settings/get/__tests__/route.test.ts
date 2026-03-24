import { GET } from '../route';
import { auth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { DEFAULT_SETTINGS } from '@/types/settings';

// Mock auth
jest.mock('@/lib/auth', () => ({
    auth: jest.fn(),
}));

// Setup mock variables for supabase chaining
const mockSingle = jest.fn();
const mockEq = jest.fn(() => ({ single: mockSingle }));
const mockSelect = jest.fn(() => ({ eq: mockEq }));
const mockFrom = jest.fn(() => ({ select: mockSelect }));

// Mock supabase with a factory function that returns the mock variables
jest.mock('@/lib/supabase', () => ({
    supabase: {
        from: jest.fn((table) => mockFrom(table)),
    },
}));

describe('GET /api/settings/get', () => {
    beforeEach(() => {
        jest.clearAllMocks();

        // Reset supabase chain mocks default behavior
        mockFrom.mockImplementation(() => ({ select: mockSelect }));
        mockSelect.mockImplementation(() => ({ eq: mockEq }));
        mockEq.mockImplementation(() => ({ single: mockSingle }));
    });

    it('returns 401 when unauthenticated', async () => {
        (auth as jest.Mock).mockResolvedValue(null);

        const res = await GET();
        expect(res.status).toBe(401);

        const data = await res.json();
        expect(data).toEqual({ error: 'Unauthorized' });
    });

    it('returns 401 when session exists but has no user id', async () => {
        (auth as jest.Mock).mockResolvedValue({ user: { name: 'Test' } });

        const res = await GET();
        expect(res.status).toBe(401);

        const data = await res.json();
        expect(data).toEqual({ error: 'Unauthorized' });
    });

    it('returns 200 and user settings when found', async () => {
        (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-123' } });

        const mockSettings = {
            playback_speed: 1.5,
            voice_model: 'en-US-Wavenet-C',
            language: 'en-US',
            color_theme: 'purple',
            created_at: '2025-01-01T00:00:00Z',
            updated_at: '2025-01-01T00:00:00Z',
        };

        mockSingle.mockResolvedValue({ data: mockSettings, error: null });

        const res = await GET();
        expect(res.status).toBe(200);

        // Verify supabase was called correctly
        expect(mockFrom).toHaveBeenCalledWith('user_settings');
        expect(mockSelect).toHaveBeenCalledWith('playback_speed, voice_model, language, color_theme, created_at, updated_at');
        expect(mockEq).toHaveBeenCalledWith('user_id', 'user-123');

        const data = await res.json();
        expect(data).toEqual(mockSettings);
    });

    it('returns 200 and default settings when no settings exist (PGRST116)', async () => {
        (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-123' } });

        mockSingle.mockResolvedValue({
            data: null,
            error: { code: 'PGRST116', message: 'The result contains 0 rows' }
        });

        const res = await GET();
        expect(res.status).toBe(200);

        const data = await res.json();
        // Since undefined properties are stripped during JSON serialization,
        // we assert against the exact keys expected.
        expect(data).toEqual({
            playback_speed: DEFAULT_SETTINGS.playback_speed,
            voice_model: DEFAULT_SETTINGS.voice_model,
            language: DEFAULT_SETTINGS.language,
            color_theme: DEFAULT_SETTINGS.color_theme,
        });

        expect(data.created_at).toBeUndefined();
        expect(data.updated_at).toBeUndefined();
    });

    it('returns 500 when supabase throws a general error', async () => {
        (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-123' } });

        mockSingle.mockResolvedValue({
            data: null,
            error: { message: 'Database connection failed' }
        });

        // Spy on console.error to keep test output clean
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

        const res = await GET();
        expect(res.status).toBe(500);

        const data = await res.json();
        expect(data).toEqual({ error: 'Failed to fetch settings' });

        consoleSpy.mockRestore();
    });

    it('returns 500 on unexpected exceptions', async () => {
        (auth as jest.Mock).mockRejectedValue(new Error('Unexpected auth failure'));

        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

        const res = await GET();
        expect(res.status).toBe(500);

        const data = await res.json();
        expect(data).toEqual({ error: 'Internal server error' });

        consoleSpy.mockRestore();
    });
});
