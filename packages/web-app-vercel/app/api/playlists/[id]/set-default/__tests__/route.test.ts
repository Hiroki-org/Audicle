import { PUT } from '../route'
import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import * as supabaseLocal from '@/lib/supabaseLocal'
import { requireAuth } from '@/lib/api-auth'
import { shouldUseLocalSupabaseFallback } from '@/lib/auth-env'

// Mocking dependencies
jest.mock('@/lib/supabase', () => ({
    supabase: {
        from: jest.fn(),
        rpc: jest.fn()
    }
}))

jest.mock('@/lib/supabaseLocal', () => ({
    getPlaylistsForOwner: jest.fn(),
    setDefaultPlaylist: jest.fn()
}))

jest.mock('@/lib/api-auth', () => ({
    requireAuth: jest.fn()
}))

jest.mock('@/lib/auth-env', () => ({
    shouldUseLocalSupabaseFallback: jest.fn()
}))

describe('PUT /api/playlists/[id]/set-default', () => {
    let mockRequest: Request;
    let mockParams: Promise<{ id: string }>;

    beforeEach(() => {
        jest.clearAllMocks();
        mockRequest = new Request('http://localhost:3000/api/playlists/1/set-default', {
            method: 'PUT',
        });
        mockParams = Promise.resolve({ id: '1' });
    });

    it('returns response from requireAuth if auth fails', async () => {
        (requireAuth as jest.Mock).mockResolvedValue({
            response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        });

        const response = await PUT(mockRequest, { params: mockParams });
        expect(response.status).toBe(401);
        const data = await response.json();
        expect(data.error).toBe('Unauthorized');
    });

    it('returns 400 if userEmail is missing', async () => {
        (requireAuth as jest.Mock).mockResolvedValue({ userEmail: null });

        const response = await PUT(mockRequest, { params: mockParams });
        expect(response.status).toBe(400);
        const data = await response.json();
        expect(data.error).toBe('User email not found');
    });

    describe('Local Supabase Fallback', () => {
        beforeEach(() => {
            (shouldUseLocalSupabaseFallback as jest.Mock).mockReturnValue(true);
            (requireAuth as jest.Mock).mockResolvedValue({ userEmail: 'test@example.com' });
        });

        it('returns 403 if playlist not found', async () => {
            (supabaseLocal.getPlaylistsForOwner as jest.Mock).mockResolvedValue([]);

            const response = await PUT(mockRequest, { params: mockParams });
            expect(response.status).toBe(403);
            const data = await response.json();
            expect(data.error).toBe('Playlist not found or permission denied');
        });

        it('skips update if playlist is already default', async () => {
            (supabaseLocal.getPlaylistsForOwner as jest.Mock).mockResolvedValue([
                { id: '1', is_default: true }
            ]);

            const response = await PUT(mockRequest, { params: mockParams });
            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.message).toBe('このプレイリストは既にデフォルト設定されています');
        });

        it('updates default playlist successfully', async () => {
            (supabaseLocal.getPlaylistsForOwner as jest.Mock).mockResolvedValue([
                { id: '1', is_default: false }
            ]);
            (supabaseLocal.setDefaultPlaylist as jest.Mock).mockResolvedValue(true);

            const response = await PUT(mockRequest, { params: mockParams });
            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.success).toBe(true);
            expect(supabaseLocal.setDefaultPlaylist).toHaveBeenCalledWith('test@example.com', '1');
        });
    });

    describe('Supabase Mode', () => {
        beforeEach(() => {
            (shouldUseLocalSupabaseFallback as jest.Mock).mockReturnValue(false);
            (requireAuth as jest.Mock).mockResolvedValue({ userEmail: 'test@example.com' });
        });

        it('returns 403 if playlist not found or error', async () => {
            const mockSelect = jest.fn().mockReturnThis();
            const mockEq1 = jest.fn().mockReturnThis();
            const mockEq2 = jest.fn().mockReturnThis();
            const mockSingle = jest.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } });

            (supabase.from as jest.Mock).mockReturnValue({
                select: mockSelect,
                eq: mockEq1.mockReturnValue({
                    eq: mockEq2.mockReturnValue({
                        single: mockSingle
                    })
                })
            });

            const response = await PUT(mockRequest, { params: mockParams });
            expect(response.status).toBe(403);
        });

        it('skips update if playlist is already default', async () => {
            const mockSingle = jest.fn().mockResolvedValue({
                data: { id: '1', owner_email: 'test@example.com', is_default: true },
                error: null
            });

            (supabase.from as jest.Mock).mockReturnValue({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                single: mockSingle
            });

            // Adjust the chaining to match how it's used
            (supabase.from as jest.Mock).mockImplementation(() => ({
                select: () => ({
                    eq: () => ({
                        eq: () => ({
                            single: mockSingle
                        })
                    })
                })
            }));

            const response = await PUT(mockRequest, { params: mockParams });
            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.message).toBe('このプレイリストは既にデフォルト設定されています');
        });

        it('returns 500 if RPC fails', async () => {
             const mockSingle = jest.fn().mockResolvedValue({
                data: { id: '1', owner_email: 'test@example.com', is_default: false },
                error: null
            });

            (supabase.from as jest.Mock).mockImplementation(() => ({
                select: () => ({
                    eq: () => ({
                        eq: () => ({
                            single: mockSingle
                        })
                    })
                })
            }));

            (supabase.rpc as jest.Mock).mockResolvedValue({ error: new Error('RPC Error') });

            const response = await PUT(mockRequest, { params: mockParams });
            expect(response.status).toBe(500);
            const data = await response.json();
            expect(data.error).toBe('Failed to set default playlist');
        });

        it('updates default playlist successfully', async () => {
            const mockSingle = jest.fn().mockResolvedValue({
                data: { id: '1', owner_email: 'test@example.com', is_default: false },
                error: null
            });

            (supabase.from as jest.Mock).mockImplementation(() => ({
                select: () => ({
                    eq: () => ({
                        eq: () => ({
                            single: mockSingle
                        })
                    })
                })
            }));

            (supabase.rpc as jest.Mock).mockResolvedValue({ data: { success: true }, error: null });

            const response = await PUT(mockRequest, { params: mockParams });
            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.success).toBe(true);
            expect(supabase.rpc).toHaveBeenCalledWith('set_default_playlist', {
                p_playlist_id: '1',
                p_user_email: 'test@example.com'
            });
        });
    });

    it('catches generic errors and returns 500', async () => {
        (requireAuth as jest.Mock).mockRejectedValue(new Error('Unexpected error'));

        const response = await PUT(mockRequest, { params: mockParams });
        expect(response.status).toBe(500);
        const data = await response.json();
        expect(data.error).toBe('Internal server error');
    });
});
