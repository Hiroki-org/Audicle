import { NextRequest } from 'next/server';
import { GET } from '../route';
import { requireAuth } from '@/lib/api-auth';
import { getOrCreateDefaultPlaylist } from '@/lib/playlist-utils';

jest.mock('@/lib/api-auth', () => ({
    requireAuth: jest.fn()
}));

jest.mock('@/lib/playlist-utils', () => ({
    getOrCreateDefaultPlaylist: jest.fn()
}));

describe('GET /api/playlists/default', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should return 401 if authentication fails', async () => {
        const mockAuthResponse = new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
        (requireAuth as jest.Mock).mockResolvedValue({ userEmail: null, response: mockAuthResponse });

        const response = await GET();
        const json = await response.json();

        expect(response.status).toBe(401);
        expect(json.error).toBe('Unauthorized');
    });

    it('should return 500 if getOrCreateDefaultPlaylist returns an error', async () => {
        (requireAuth as jest.Mock).mockResolvedValue({ userEmail: 'test@example.com', response: null });
        (getOrCreateDefaultPlaylist as jest.Mock).mockResolvedValue({ error: 'Database error', playlist: null });

        const response = await GET();
        const json = await response.json();

        expect(response.status).toBe(500);
        expect(json.error).toBe('Database error');
    });

    it('should return 500 if getOrCreateDefaultPlaylist returns no playlist and no error', async () => {
        (requireAuth as jest.Mock).mockResolvedValue({ userEmail: 'test@example.com', response: null });
        (getOrCreateDefaultPlaylist as jest.Mock).mockResolvedValue({ error: null, playlist: null });

        const response = await GET();
        const json = await response.json();

        expect(response.status).toBe(500);
        expect(json.error).toBe('Failed to get default playlist');
    });

    it('should return the playlist if successfully retrieved or created', async () => {
        const mockPlaylist = { id: 'default-123', name: 'Default Playlist', items: [] };
        (requireAuth as jest.Mock).mockResolvedValue({ userEmail: 'test@example.com', response: null });
        (getOrCreateDefaultPlaylist as jest.Mock).mockResolvedValue({ error: null, playlist: mockPlaylist });

        const response = await GET();
        const json = await response.json();

        expect(response.status).toBe(200);
        expect(json).toEqual(mockPlaylist);
    });

    it('should handle unexpected errors and return 500', async () => {
        jest.spyOn(console, 'error').mockImplementation(() => {});
        (requireAuth as jest.Mock).mockRejectedValue(new Error('Unexpected failure'));

        const response = await GET();
        const json = await response.json();

        expect(response.status).toBe(500);
        expect(json.error).toBe('Internal server error');
    });
});
