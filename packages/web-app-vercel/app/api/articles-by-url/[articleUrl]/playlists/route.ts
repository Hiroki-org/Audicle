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

        // プレイリストを取得（所有権フィルタリングとarticle_idによる結合フィルタリング付き）
        const { data: playlists, error: playlistsError } = await supabase
            .from('playlists')
            .select('*, playlist_items!inner(article_id)')
            .eq('owner_email', userEmail)
            .eq('playlist_items.article_id', articleId)
            .order('is_default', { ascending: false })
            .order('created_at', { ascending: false })

        if (playlistsError) {
            return NextResponse.json(
                { error: 'Failed to fetch playlists' },
                { status: 500 }
            )
        }

        // Remove the nested playlist_items array before returning
        const formattedPlaylists = playlists ? (playlists as any[]).map(p => {
            const { playlist_items, ...rest } = p;
            return rest;
        }) : []

        return NextResponse.json(formattedPlaylists as Playlist[])
    } catch (_error) {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
