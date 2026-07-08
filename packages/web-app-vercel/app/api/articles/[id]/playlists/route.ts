import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { requireAuth } from '@/lib/api-auth'
import type { Playlist } from '@/types/playlist'
import { resolveArticleId } from '@/lib/api-helpers'
import { shouldUseLocalSupabaseFallback } from '@/lib/auth-env'
import * as supabaseLocal from '@/lib/supabaseLocal'

export async function GET(
    request: Request,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { id: articleId } = await context.params
        const { userEmail, response } = await requireAuth()
        if (response) return response

        if (shouldUseLocalSupabaseFallback()) {
            let actualArticleId: string
            try {
                actualArticleId = await supabaseLocal.resolveArticleId(userEmail, articleId)
            } catch (error) {
                return NextResponse.json(
                    { error: error instanceof Error ? error.message : 'Article not found' },
                    { status: 404 }
                )
            }

            const playlists = await supabaseLocal.getPlaylistsForOwner(userEmail)
            const containingPlaylists = playlists
                .filter((playlist) =>
                    (playlist.playlist_items || []).some((item) => item.article_id === actualArticleId),
                )
                .map(({ playlist_items: _playlistItems, items: _items, ...playlist }) => playlist)

            return NextResponse.json(containingPlaylists as Playlist[])
        }

        // まずarticle_hashからarticleのURLを取得（article_statsテーブルから）
        let actualArticleId: string
        try {
            actualArticleId = await resolveArticleId(articleId, userEmail)
        } catch (error) {
            return NextResponse.json(
                { error: error instanceof Error ? error.message : 'Article not found' },
                { status: 404 }
            )
        }

        // プレイリストを取得（所有権フィルタリングとarticle_idによる結合フィルタリング付き）
        type PlaylistWithItems = Playlist & { playlist_items: { article_id: string }[] };
        const { data: playlists, error: playlistsError } = await supabase
            .from('playlists')
            .select('*, playlist_items!inner(article_id)')
            .eq('owner_email', userEmail)
            .eq('playlist_items.article_id', actualArticleId)
            .order('is_default', { ascending: false })
            .order('created_at', { ascending: false })
            .returns<PlaylistWithItems[]>()

        if (playlistsError) {
            return NextResponse.json(
                { error: 'Failed to fetch playlists' },
                { status: 500 }
            )
        }

        // Remove the nested playlist_items array before returning
        const formattedPlaylists = playlists ? playlists.map(p => {
            const { playlist_items: _playlistItems, ...rest } = p;
            return rest;
        }) : []

        return NextResponse.json(formattedPlaylists as Playlist[])
    } catch (_error) {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
