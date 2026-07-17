import { hasSupabaseRuntimeConfig, isTestAuthRuntime, shouldUseLocalSupabaseFallback } from '../auth-env';

describe('auth-env', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        jest.resetModules();
        process.env = { ...originalEnv };
    });

    afterAll(() => {
        process.env = originalEnv;
    });

    describe('isTestAuthRuntime', () => {
        it('should return true if AUTH_ENV is test', () => {
            process.env.AUTH_ENV = 'test';
            expect(isTestAuthRuntime()).toBe(true);
        });

        it('should return true if NEXT_PUBLIC_AUTH_ENV is test', () => {
            process.env.NEXT_PUBLIC_AUTH_ENV = 'test';
            expect(isTestAuthRuntime()).toBe(true);
        });

        it('should return false if neither is test', () => {
            process.env.AUTH_ENV = 'production';
            process.env.NEXT_PUBLIC_AUTH_ENV = 'production';
            expect(isTestAuthRuntime()).toBe(false);
        });
    });

    describe('hasSupabaseRuntimeConfig', () => {
        it('should return true if both NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are present', () => {
            process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321';
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'some-key';
            expect(hasSupabaseRuntimeConfig()).toBe(true);
        });

        it('should return false if NEXT_PUBLIC_SUPABASE_URL is missing', () => {
            delete process.env.NEXT_PUBLIC_SUPABASE_URL;
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'some-key';
            expect(hasSupabaseRuntimeConfig()).toBe(false);
        });

        it('should return false if NEXT_PUBLIC_SUPABASE_ANON_KEY is missing', () => {
            process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321';
            delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
            expect(hasSupabaseRuntimeConfig()).toBe(false);
        });
    });

    describe('shouldUseLocalSupabaseFallback', () => {
        it('should return true if isTestAuthRuntime is true and hasSupabaseRuntimeConfig is true', () => {
            process.env.AUTH_ENV = 'test';
            process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321';
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'some-key';
            expect(shouldUseLocalSupabaseFallback()).toBe(true);
        });

        it('should return true if isTestAuthRuntime is true and hasSupabaseRuntimeConfig is false', () => {
            process.env.AUTH_ENV = 'test';
            delete process.env.NEXT_PUBLIC_SUPABASE_URL;
            delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
            expect(shouldUseLocalSupabaseFallback()).toBe(true);
        });

        it('should return false if isTestAuthRuntime is false and hasSupabaseRuntimeConfig is true', () => {
            process.env.AUTH_ENV = 'production';
            process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321';
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'some-key';
            expect(shouldUseLocalSupabaseFallback()).toBe(false);
        });

        it('should return true if isTestAuthRuntime is false and hasSupabaseRuntimeConfig is false', () => {
            process.env.AUTH_ENV = 'production';
            delete process.env.NEXT_PUBLIC_SUPABASE_URL;
            delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
            expect(shouldUseLocalSupabaseFallback()).toBe(true);
        });
    });
});
