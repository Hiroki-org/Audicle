import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://example.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'dummy-key'

if ((!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) && process.env.NODE_ENV === 'production' && process.env.NEXT_PHASE !== 'phase-production-build') {
    console.warn('Missing Supabase environment variables, using dummy values. This should only happen during build or test.')
}

if (process.env.NODE_ENV === 'test' && supabaseUrl.includes('example.supabase.co')) {
    console.warn('⚠️  WARNING: Using dummy Supabase URL in test environment. API calls will fail.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
