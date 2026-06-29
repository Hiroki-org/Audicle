export function isTestAuthRuntime(): boolean {
    return process.env.AUTH_ENV === 'test' || process.env.NEXT_PUBLIC_AUTH_ENV === 'test'
}

export function hasSupabaseRuntimeConfig(): boolean {
    return Boolean(
        process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    )
}
