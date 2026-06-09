import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import * as supabaseLocal from '@/lib/supabaseLocal'
import { requireAuth } from '@/lib/api-auth'
import { Article, PlaylistItem } from '@/types/playlist'

type LocalPlaylist = Awaited<ReturnType<typeof supabaseLocal.getPlaylistsForOwner>>[number]

async function findOwnedLocalPlaylist(id: string, userEmail: string): Promise<LocalPlaylist | null> {
    const playlists = await supabaseLocal.getPlaylistsForOwner(userEmail)
    return playlists.find((candidate) => candidate.id === id) ?? null
}

export async function POST(
    request: Request,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await context.params
        const { userEmail, response } = await requireAuth()
        if (response) return response

        // プレイリストの所有権を確認
        let playlist: { owner_email: string } | null = null
        let playlistError: { message?: string } | null = null

        if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
            const found = await findOwnedLocalPlaylist(id, userEmail)
            if (found) {
                playlist = { owner_email: found.owner_email }
            } else {
                playlistError = { message: 'Playlist not found' }
            }
        } else {
            const resp = await supabase
                .from('playlists')
                .select('owner_email')
                .eq('id', id)
                .single()
            playlist = resp.data
            playlistError = resp.error
        }

        if (playlistError || !playlist) {
            return NextResponse.json({ error: 'Playlist not found' }, { status: 404 })
        }

        if (playlist.owner_email !== userEmail) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        // リクエストボディを取得
        const body = await request.json()
        const { article_url, article_title, thumbnail_url, last_read_position } = body

        if (!article_url || !article_title) {
            return NextResponse.json(
                { error: 'article_url and article_title are required' },
                { status: 400 }
            )
        }

        // 記事を作成または既存のものを取得
        let article: Article | null = null
        let articleError: Error | null = null

        if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
            try {
                article = await supabaseLocal.upsertArticle(userEmail, article_url, article_title, thumbnail_url, last_read_position)
            } catch (e) {
                articleError = e as Error
            }
        } else {
            // upsertを使って1回のクエリで更新・作成を行う
            const { data: upserted, error: upsertError } = await supabase
                .from('articles')
                .upsert({
                    owner_email: userEmail,
                    url: article_url,
                    title: article_title,
                    thumbnail_url: thumbnail_url || null,
                    last_read_position: last_read_position || 0,
                }, {
                    onConflict: 'owner_email,url',
                    ignoreDuplicates: false
                })
                .select()
                .single()
            article = upserted
            articleError = upsertError
        }

        if (articleError) {
            return NextResponse.json(
                { error: articleError.message || 'Failed to create article' },
                { status: 500 }
            )
        }

        // playlist_itemsに追加（既に存在する場合は既存のものを返す）
        let playlistItem: PlaylistItem | null = null
        let itemError: Error | null = null

        if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
            try {
                playlistItem = await supabaseLocal.addPlaylistItem(id, article!.id)
            } catch (e) {
                itemError = e as Error
            }
        } else {
            // upsertで1回のクエリにまとめる（positionはDBトリガーで自動設定されるが、
            // Supabase APIからのインサート用にダミー値を設定してもトリガーが上書きする）
            // 制約playlist_items_playlist_id_article_id_keyに依存
            const { data: upsertedItem, error: upsertItemError } = await supabase
                .from('playlist_items')
                .upsert({
                    playlist_id: id,
                    article_id: article!.id,
                    position: 0, // トリガーが上書きするため、この値は実際には無視されます
                }, {
                    onConflict: 'playlist_id,article_id',
                    ignoreDuplicates: true // 既存の場合は何もしない
                })
                .select()
                .single()

            // ignoreDuplicates: true で既存データがある場合、戻り値が空になる可能性があるため
            if (upsertItemError && upsertItemError.code === 'PGRST116') {
                // PGRST116は結果が1行でない（0行）場合のエラー。すでに存在していて無視された場合に発生
                const { data: existingItem, error: fetchError } = await supabase
                    .from('playlist_items')
                    .select()
                    .eq('playlist_id', id)
                    .eq('article_id', article!.id)
                    .single()
                playlistItem = existingItem
                itemError = fetchError
            } else {
                playlistItem = upsertedItem
                itemError = upsertItemError
            }
        }

        if (itemError) {
            console.error('Supabase error:', itemError)
            return NextResponse.json(
                { error: itemError.message || 'Failed to add item to playlist' },
                { status: 500 }
            )
        }

        return NextResponse.json({
            item: playlistItem,
            article: article,
        })
    } catch (error) {
        console.error('Error in POST /api/playlists/[id]/items:', error)
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Internal server error' },
            { status: 500 }
        )
    }
}

// GET: プレイリストアイテムの一覧取得（読み取り用）
export async function GET(
    request: Request,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await context.params
        const { userEmail, response } = await requireAuth()
        if (response) return response

        // プレイリストの所有権を確認
        let playlist: { owner_email: string } | null = null
        let playlistError: { message?: string } | null = null
        let localPlaylist: LocalPlaylist | null = null

        if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
            localPlaylist = await findOwnedLocalPlaylist(id, userEmail)
            if (localPlaylist) {
                playlist = { owner_email: localPlaylist.owner_email }
            } else {
                playlistError = { message: 'Playlist not found' }
            }
        } else {
            const resp = await supabase
                .from('playlists')
                .select('owner_email')
                .eq('id', id)
                .single()
            playlist = resp.data
            playlistError = resp.error
        }

        if (playlistError || !playlist) {
            return NextResponse.json({ error: 'Playlist not found' }, { status: 404 })
        }

        if (playlist.owner_email !== userEmail) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
            const items = [...(localPlaylist?.items ?? [])].sort(
                (a, b) => (a.position ?? 0) - (b.position ?? 0),
            )
            return NextResponse.json(items)
        }

        // プレイリストアイテム（関連する記事情報付き）を取得
        const { data: items, error } = await supabase
            .from('playlist_items')
            .select('id, playlist_id, article_id, position, added_at, article:articles(*)')
            .eq('playlist_id', id)
            .order('position', { ascending: true })

        if (error) {
            console.error('Supabase error:', error)
            return NextResponse.json({ error: 'Failed to fetch playlist items' }, { status: 500 })
        }

        return NextResponse.json(items || [])
    } catch (error) {
        console.error('Error in GET /api/playlists/[id]/items:', error)
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Internal server error' },
            { status: 500 }
        )
    }
}
