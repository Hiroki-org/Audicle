import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { requireAuth } from '@/lib/api-auth'
import type { Playlist } from '@/types/playlist'

/**
 * GET /api/articles-by-url/[articleUrl]/playlists
 * 記事URLから、その記事が属しているプレイリスト一覧を取得
 */
export async function GET(
    request: Request,
    context: { params: Promise<{ articleUrl: string }> }
) {
    try {
        const { articleUrl } = await context.params
        const decodedArticleUrl = decodeURIComponent(articleUrl)
        const { userEmail, response } = await requireAuth()
        if (response) return response

        // Optimization: Use a single JOIN query instead of multiple sequential queries
        // This eliminates 2 network round-trips
        const { data: playlists, error: playlistsError } = await supabase
            .from('playlists')
            .select(`
                *,
                playlist_items!inner(
                    articles!inner(
                        url,
                        owner_email
                    )
                )
            `)
            .eq('owner_email', userEmail)
            .eq('playlist_items.articles.url', decodedArticleUrl)
            .eq('playlist_items.articles.owner_email', userEmail)
            .order('is_default', { ascending: false })
            .order('created_at', { ascending: false })

        if (playlistsError) {
            return NextResponse.json(
                { error: 'Failed to fetch playlists' },
                { status: 500 }
            )
        }

        // Clean up the joined data to match the expected Playlist type
        const formattedPlaylists = playlists?.map(playlist => {
            const { playlist_items, ...rest } = playlist;
            return rest;
        }) || [];

        return NextResponse.json(formattedPlaylists as Playlist[])
    } catch (_error) {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
