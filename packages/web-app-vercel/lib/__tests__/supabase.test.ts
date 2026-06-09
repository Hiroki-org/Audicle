describe('supabase client configuration', () => {
    const originalEnv = process.env;
    const supabaseEnvKeys = [
        'NEXT_PUBLIC_SUPABASE_URL',
        'NEXT_PUBLIC_SUPABASE_ANON_KEY',
        'AUTH_ENV',
        'NEXT_PUBLIC_AUTH_ENV',
        'NEXT_PHASE',
    ];

    beforeEach(() => {
        jest.resetModules();
        process.env = { ...originalEnv };
        for (const key of supabaseEnvKeys) {
            delete process.env[key];
        }
        jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    });

    afterEach(() => {
        process.env = originalEnv;
        jest.restoreAllMocks();
    });

    it('throws in production runtime when Supabase env vars are missing', () => {
        process.env.NODE_ENV = 'production';

        expect(() => require('../supabase')).toThrow(
            'Missing required Supabase environment variables in production',
        );
    });

    it('allows test auth runtime to use build-time placeholders', () => {
        process.env.NODE_ENV = 'production';
        process.env.AUTH_ENV = 'test';

        expect(() => require('../supabase')).not.toThrow();
    });

    it('allows public test auth runtime to use build-time placeholders', () => {
        process.env.NODE_ENV = 'production';
        process.env.NEXT_PUBLIC_AUTH_ENV = 'test';

        expect(() => require('../supabase')).not.toThrow();
    });

    it('allows production build phase to use build-time placeholders', () => {
        process.env.NODE_ENV = 'production';
        process.env.NEXT_PHASE = 'phase-production-build';

        expect(() => require('../supabase')).not.toThrow();
    });

    it('allows production runtime when Supabase env vars are configured', () => {
        process.env.NODE_ENV = 'production';
        process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';

        expect(() => require('../supabase')).not.toThrow();
    });
});
