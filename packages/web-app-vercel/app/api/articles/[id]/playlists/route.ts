import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { requireAuth } from '@/lib/api-auth'
import type { Playlist } from '@/types/playlist'
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

        // article_id を持つプレイリストアイテムを取得
        const { data: playlistItems, error: playlistItemsError } = await supabase
            .from('playlist_items')
            .select('playlist_id')
            .eq('article_id', actualArticleId)

        if (playlistItemsError) {
            return NextResponse.json(
                { error: 'Failed to fetch playlists' },
                { status: 500 }
            )
        }

        if (!playlistItems || playlistItems.length === 0) {
            return NextResponse.json([])
        }

        // プレイリストIDのリストを取得
        const playlistIds = playlistItems.map(item => item.playlist_id)

        // プレイリストを取得（所有権フィルタリング付き）
        const { data: playlists, error: playlistsError } = await supabase
            .from('playlists')
            .select('*')
            .eq('owner_email', userEmail)
            .in('id', playlistIds)
            .order('is_default', { ascending: false })
            .order('created_at', { ascending: false })

        if (playlistsError) {
            return NextResponse.json(
                { error: 'Failed to fetch playlists' },
                { status: 500 }
            )
        }

        return NextResponse.json(playlists as Playlist[])
    } catch (_error) {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
