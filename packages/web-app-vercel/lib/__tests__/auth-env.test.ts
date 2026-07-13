import { isTestAuthRuntime, hasSupabaseRuntimeConfig } from '../auth-env';

describe('auth-env', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    // Clear all relevant env vars by default for a clean slate
    delete process.env.AUTH_ENV;
    delete process.env.NEXT_PUBLIC_AUTH_ENV;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('isTestAuthRuntime', () => {
    it('should return true when AUTH_ENV is test', () => {
      process.env.AUTH_ENV = 'test';
      expect(isTestAuthRuntime()).toBe(true);
    });

    it('should return true when NEXT_PUBLIC_AUTH_ENV is test', () => {
      process.env.NEXT_PUBLIC_AUTH_ENV = 'test';
      expect(isTestAuthRuntime()).toBe(true);
    });

    it('should return true when both are test', () => {
      process.env.AUTH_ENV = 'test';
      process.env.NEXT_PUBLIC_AUTH_ENV = 'test';
      expect(isTestAuthRuntime()).toBe(true);
    });

    it('should return false when AUTH_ENV is anything else', () => {
      process.env.AUTH_ENV = 'production';
      expect(isTestAuthRuntime()).toBe(false);
    });

    it('should return false when env vars are not set', () => {
      expect(isTestAuthRuntime()).toBe(false);
    });
  });

  describe('hasSupabaseRuntimeConfig', () => {
    it('should return true when both URL and ANON_KEY are set', () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'some-anon-key';
      expect(hasSupabaseRuntimeConfig()).toBe(true);
    });

    it('should return false when only URL is set', () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
      expect(hasSupabaseRuntimeConfig()).toBe(false);
    });

    it('should return false when only ANON_KEY is set', () => {
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'some-anon-key';
      expect(hasSupabaseRuntimeConfig()).toBe(false);
    });

    it('should return false when neither is set', () => {
      expect(hasSupabaseRuntimeConfig()).toBe(false);
    });
  });
});
