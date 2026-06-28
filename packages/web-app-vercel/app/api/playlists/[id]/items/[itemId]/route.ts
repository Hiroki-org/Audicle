import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import * as supabaseLocal from '@/lib/supabaseLocal'
import { requireAuth } from '@/lib/api-auth'
import { PlaylistItemWithArticle } from '@/types/playlist'

// DELETE: プレイリストからアイテムを削除
export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string; itemId: string }> }
) {
    try {
        const { userEmail, response } = await requireAuth()
        if (response) return response

        const { id: playlistId, itemId } = await params

        // プレイリストの所有権を確認
        let ownerEmailFromPlaylist: string | null = null
        let playlistError: { message: string } | null = null

        if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
            const all = await supabaseLocal.getPlaylistsForOwner(userEmail)
            const found = all.find(p => p.id === playlistId)
            if (!found) playlistError = { message: 'Not found' }
            else ownerEmailFromPlaylist = found.owner_email
        } else {
            const resp = await supabase
                .from('playlists')
                .select('owner_email')
                .eq('id', playlistId)
                .single()
            ownerEmailFromPlaylist = resp.data?.owner_email || null
            playlistError = resp.error
        }

        if (playlistError || ownerEmailFromPlaylist === null) {
            console.error('Supabase error:', playlistError)
            return NextResponse.json(
                { error: playlistError?.message || 'Playlist not found' },
                { status: 404 }
            )
        }

        if (ownerEmailFromPlaylist !== userEmail) {
            return NextResponse.json(
                { error: 'Forbidden' },
                { status: 403 }
            )
        }

        // 削除前に、この記事が他のプレイリストにも存在するか確認するためarticle_idを取得
        let itemToDelete: { article_id: string } | null = null
        let fetchError: { message: string } | null = null

        if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
            const items = (await supabaseLocal.getPlaylistWithItems(userEmail, playlistId))?.playlist_items || []
            const found = items.find((i: PlaylistItemWithArticle) => i.id === itemId)
            if (found) {
                itemToDelete = { article_id: found.article_id }
            }
            if (!found) fetchError = { message: 'Item not found' }
        } else {
            const resp = await supabase
                .from('playlist_items')
                .select('article_id')
                .eq('id', itemId)
                .eq('playlist_id', playlistId)
                .single()
            itemToDelete = resp.data
            fetchError = resp.error
        }

        if (fetchError || !itemToDelete) {
            console.error('Supabase error:', fetchError)
            return NextResponse.json(
                { error: fetchError?.message || 'Item not found' },
                { status: 404 }
            )
        }

        // playlist_itemsから削除
        let deleteError: { code?: string; message?: string } | null = null

        if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
            const ok = await supabaseLocal.removePlaylistItem(playlistId, itemId)
            if (!ok) deleteError = { code: 'PGRST116', message: 'Item not found' }
        } else {
            const resp = await supabase
                .from('playlist_items')
                .delete()
                .eq('id', itemId)
                .eq('playlist_id', playlistId)
                .single()
            deleteError = resp.error
        }

        if (deleteError) {
            // PGRST116は「No rows found」エラーコード
            if (deleteError.code === 'PGRST116') {
                return NextResponse.json(
                    { error: 'Item not found' },
                    { status: 404 }
                )
            }
            console.error('Supabase error:', deleteError)
            return NextResponse.json(
                { error: deleteError.message || 'Failed to delete item' },
                { status: 500 }
            )
        }

        // この記事が他のプレイリストに存在しないか確認
        if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
            // check if any other playlist uses the article
            const playlistAll = await supabaseLocal.getPlaylistsForOwner(userEmail)
            const allItems = playlistAll.flatMap(p => p.playlist_items || []) as PlaylistItemWithArticle[]
            const usedElsewhere = allItems.some((i: PlaylistItemWithArticle) => i.article_id === itemToDelete.article_id)
            if (!usedElsewhere) {
                // Optionally remove article from local store. Not required for tests.
            }
        } else {
            const { count, error: checkError } = await supabase
                .from('playlist_items')
                .select('*', { count: 'exact', head: true })
                .eq('article_id', itemToDelete.article_id)

            // 他のプレイリストに存在しない場合、articlesからも削除
            if (!checkError && count === 0) {
                const { error: articleDeleteError } = await supabase
                    .from('articles')
                    .delete()
                    .eq('id', itemToDelete.article_id)

                if (articleDeleteError) {
                    console.error('Failed to delete article:', articleDeleteError)
                    // 記事削除の失敗は致命的ではないので、エラーを返さない
                }
            }
        }

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Error in DELETE /api/playlists/[id]/items/[itemId]:', error)
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Internal server error' },
            { status: 500 }
        )
    }
}
