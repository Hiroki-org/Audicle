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

        // article_urlでarticlesテーブルから記事IDを取得
        const { data: article, error: articleError } = await supabase
            .from('articles')
            .select('id')
            .eq('url', decodedArticleUrl)
            .eq('owner_email', userEmail)
            .single()
        // PostgREST returns an error when .single() finds 0 rows. Handle that case
        // explicitly: return empty list if not found, otherwise 500 for other errors.
        if (articleError) {
            // When there are no rows, supabase/postgrest uses PGRST116
            if (articleError.code === 'PGRST116') {
                return NextResponse.json([])
            }
            return NextResponse.json(
                { error: 'Failed to fetch article' },
                { status: 500 }
            )
        }
        if (!article) {
            return NextResponse.json([])
        }

        const articleId = article.id

        // article_id を持つプレイリストアイテムを取得
        const { data: playlistItems, error: playlistItemsError } = await supabase
            .from('playlist_items')
            .select('playlist_id')
            .eq('article_id', articleId)

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

        // プレイリストを取得（所有権フィルタリング付き、デフォルトプレイリスト優先）
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
    } catch {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
