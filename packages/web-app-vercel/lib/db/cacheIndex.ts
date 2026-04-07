import { createClient } from '@supabase/supabase-js';

export type CacheIndex = {
    article_url: string;
    voice: string;
    cached_chunks: string[];
    completed_playback: boolean;
    read_count: number;
    last_accessed: string;
};

// サーバーサイド用のSupabaseクライアントを作成
function getSupabaseClient() {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error('Missing Supabase environment variables');
    }

    return createClient(supabaseUrl, supabaseAnonKey);
}

export async function getCacheIndex(
    articleUrl: string,
    voice: string
): Promise<CacheIndex | null> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
        .from('audio_cache_index')
        .select('*')
        .eq('article_url', articleUrl)
        .eq('voice', voice)
        .single();

    if (error) {
        console.error('[Cache Index] Error fetching:', error);
        return null;
    }

    return data;
}

export async function addCachedChunk(
    articleUrl: string,
    voice: string,
    textHash: string
): Promise<void> {
    const supabase = getSupabaseClient();

    const { error } = await supabase.rpc('add_cached_chunk', {
        p_article_url: articleUrl,
        p_voice: voice,
        p_text_hash: textHash
    });

    if (error) {
        console.error('[Cache Index] Error adding chunk:', error);
        throw error;
    }
}

export async function removeCachedChunk(
    articleUrl: string,
    voice: string,
    textHash: string
): Promise<void> {
    const supabase = getSupabaseClient();

    const { error } = await supabase.rpc('remove_cached_chunk', {
        p_article_url: articleUrl,
        p_voice: voice,
        p_text_hash: textHash
    });

    if (error) {
        console.error('[Cache Index] Error removing chunk:', error);
        throw error;
    }
}

export async function updateCompletedPlayback(
    articleUrl: string,
    voice: string,
    completed: boolean
): Promise<void> {
    const supabase = getSupabaseClient();

    const { error } = await supabase.rpc('update_completed_playback', {
        p_article_url: articleUrl,
        p_voice: voice,
        p_completed: completed
    });

    if (error) {
        console.error('[Cache Index] Error updating completed:', error);
        throw error;
    }
}

export function isCachedInIndex(
    index: CacheIndex | null,
    textHash: string
): boolean {
    return index?.cached_chunks.includes(textHash) ?? false;
}
