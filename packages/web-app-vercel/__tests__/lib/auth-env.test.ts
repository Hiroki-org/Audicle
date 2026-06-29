import { hasSupabaseRuntimeConfig, isTestAuthRuntime } from '../../lib/auth-env';

describe('auth-env', () => {
    const originalEnv = { ...process.env };

    const restoreEnv = () => {
        for (const key of Object.keys(process.env)) {
            if (!(key in originalEnv)) {
                delete process.env[key];
            }
        }
        Object.assign(process.env, originalEnv);
    };

    beforeEach(restoreEnv);
    afterEach(restoreEnv);

    describe('isTestAuthRuntime', () => {
        it('returns true if AUTH_ENV is "test"', () => {
            process.env.AUTH_ENV = 'test';
            delete process.env.NEXT_PUBLIC_AUTH_ENV;
            expect(isTestAuthRuntime()).toBe(true);
        });

        it('returns true if NEXT_PUBLIC_AUTH_ENV is "test"', () => {
            delete process.env.AUTH_ENV;
            process.env.NEXT_PUBLIC_AUTH_ENV = 'test';
            expect(isTestAuthRuntime()).toBe(true);
        });

        it('returns true if both are "test"', () => {
            process.env.AUTH_ENV = 'test';
            process.env.NEXT_PUBLIC_AUTH_ENV = 'test';
            expect(isTestAuthRuntime()).toBe(true);
        });

        it('returns true if only NEXT_PUBLIC_AUTH_ENV is "test" when AUTH_ENV is production', () => {
            process.env.AUTH_ENV = 'production';
            process.env.NEXT_PUBLIC_AUTH_ENV = 'test';
            expect(isTestAuthRuntime()).toBe(true);
        });

        it('returns true if only AUTH_ENV is "test" when NEXT_PUBLIC_AUTH_ENV is production', () => {
            process.env.AUTH_ENV = 'test';
            process.env.NEXT_PUBLIC_AUTH_ENV = 'production';
            expect(isTestAuthRuntime()).toBe(true);
        });

        it('returns false if neither is "test"', () => {
            process.env.AUTH_ENV = 'production';
            process.env.NEXT_PUBLIC_AUTH_ENV = 'production';
            expect(isTestAuthRuntime()).toBe(false);
        });

        it('returns false if both are missing', () => {
            delete process.env.AUTH_ENV;
            delete process.env.NEXT_PUBLIC_AUTH_ENV;
            expect(isTestAuthRuntime()).toBe(false);
        });
    });

    describe('hasSupabaseRuntimeConfig', () => {
        it('returns true if both NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are present', () => {
            process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321';
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
            expect(hasSupabaseRuntimeConfig()).toBe(true);
        });

        it('returns false if NEXT_PUBLIC_SUPABASE_URL is missing', () => {
            delete process.env.NEXT_PUBLIC_SUPABASE_URL;
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
            expect(hasSupabaseRuntimeConfig()).toBe(false);
        });

        it('returns false if NEXT_PUBLIC_SUPABASE_ANON_KEY is missing', () => {
            process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321';
            delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
            expect(hasSupabaseRuntimeConfig()).toBe(false);
        });

        it('returns false if both are missing', () => {
            delete process.env.NEXT_PUBLIC_SUPABASE_URL;
            delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
            expect(hasSupabaseRuntimeConfig()).toBe(false);
        });

        it('returns false if both are empty strings', () => {
            process.env.NEXT_PUBLIC_SUPABASE_URL = '';
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = '';
            expect(hasSupabaseRuntimeConfig()).toBe(false);
        });
    });
});
