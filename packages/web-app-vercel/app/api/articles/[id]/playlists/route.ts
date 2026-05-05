import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { requireAuth } from '@/lib/api-auth'
import type { Playlist, PlaylistWithItems } from '@/types/playlist'
import { resolveArticleId } from '@/lib/api-helpers'

export async function GET(
    request: Request,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { id: articleId } = await context.params
        const { userEmail, response } = await requireAuth()
        if (response) return response

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
        const { data: playlists, error: playlistsError } = await supabase
            .from('playlists')
            .select('*, playlist_items!inner(article_id)')
            .eq('owner_email', userEmail)
            .eq('playlist_items.article_id', actualArticleId)
            .order('is_default', { ascending: false })
            .order('created_at', { ascending: false })

        if (playlistsError) {
            return NextResponse.json(
                { error: 'Failed to fetch playlists' },
                { status: 500 }
            )
        }

        // レスポンスからネストされた playlist_items を除去して返却
        const formattedPlaylists = playlists ? (playlists as PlaylistWithItems[]).map(playlist => {
            const { playlist_items: _playlistItems, ...rest } = playlist
            return rest
        }) : []

        return NextResponse.json(formattedPlaylists as Playlist[])
    } catch (_error) {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
