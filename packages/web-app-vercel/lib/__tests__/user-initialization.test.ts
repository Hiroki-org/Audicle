import { initializeNewUser } from '../user-initialization';
import { supabase } from '../supabase';
import { getOrCreateDefaultPlaylist } from '../playlist-utils';

jest.mock('../supabase', () => ({
  supabase: {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn(),
    insert: jest.fn().mockReturnThis(),
  },
}));

jest.mock('../playlist-utils', () => ({
  getOrCreateDefaultPlaylist: jest.fn(),
}));

const mockedSupabase = supabase as jest.Mocked<typeof supabase>;
const mockedGetOrCreateDefaultPlaylist = getOrCreateDefaultPlaylist as jest.MockedFunction<typeof getOrCreateDefaultPlaylist>;

describe('initializeNewUser', () => {
  const userId = 'user-123';
  const userEmail = 'test@example.com';

  beforeEach(() => {
    jest.resetAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should return success if user settings already exist', async () => {
    mockedSupabase.from.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: { user_id: userId }, error: null }),
    } as any);

    const result = await initializeNewUser(userId, userEmail);

    expect(result).toEqual({ success: true });
    expect(mockedSupabase.from).toHaveBeenCalledWith('user_settings');
    expect(mockedGetOrCreateDefaultPlaylist).not.toHaveBeenCalled();
  });

  it('should create user settings and playlist if settings do not exist (PGRST116)', async () => {
    const mockFindResponse = { data: null, error: { code: 'PGRST116' } };
    const mockInsertResponse = { data: { user_id: userId, language: 'ja-JP' }, error: null };

    const insertMockFn = jest.fn().mockReturnThis();

    const findMock = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue(mockFindResponse),
    };

    const insertMock = {
      insert: insertMockFn,
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue(mockInsertResponse),
    };

    mockedSupabase.from
      .mockReturnValueOnce(findMock as any)
      .mockReturnValueOnce(insertMock as any);

    mockedGetOrCreateDefaultPlaylist.mockResolvedValue({ playlist: undefined });

    const result = await initializeNewUser(userId, userEmail);

    expect(result).toEqual({ success: true });
    expect(mockedSupabase.from).toHaveBeenCalledWith('user_settings');
    expect(insertMockFn).toHaveBeenCalledWith({
      user_id: userId,
      playback_speed: 1.0,
      voice_model: 'ja-JP-Standard-B',
      language: 'ja-JP',
    });
    expect(mockedGetOrCreateDefaultPlaylist).toHaveBeenCalledWith(userEmail);
  });

  it('should skip playlist creation if userEmail is empty', async () => {
    const mockFindResponse = { data: null, error: { code: 'PGRST116' } };
    const mockInsertResponse = { data: { user_id: userId }, error: null };

    mockedSupabase.from
      .mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue(mockFindResponse),
      } as any)
      .mockReturnValueOnce({
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue(mockInsertResponse),
      } as any);

    const result = await initializeNewUser(userId, '');

    expect(result).toEqual({ success: true });
    expect(mockedGetOrCreateDefaultPlaylist).not.toHaveBeenCalled();
  });

  it('should return failure if checking settings fails with non-PGRST116 error', async () => {
    const mockError = { code: 'SOME_ERROR', message: 'DB Error' };
    mockedSupabase.from.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: mockError }),
    } as any);

    const result = await initializeNewUser(userId, userEmail);

    expect(result).toEqual({ success: false, error: 'Failed to check user settings' });
    expect(console.error).toHaveBeenCalledWith('Error checking user settings:', mockError);
  });

  it('should return failure if creating settings fails', async () => {
    const mockFindResponse = { data: null, error: { code: 'PGRST116' } };
    const mockCreateError = { message: 'Insert Error' };

    mockedSupabase.from
      .mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue(mockFindResponse),
      } as any)
      .mockReturnValueOnce({
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: mockCreateError }),
      } as any);

    const result = await initializeNewUser(userId, userEmail);

    expect(result).toEqual({ success: false, error: 'Failed to create user settings' });
    expect(console.error).toHaveBeenCalledWith('Error creating user settings:', mockCreateError);
  });

  it('should return success even if creating default playlist fails', async () => {
    const mockFindResponse = { data: null, error: { code: 'PGRST116' } };
    const mockInsertResponse = { data: { user_id: userId }, error: null };

    mockedSupabase.from
      .mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue(mockFindResponse),
      } as any)
      .mockReturnValueOnce({
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue(mockInsertResponse),
      } as any);

    const playlistError = 'Playlist Error';
    mockedGetOrCreateDefaultPlaylist.mockResolvedValue({ error: playlistError });

    const result = await initializeNewUser(userId, userEmail);

    expect(result).toEqual({ success: true });
    expect(console.error).toHaveBeenCalledWith('Failed to create default playlist:', playlistError);
  });

  it('should catch unexpected runtime errors and return failure', async () => {
    const runtimeError = new Error('Runtime crash');
    mockedSupabase.from.mockImplementation(() => {
      throw runtimeError;
    });

    const result = await initializeNewUser(userId, userEmail);

    expect(result).toEqual({ success: false, error: runtimeError.message });
    expect(console.error).toHaveBeenCalledWith('Unexpected error in initializeNewUser:', runtimeError);
  });

  it('should handle non-Error thrown objects in catch block', async () => {
    const nonErrorObject = 'Just a string error';
    mockedSupabase.from.mockImplementation(() => {
      throw nonErrorObject;
    });

    const result = await initializeNewUser(userId, userEmail);

    expect(result).toEqual({ success: false, error: 'Unknown error' });
    expect(console.error).toHaveBeenCalledWith('Unexpected error in initializeNewUser:', nonErrorObject);
  });
});
