import { fetchPlaylistsByItem } from '../playlist-queries';
import { SupabaseClient } from '@supabase/supabase-js';

type QueryResult = {
    data: unknown[] | null;
    error: unknown | null;
};

interface MockQueryBuilder extends PromiseLike<QueryResult> {
    select: jest.Mock<MockQueryBuilder, [string]>;
    eq: jest.Mock<MockQueryBuilder, [string, string]>;
    order: jest.Mock<MockQueryBuilder, [string, { ascending: boolean }]>;
}

describe('fetchPlaylistsByItem', () => {
    let mockSupabase: jest.Mocked<SupabaseClient>;
    let mockQueryBuilder: MockQueryBuilder;
    let mockQueryResult: QueryResult;

    beforeEach(() => {
        mockQueryResult = { data: null, error: null };
        mockQueryBuilder = {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            order: jest.fn().mockReturnThis(),
            then: jest.fn((onFulfilled, onRejected) =>
                Promise.resolve(mockQueryResult).then(onFulfilled, onRejected)
            ),
        };

        mockSupabase = {
            from: jest.fn().mockReturnValue(mockQueryBuilder),
        } as unknown as jest.Mocked<SupabaseClient>;
    });

    it('should fetch playlists with position sort when includePositionSort is true', async () => {
        const mockData = [{ id: 'playlist1' }];
        mockQueryResult = { data: mockData, error: null };

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

    it('should use position sort by default', async () => {
        const mockData = [{ id: 'playlist-default' }];
        mockQueryResult = { data: mockData, error: null };

        const result = await fetchPlaylistsByItem({
            supabase: mockSupabase,
            userEmail: 'test@example.com',
            itemId: 'item123',
            filterField: 'article_id',
        });

        expect(mockQueryBuilder.order).toHaveBeenCalledWith('position', { ascending: true });
        expect(mockQueryBuilder.order).toHaveBeenCalledWith('is_default', { ascending: false });
        expect(mockQueryBuilder.order).toHaveBeenCalledWith('created_at', { ascending: false });
        expect(result).toEqual({ playlistsWithItems: mockData, playlistsError: null });
    });

    it('should fetch playlists without position sort when includePositionSort is false', async () => {
        const mockData = [{ id: 'playlist2' }];
        mockQueryResult = { data: mockData, error: null };

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
        mockQueryResult = { data: null, error: mockError };

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
