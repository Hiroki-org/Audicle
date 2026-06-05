const createClientMock = jest.fn(() => ({ from: jest.fn() }));

jest.mock('@supabase/supabase-js', () => ({
  createClient: (...args: unknown[]) => createClientMock(...args),
}));

const ORIGINAL_ENV = { ...process.env };

function restoreEnv() {
  for (const key of Object.keys(process.env)) {
    delete process.env[key];
  }
  Object.assign(process.env, ORIGINAL_ENV);
}

describe('supabase client environment guard', () => {
  beforeEach(() => {
    jest.resetModules();
    createClientMock.mockClear();
    restoreEnv();
    delete process.env.NEXT_PHASE;
    delete process.env.AUTH_ENV;
    delete process.env.NEXT_PUBLIC_AUTH_ENV;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  });

  afterAll(() => {
    restoreEnv();
  });

  it('requires Supabase configuration in normal production runtime', () => {
    process.env.NODE_ENV = 'production';

    expect(() => jest.isolateModules(() => require('../supabase'))).toThrow(
      'Missing required Supabase environment variables in production',
    );
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it('allows production runtime without Supabase config when auth test mode is active', () => {
    process.env.NODE_ENV = 'production';
    process.env.AUTH_ENV = 'test';

    jest.isolateModules(() => require('../supabase'));

    expect(createClientMock).toHaveBeenCalledWith(
      'https://example.supabase.co',
      'build-time-placeholder-anon-key',
    );
  });

  it('allows production runtime without Supabase config when public auth test mode is active', () => {
    process.env.NODE_ENV = 'production';
    process.env.NEXT_PUBLIC_AUTH_ENV = 'test';

    jest.isolateModules(() => require('../supabase'));

    expect(createClientMock).toHaveBeenCalledWith(
      'https://example.supabase.co',
      'build-time-placeholder-anon-key',
    );
  });

  it('uses configured Supabase credentials in production runtime', () => {
    process.env.NODE_ENV = 'production';
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example-project.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';

    jest.isolateModules(() => require('../supabase'));

    expect(createClientMock).toHaveBeenCalledWith(
      'https://example-project.supabase.co',
      'anon-key',
    );
  });
});
