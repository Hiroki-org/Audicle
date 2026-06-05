// packages/web-app-vercel/lib/__tests__/playlist-utils.test.ts
import { getOrCreateDefaultPlaylist } from '../playlist-utils';
import * as supabaseLocal from '../supabaseLocal';
import { supabase } from '../supabase';

const ORIGINAL_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;

// supabaseLocalモジュールのモック
jest.mock('../supabaseLocal', () => ({
  getPlaylistsForOwner: jest.fn(),
  createPlaylist: jest.fn(),
  setDefaultPlaylist: jest.fn(),
}));

// supabaseモジュールのモック
jest.mock('../supabase', () => ({
  supabase: {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    single: jest.fn(),
    insert: jest.fn().mockReturnThis(),
  },
}));

// モックされた関数に型を適用
const mockedSupabaseLocal = supabaseLocal as jest.Mocked<typeof supabaseLocal>;
const mockedSupabase = supabase as jest.Mocked<any>;

describe('getOrCreateDefaultPlaylist', () => {
  afterEach(() => {
    jest.clearAllMocks();

    // Restore env to avoid leaking state across tests/suites.
    if (typeof ORIGINAL_SUPABASE_URL === "string") {
      process.env.NEXT_PUBLIC_SUPABASE_URL = ORIGINAL_SUPABASE_URL;
    } else {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    }
  });

  describe('local fallback (no SUPABASE_URL)', () => {
    const userEmail = 'test@example.com';

    beforeEach(() => {
      // Ensure we always test the local fallback path, even if the host
      // environment sets NEXT_PUBLIC_SUPABASE_URL.
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    });

    it('should return existing default playlist', async () => {
      const existingPlaylist = {
        id: '1',
        is_default: true,
        playlist_items: [],
        items: [],
        owner_email: userEmail,
        name: 'Default Playlist',
        description: 'Default playlist description',
        visibility: 'private' as const,
        allow_fork: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      mockedSupabaseLocal.getPlaylistsForOwner.mockResolvedValue([existingPlaylist]);

      const { playlist, error } = await getOrCreateDefaultPlaylist(userEmail);

      expect(error).toBeUndefined();
      expect(playlist).toBeDefined();
      expect(playlist?.id).toBe('1');
      expect(playlist?.is_default).toBe(true);
      expect(mockedSupabaseLocal.getPlaylistsForOwner).toHaveBeenCalledWith(userEmail);
      expect(mockedSupabaseLocal.createPlaylist).not.toHaveBeenCalled();
      expect(mockedSupabaseLocal.setDefaultPlaylist).not.toHaveBeenCalled();
    });

    it('should create a new default playlist if one does not exist', async () => {
      const newPlaylist = {
        id: '2',
        owner_email: userEmail,
        name: '読み込んだ記事',
        description: '読み込んだ記事が自動的に追加されます',
        visibility: 'private' as const,
        is_default: false,
        allow_fork: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      mockedSupabaseLocal.getPlaylistsForOwner.mockResolvedValue([]);
      mockedSupabaseLocal.createPlaylist.mockResolvedValue(newPlaylist);

      const { playlist, error } = await getOrCreateDefaultPlaylist(userEmail);

      expect(error).toBeUndefined();
      expect(playlist).toBeDefined();
      expect(playlist?.id).toBe('2');
      expect(mockedSupabaseLocal.getPlaylistsForOwner).toHaveBeenCalledWith(userEmail);
      expect(mockedSupabaseLocal.createPlaylist).toHaveBeenCalledWith(userEmail, '読み込んだ記事', '読み込んだ記事が自動的に追加されます');
      expect(mockedSupabaseLocal.setDefaultPlaylist).toHaveBeenCalledWith(userEmail, '2');
    });
  });

  describe('Supabase environment (SUPABASE_URL is set)', () => {
    const userEmail = 'test@example.com';
    beforeEach(() => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://test-supabase-url';
    });

    it('should return existing default playlist from Supabase', async () => {
      const existingPlaylist = {
        id: 'supabase-1',
        is_default: true,
        owner_email: userEmail,
        name: 'Default Playlist',
        description: '',
        visibility: 'private' as const,
        allow_fork: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        playlist_items: [{
          id: 'item-1',
          playlist_id: 'supabase-1',
          article_id: 'article-1',
          position: 1,
          added_at: new Date().toISOString(),
          article: {
            id: 'article-1',
            owner_email: userEmail,
            url: 'http://example.com',
            title: 'Test Article',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }
        }],
      };
      mockedSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: existingPlaylist, error: null }),
      });

      const { playlist, error } = await getOrCreateDefaultPlaylist(userEmail);

      expect(error).toBeUndefined();
      expect(playlist).toBeDefined();
      expect(playlist?.id).toBe('supabase-1');
      expect(playlist?.items).toHaveLength(1);
      expect(playlist?.item_count).toBe(1);
    });

    it('should create a new playlist if not found in Supabase', async () => {
      const newPlaylist = {
        id: 'supabase-new-1',
        owner_email: userEmail,
        name: '読み込んだ記事',
        description: '読み込んだ記事が自動的に追加されます',
        visibility: 'private' as const,
        is_default: true,
        allow_fork: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // 1. Find operation fails with PGRST116
      const findMock = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
      };

      // 2. Insert operation succeeds
      const insertMock = {
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: newPlaylist, error: null }),
      };

      mockedSupabase.from
        .mockReturnValueOnce(findMock as any) // For the find operation
        .mockReturnValueOnce(insertMock as any); // For the insert operation

      const { playlist, error } = await getOrCreateDefaultPlaylist(userEmail);

      expect(error).toBeUndefined();
      expect(playlist).toBeDefined();
      expect(playlist?.id).toBe('supabase-new-1');
      expect(playlist?.items).toEqual([]);
      expect(playlist?.item_count).toBe(0);
    });

    it('should return an error if playlist creation fails', async () => {
      const createError = { message: 'Insert failed' };

      // 1. Find operation fails with PGRST116
      const findMock = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
      };

      // 2. Insert operation fails
      const insertMock = {
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: createError }),
      };

      mockedSupabase.from
        .mockReturnValueOnce(findMock as any)      // For the find operation
        .mockReturnValueOnce(insertMock as any);   // For the insert operation

      const { playlist, error } = await getOrCreateDefaultPlaylist(userEmail);

      expect(playlist).toBeUndefined();
      expect(error).toBe('Failed to create default playlist');
    });

    it('should return an error on unexpected Supabase find error', async () => {
      const findError = { message: 'Unexpected error' };
      mockedSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: findError }),
      });

      const { playlist, error } = await getOrCreateDefaultPlaylist(userEmail);

      expect(playlist).toBeUndefined();
      expect(error).toBe('Failed to find default playlist');
    });
  });
});
