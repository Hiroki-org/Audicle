// packages/web-app-vercel/lib/__tests__/playlist-utils.test.ts
import { getOrCreateDefaultPlaylist, getPlaylistSortKey, setPlaylistSortKey } from '../playlist-utils';
import * as supabaseLocal from '../supabaseLocal';
import { supabase } from '../supabase';

const ORIGINAL_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ORIGINAL_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const ORIGINAL_AUTH_ENV = process.env.AUTH_ENV;
const ORIGINAL_NEXT_PUBLIC_AUTH_ENV = process.env.NEXT_PUBLIC_AUTH_ENV;

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
    if (typeof ORIGINAL_SUPABASE_ANON_KEY === "string") {
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = ORIGINAL_SUPABASE_ANON_KEY;
    } else {
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    }
    if (typeof ORIGINAL_AUTH_ENV === "string") {
      process.env.AUTH_ENV = ORIGINAL_AUTH_ENV;
    } else {
      delete process.env.AUTH_ENV;
    }
    if (typeof ORIGINAL_NEXT_PUBLIC_AUTH_ENV === "string") {
      process.env.NEXT_PUBLIC_AUTH_ENV = ORIGINAL_NEXT_PUBLIC_AUTH_ENV;
    } else {
      delete process.env.NEXT_PUBLIC_AUTH_ENV;
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
        playlist_items: [{
          id: 'raw-item-1',
          playlist_id: '1',
          article_id: 'article-1',
          position: 1,
          added_at: new Date().toISOString(),
        }],
        items: [{
          id: 'item-1',
          playlist_id: '1',
          article_id: 'article-1',
          position: 1,
          added_at: new Date().toISOString(),
          article: {
            id: 'article-1',
            owner_email: userEmail,
            url: 'https://example.com/?id=apple',
            title: 'Apple',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        }],
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
      expect(playlist?.items).toHaveLength(1);
      expect(playlist?.items[0].article?.title).toBe('Apple');
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
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
      delete process.env.AUTH_ENV;
      delete process.env.NEXT_PUBLIC_AUTH_ENV;
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

  describe('test auth runtime with Supabase config', () => {
    const userEmail = 'test@example.com';

    beforeEach(() => {
      process.env.AUTH_ENV = 'test';
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://test-supabase-url';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
    });

    it('uses the local fallback instead of contacting Supabase', async () => {
      const existingPlaylist = {
        id: 'local-test-playlist',
        is_default: true,
        playlist_items: [],
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
      expect(playlist?.id).toBe('local-test-playlist');
      expect(mockedSupabaseLocal.getPlaylistsForOwner).toHaveBeenCalledWith(userEmail);
      expect(mockedSupabase.from).not.toHaveBeenCalled();
    });
  });
});

describe('getPlaylistSortKey / setPlaylistSortKey', () => {
  const originalWindow = global.window;

  beforeEach(() => {
    // Mock localStorage
    const localStorageMock = (() => {
      let store: Record<string, string> = {};
      return {
        getItem: jest.fn((key: string) => store[key] || null),
        setItem: jest.fn((key: string, value: string) => {
          if (key === 'audicle-playlist-sort-error-id') {
             throw new Error('Storage error');
          }
          store[key] = value?.toString() ?? '';
        }),
        clear: jest.fn(() => {
          store = {};
        }),
      };
    })();
    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
    });
    window.localStorage.clear();
  });

  afterEach(() => {
    // Restore original window
    global.window = originalWindow;
  });

  describe('getPlaylistSortKey', () => {
    it('should return default sort key when localStorage is empty', () => {
      expect(getPlaylistSortKey('test-id')).toBe('position');
    });

    it('should return stored sort key from localStorage', () => {
      window.localStorage.setItem('audicle-playlist-sort-test-id', 'title');
      expect(getPlaylistSortKey('test-id')).toBe('title');
    });

    it('should handle undefined window', () => {
      // @ts-ignore - simulating server side
      delete global.window;
      expect(getPlaylistSortKey('test-id')).toBe('position');
    });

    it('should return default if playlistId is invalid', () => {
        expect(getPlaylistSortKey('')).toBe('position');
    });
  });

  describe('setPlaylistSortKey', () => {
    it('should store sort key in localStorage', () => {
      setPlaylistSortKey('test-id', 'title-desc');
      expect(window.localStorage.getItem('audicle-playlist-sort-test-id')).toBe('title-desc');
    });

    it('should handle undefined window', () => {
      // @ts-ignore - simulating server side
      delete global.window;
      expect(() => setPlaylistSortKey('test-id', 'title-desc')).not.toThrow();
    });

    it('should catch error on localStorage.setItem', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      expect(() => setPlaylistSortKey('error-id', 'title')).not.toThrow();
      consoleSpy.mockRestore();
    });
  });
});
