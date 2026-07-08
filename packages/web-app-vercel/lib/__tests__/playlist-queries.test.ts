import { fetchPlaylistsByItem } from '../playlist-queries';
import { SupabaseClient } from '@supabase/supabase-js';

describe('fetchPlaylistsByItem', () => {
    let mockSupabase: jest.Mocked<SupabaseClient>;
    let mockQueryBuilder: any;

    beforeEach(() => {
        mockQueryBuilder = {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
        };
        // Setup order chain properly to handle query = query.order() chaining
        mockQueryBuilder.order = jest.fn().mockReturnThis();

        mockSupabase = {
            from: jest.fn().mockReturnValue(mockQueryBuilder),
        } as unknown as jest.Mocked<SupabaseClient>;
    });

    it('should fetch playlists with position sort when includePositionSort is true', async () => {
        const mockData = [{ id: 'playlist1' }];

        // Ensure the last call to order returns a promise
        mockQueryBuilder.order.mockImplementation((field: string, options: any) => {
             if (field === 'created_at') {
                 return Promise.resolve({ data: mockData, error: null });
             }
             return mockQueryBuilder;
        });

        const result = await fetchPlaylistsByItem({
            supabase: mockSupabase,
            userEmail: 'test@example.com',
            itemId: 'item123',
            filterField: 'article_id',
            includePositionSort: true,
        });

        expect(mockSupabase.from).toHaveBeenCalledWith('playlists');
        expect(mockQueryBuilder.select).toHaveBeenCalledWith('*, playlist_items!inner(article_id)');
        expect(mockQueryBuilder.eq).toHaveBeenCalledWith('owner_email', 'test@example.com');
        expect(mockQueryBuilder.eq).toHaveBeenCalledWith('playlist_items.article_id', 'item123');
        expect(mockQueryBuilder.order).toHaveBeenCalledWith('position', { ascending: true });
        expect(mockQueryBuilder.order).toHaveBeenCalledWith('is_default', { ascending: false });
        expect(mockQueryBuilder.order).toHaveBeenCalledWith('created_at', { ascending: false });

        expect(result).toEqual({ playlistsWithItems: mockData, playlistsError: null });
    });

    it('should fetch playlists without position sort when includePositionSort is false', async () => {
        const mockData = [{ id: 'playlist2' }];

        mockQueryBuilder.order.mockImplementation((field: string, options: any) => {
             if (field === 'created_at') {
                 return Promise.resolve({ data: mockData, error: null });
             }
             return mockQueryBuilder;
        });

        const result = await fetchPlaylistsByItem({
            supabase: mockSupabase,
            userEmail: 'test@example.com',
            itemId: 'item123',
            filterField: 'bookmark_id',
            includePositionSort: false,
        });

        expect(mockSupabase.from).toHaveBeenCalledWith('playlists');
        expect(mockQueryBuilder.select).toHaveBeenCalledWith('*, playlist_items!inner(bookmark_id)');
        expect(mockQueryBuilder.eq).toHaveBeenCalledWith('owner_email', 'test@example.com');
        expect(mockQueryBuilder.eq).toHaveBeenCalledWith('playlist_items.bookmark_id', 'item123');
        expect(mockQueryBuilder.order).not.toHaveBeenCalledWith('position', { ascending: true });
        expect(mockQueryBuilder.order).toHaveBeenCalledWith('is_default', { ascending: false });
        expect(mockQueryBuilder.order).toHaveBeenCalledWith('created_at', { ascending: false });

        expect(result).toEqual({ playlistsWithItems: mockData, playlistsError: null });
    });

    it('should handle errors from supabase', async () => {
        const mockError = new Error('Database error');

        mockQueryBuilder.order.mockImplementation((field: string, options: any) => {
             if (field === 'created_at') {
                 return Promise.resolve({ data: null, error: mockError });
             }
             return mockQueryBuilder;
        });

        const result = await fetchPlaylistsByItem({
            supabase: mockSupabase,
            userEmail: 'test@example.com',
            itemId: 'item123',
            filterField: 'article_id',
            includePositionSort: true,
        });

        expect(result).toEqual({ playlistsWithItems: null, playlistsError: mockError });
    });
});
