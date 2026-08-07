import { isTestAuthRuntime, hasSupabaseRuntimeConfig, shouldUseLocalSupabaseFallback } from '../auth-env'

describe('auth-env', () => {
  const originalEnv = process.env

  beforeEach(() => {
    jest.resetModules()
    process.env = { ...originalEnv }
  })

  afterAll(() => {
    process.env = originalEnv
  })

  describe('isTestAuthRuntime', () => {
    it('returns true if AUTH_ENV is test', () => {
      process.env.AUTH_ENV = 'test'
      expect(isTestAuthRuntime()).toBe(true)
    })

    it('returns true if NEXT_PUBLIC_AUTH_ENV is test', () => {
      process.env.NEXT_PUBLIC_AUTH_ENV = 'test'
      expect(isTestAuthRuntime()).toBe(true)
    })

    it('returns false if neither is test', () => {
      process.env.AUTH_ENV = 'production'
      process.env.NEXT_PUBLIC_AUTH_ENV = 'production'
      expect(isTestAuthRuntime()).toBe(false)
    })
  })

  describe('hasSupabaseRuntimeConfig', () => {
    it('returns true if both URL and ANON_KEY are present', () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321'
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'some-anon-key'
      expect(hasSupabaseRuntimeConfig()).toBe(true)
    })

    it('returns false if URL is missing', () => {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'some-anon-key'
      expect(hasSupabaseRuntimeConfig()).toBe(false)
    })

    it('returns false if ANON_KEY is missing', () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321'
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      expect(hasSupabaseRuntimeConfig()).toBe(false)
    })
  })

  describe('shouldUseLocalSupabaseFallback', () => {
    it('returns true if isTestAuthRuntime is true', () => {
      process.env.AUTH_ENV = 'test'
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321'
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'some-anon-key'
      expect(shouldUseLocalSupabaseFallback()).toBe(true)
    })

    it('returns true if hasSupabaseRuntimeConfig is false', () => {
      process.env.AUTH_ENV = 'production'
      delete process.env.NEXT_PUBLIC_SUPABASE_URL
      expect(shouldUseLocalSupabaseFallback()).toBe(true)
    })

    it('returns false if not test auth and has supabase config', () => {
      process.env.AUTH_ENV = 'production'
      process.env.NEXT_PUBLIC_AUTH_ENV = 'production'
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321'
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'some-anon-key'
      expect(shouldUseLocalSupabaseFallback()).toBe(false)
    })
  })
})
