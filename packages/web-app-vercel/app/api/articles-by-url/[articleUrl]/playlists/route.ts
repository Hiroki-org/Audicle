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

        // プレイリストを取得（所有権フィルタリングとarticleのURLによる結合フィルタリング付き）
        // 記事の存在確認、プレイリストアイテムの取得、プレイリストの取得を1回のクエリで実行
        const { data: playlists, error: playlistsError } = await supabase
            .from('playlists')
            .select('*, playlist_items!inner(article_id, articles!inner(url, owner_email))')
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
