import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { requireAuth } from '@/lib/api-auth'
import { resolveArticleId } from '@/lib/api-helpers'
import { shouldUseLocalSupabaseFallback } from '@/lib/auth-env'
import * as supabaseLocal from '@/lib/supabaseLocal'

interface BulkUpdateRequest {
    articleId: string
    addToPlaylistIds: string[]
    removeFromPlaylistIds: string[]
}

// POST: 複数プレイリストへの一括追加・削除
export async function POST(request: Request) {
    try {
        const { userEmail, response } = await requireAuth()
        if (response) return response

        const body: BulkUpdateRequest = await request.json()
        const { articleId, addToPlaylistIds, removeFromPlaylistIds } = body

        if (!articleId) {
            return NextResponse.json(
                { error: 'articleId is required' },
                { status: 400 }
            )
        }

        // addToPlaylistIds と removeFromPlaylistIds が配列であることを検証
        if (!Array.isArray(addToPlaylistIds) || !Array.isArray(removeFromPlaylistIds)) {
            return NextResponse.json(
                { error: 'addToPlaylistIds and removeFromPlaylistIds must be arrays' },
                { status: 400 }
            )
        }

        if (shouldUseLocalSupabaseFallback()) {
            let actualArticleId: string
            try {
                actualArticleId = await supabaseLocal.resolveArticleId(userEmail, articleId)
            } catch (error) {
                return NextResponse.json(
                    { error: error instanceof Error ? error.message : 'Article resolution failed' },
                    { status: 404 }
                )
            }

            const localPlaylists = await supabaseLocal.getPlaylistsForOwner(userEmail)
            const ownedPlaylistIds = new Set(localPlaylists.map((playlist) => playlist.id))
            const allPlaylistIds = [...new Set([...addToPlaylistIds, ...removeFromPlaylistIds])]

            if (allPlaylistIds.some((playlistId) => !ownedPlaylistIds.has(playlistId))) {
                return NextResponse.json(
                    { error: 'One or more playlist IDs are invalid or not owned by the user' },
                    { status: 403 }
                )
            }

            const addResults = await Promise.all(
                addToPlaylistIds.map(async (playlistId) => {
                    const playlist = await supabaseLocal.getPlaylistWithItems(userEmail, playlistId)
                    const alreadyExists = playlist?.playlist_items.some((item) => item.article_id === actualArticleId)
                    if (!alreadyExists) {
                        await supabaseLocal.addPlaylistItem(playlistId, actualArticleId)
                        return true
                    }
                    return false
                })
            )
            const addedCount = addResults.filter(Boolean).length

            const removeResults = await Promise.all(
                removeFromPlaylistIds.map(async (playlistId) => {
                    const playlist = await supabaseLocal.getPlaylistWithItems(userEmail, playlistId)
                    const item = playlist?.playlist_items.find((candidate) => candidate.article_id === actualArticleId)
                    if (item) {
                        return await supabaseLocal.removePlaylistItem(playlistId, item.id)
                    }
                    return false
                })
            )
            const removedCount = removeResults.filter(Boolean).length

            return NextResponse.json(
                {
                    message: 'Bulk update completed',
                    addedCount,
                    removedCount,
                },
                { status: 200 }
            )
        }

        // articleId が UUID か article_hash かを判定し、必要に応じて変換
        let actualArticleId: string
        try {
            actualArticleId = await resolveArticleId(articleId, userEmail)
        } catch (error) {
            return NextResponse.json(
                { error: error instanceof Error ? error.message : 'Article resolution failed' },
                { status: 404 }
            )
        }

        // プレイリストIDの所有者確認
        const allPlaylistIds = [...new Set([...addToPlaylistIds, ...removeFromPlaylistIds])];

        if (allPlaylistIds.length > 0) {
            const { count, error: playlistError } = await supabase
                .from('playlists')
                .select('id', { count: 'exact' })
                .in('id', allPlaylistIds)
                .eq('owner_email', userEmail);

            if (playlistError) {
                return NextResponse.json(
                    { error: 'Failed to verify playlists' },
                    { status: 500 }
                );
            }

            if (count !== allPlaylistIds.length) {
                return NextResponse.json(
                    { error: 'One or more playlist IDs are invalid or not owned by the user' },
                    { status: 403 } // Forbidden
                );
            }
        }

        // バルク更新処理（RPC関数を使用）
        const { data: result, error: rpcError } = await supabase.rpc('bulk_update_playlist_items', {
            article_id_param: actualArticleId,
            add_playlist_ids: addToPlaylistIds,
            remove_playlist_ids: removeFromPlaylistIds,
        });

        if (rpcError) {
            return NextResponse.json(
                { error: 'Bulk update failed' },
                { status: 500 }
            );
        }

        const { added_count, removed_count } = (result && result[0]) || { added_count: 0, removed_count: 0 };

        return NextResponse.json(
            {
                message: 'Bulk update completed',
                addedCount: added_count,
                removedCount: removed_count,
            },
            { status: 200 }
        )
    } catch (_error) {
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}
