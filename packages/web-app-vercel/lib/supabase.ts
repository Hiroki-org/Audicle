import { createClient } from '@supabase/supabase-js'

const isProductionBuildPhase = process.env.NEXT_PHASE === 'phase-production-build'
const isProductionRuntime = process.env.NODE_ENV === 'production' && !isProductionBuildPhase

export function isSupabaseConfigured(): boolean {
    return Boolean(
        process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    )
}

const hasSupabaseConfig = isSupabaseConfigured()

if (isProductionRuntime && !hasSupabaseConfig) {
    throw new Error('Missing required Supabase environment variables in production')
}

// These placeholders are only reachable during build/test/local development paths.
const buildTimeSupabaseUrl = 'https://example.supabase.co'
const buildTimeSupabaseAnonKey = 'build-time-placeholder-anon-key'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || buildTimeSupabaseUrl
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || buildTimeSupabaseAnonKey

if (!hasSupabaseConfig) {
    console.warn('Missing Supabase environment variables, using build/test/local development placeholder values.')
}

if (process.env.NODE_ENV === 'test' && supabaseUrl === buildTimeSupabaseUrl) {
    console.warn('WARNING: Using placeholder Supabase URL in test environment. API calls will fail.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
