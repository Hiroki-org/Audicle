import { fetchPlaylistsByItem } from '../playlist-queries';
import { SupabaseClient } from '@supabase/supabase-js';

describe('fetchPlaylistsByItem', () => {
    let mockSupabase: any;
    let queryBuilder: any;

    beforeEach(() => {
        queryBuilder = {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            order: jest.fn().mockReturnThis(),
            then: jest.fn()
        };

        mockSupabase = {
            from: jest.fn().mockReturnValue(queryBuilder)
        };
    });

    it('fetches playlists by item with default options', async () => {
        const mockData = [{ id: 'playlist1' }];
        queryBuilder.then.mockImplementation((cb: any) => cb({ data: mockData, error: null }));

        const result = await fetchPlaylistsByItem({
            supabase: mockSupabase as unknown as SupabaseClient,
            userEmail: 'test@example.com',
            itemId: 'item123',
            filterField: 'bookmark_id'
        });

        expect(mockSupabase.from).toHaveBeenCalledWith('playlists');
        expect(queryBuilder.select).toHaveBeenCalledWith('*, playlist_items!inner(bookmark_id)');
        expect(queryBuilder.eq).toHaveBeenCalledWith('owner_email', 'test@example.com');
        expect(queryBuilder.eq).toHaveBeenCalledWith('playlist_items.bookmark_id', 'item123');
        expect(queryBuilder.order).toHaveBeenCalledWith('position', { ascending: true });
        expect(queryBuilder.order).toHaveBeenCalledWith('is_default', { ascending: false });
        expect(queryBuilder.order).toHaveBeenCalledWith('created_at', { ascending: false });
        expect(result).toEqual({ playlistsWithItems: mockData, playlistsError: null });
    });

    it('fetches playlists by item without position sort', async () => {
        const mockData = [{ id: 'playlist1' }];
        queryBuilder.then.mockImplementation((cb: any) => cb({ data: mockData, error: null }));

        const result = await fetchPlaylistsByItem({
            supabase: mockSupabase as unknown as SupabaseClient,
            userEmail: 'test@example.com',
            itemId: 'item123',
            filterField: 'article_id',
            includePositionSort: false
        });

        expect(mockSupabase.from).toHaveBeenCalledWith('playlists');
        expect(queryBuilder.select).toHaveBeenCalledWith('*, playlist_items!inner(article_id)');
        expect(queryBuilder.eq).toHaveBeenCalledWith('owner_email', 'test@example.com');
        expect(queryBuilder.eq).toHaveBeenCalledWith('playlist_items.article_id', 'item123');
        expect(queryBuilder.order).not.toHaveBeenCalledWith('position', expect.any(Object));
        expect(queryBuilder.order).toHaveBeenCalledWith('is_default', { ascending: false });
        expect(queryBuilder.order).toHaveBeenCalledWith('created_at', { ascending: false });
        expect(result).toEqual({ playlistsWithItems: mockData, playlistsError: null });
    });

    it('handles query error', async () => {
        const mockError = { message: 'Database error' };
        queryBuilder.then.mockImplementation((cb: any) => cb({ data: null, error: mockError }));

        const result = await fetchPlaylistsByItem({
            supabase: mockSupabase as unknown as SupabaseClient,
            userEmail: 'test@example.com',
            itemId: 'item123',
            filterField: 'bookmark_id'
        });

        expect(result).toEqual({ playlistsWithItems: null, playlistsError: mockError });
    });
});
