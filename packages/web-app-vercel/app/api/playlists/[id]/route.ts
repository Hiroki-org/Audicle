import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import * as supabaseLocal from '@/lib/supabaseLocal'
import { requireAuth } from '@/lib/api-auth'
import { PlaylistWithItems } from '@/types/playlist'

// リトライヘルパー関数
async function retryQuery<T>(queryFn: () => Promise<T>, maxRetries: number = 3, delay: number = 1000): Promise<T> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await queryFn();
        } catch (error) {
            if (attempt === maxRetries) {
                throw error;
            }
            // ECONNRESET などのネットワークエラー時はリトライ
            if (error instanceof Error && (error.message.includes('ECONNRESET') || error.message.includes('aborted'))) {
                console.warn(`Query attempt ${attempt} failed, retrying in ${delay}ms:`, error.message);
                await new Promise(resolve => setTimeout(resolve, delay));
            } else {
                throw error; // ネットワークエラー以外は即座に投げる
            }
        }
    }
    throw new Error('Max retries exceeded');
}

// GET: プレイリスト詳細取得（ブックマーク含む）
export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { userEmail, response } = await requireAuth()
        if (response) return response
        const { id } = await params
        const { searchParams } = new URL(request.url)
        const sortField = searchParams.get('sortField')
        const sortOrder = searchParams.get('sortOrder')

        // ソートパラメータの検証
        const validSortFields = ['position', 'title', 'created_at', 'updated_at', 'added_at']
        const validSortOrders = ['asc', 'desc']
        const field = validSortFields.includes(sortField || '') ? sortField : 'position'
        const order = validSortOrders.includes(sortOrder || '') ? sortOrder as 'asc' | 'desc' : 'asc'

        let playlist: PlaylistWithItems | null = null
        let playlistError: { code: string } | Error | null = null

        if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
            try {
                playlist = await supabaseLocal.getPlaylistWithItems(userEmail, id, { field: field || undefined, order })
                if (!playlist) {
                    playlistError = { code: 'PGRST116' }
                }
            } catch (e) {
                playlistError = e as Error
            }
        } else {
            // プレイリスト情報とアイテムを1つのクエリで取得
            const query = supabase
                .from('playlists')
                .select(`
        *,
        playlist_items(
          id,
          playlist_id,
          article_id,
          position,
          added_at,
          article:articles(*)
        )
      `)
                .eq('id', id)
                .eq('owner_email', userEmail)

            // ソート適用
            if (field === 'position') {
                query.order('position', { foreignTable: 'playlist_items', ascending: order === 'asc' })
            } else if (field === 'title') {
                query.order('title', { foreignTable: 'articles', ascending: order === 'asc' })
            } else if (field === 'created_at') {
                query.order('created_at', { foreignTable: 'articles', ascending: order === 'asc' })
            } else if (field === 'updated_at') {
                query.order('updated_at', { foreignTable: 'articles', ascending: order === 'asc' })
            } else if (field === 'added_at') {
                query.order('added_at', { foreignTable: 'playlist_items', ascending: order === 'asc' })
            }

            const resp = await retryQuery(async () => await query.single())
            playlist = resp.data
            playlistError = resp.error
        }

        if (playlistError || !playlist) {
            console.error('Supabase error:', playlistError)
            return NextResponse.json(
                { error: 'Playlist not found' },
                { status: 404 }
            )
        }

        // playlist_itemsをitemsにリネーム
        const { playlist_items: items = [], ...playlistData } = playlist

        return NextResponse.json({
            ...playlistData,
            items,
            item_count: items.length,
        })
    } catch (error) {
        console.error('Error in GET /api/playlists/[id]:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}

// PATCH: プレイリスト更新
export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { userEmail, response } = await requireAuth()
        if (response) return response
        const { id } = await params
        const body = await request.json()

        const { name, description } = body

        if (!name) {
            return NextResponse.json(
                { error: 'Name is required' },
                { status: 400 }
            )
        }

        if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
            // Local update check: we need to check ownership first because updatePlaylist in local doesn't check it explicitly
            const playlists = await supabaseLocal.getPlaylistsForOwner(userEmail);
            const ownsPlaylist = playlists.some(p => p.id === id);

            if (!ownsPlaylist) {
                return NextResponse.json({ error: 'Playlist not found or permission denied' }, { status: 404 })
            }

            const updated = await supabaseLocal.updatePlaylist(id, { name, description })
            if (!updated) {
                return NextResponse.json({ error: 'Playlist not found or permission denied' }, { status: 404 })
            }
            return NextResponse.json(updated)
        }

        const { data, error } = await supabase
            .from('playlists')
            .update({
                name,
                description,
            })
            .eq('id', id)
            .eq('owner_email', userEmail)
            .select()
            .single()

        if (error) {
            if (error.code === 'PGRST116') {
                return NextResponse.json(
                    { error: 'Playlist not found or permission denied' },
                    { status: 404 }
                )
            }
            console.error('Supabase error:', error)
            return NextResponse.json(
                { error: 'Failed to update playlist' },
                { status: 500 }
            )
        }

        return NextResponse.json(data)
    } catch (error) {
        console.error('Error in PATCH /api/playlists/[id]:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}

// DELETE: プレイリスト削除
export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { userEmail, response } = await requireAuth()
        if (response) return response
        const { id } = await params

        // デフォルトプレイリストかどうかを確認
        if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
            const found = (await supabaseLocal.getPlaylistsForOwner(userEmail)).find(p => p.id === id)
            if (!found) {
                return NextResponse.json({ error: 'Playlist not found' }, { status: 404 })
            }
            if (found.is_default) {
                return NextResponse.json({ error: 'Cannot delete default playlist' }, { status: 400 })
            }
            const deleted = await supabaseLocal.deletePlaylistById(userEmail, id)
            if (!deleted) {
                return NextResponse.json({ error: 'Failed to delete playlist' }, { status: 500 })
            }
            return NextResponse.json({ message: 'Playlist deleted' })
        }

        const { data: playlistToDelete, error: fetchError } = await supabase
            .from('playlists')
            .select('is_default')
            .eq('id', id)
            .eq('owner_email', userEmail)
            .single()

        if (fetchError || !playlistToDelete) {
            console.error('Supabase error:', fetchError)
            return NextResponse.json(
                { error: 'Playlist not found' },
                { status: 404 }
            )
        }

        if (playlistToDelete.is_default) {
            return NextResponse.json(
                { error: 'Cannot delete default playlist' },
                { status: 400 }
            )
        }

        // デフォルト以外のプレイリストを削除
        const { error } = await supabase
            .from('playlists')
            .delete()
            .eq('id', id)
            .eq('owner_email', userEmail)

        if (error) {
            console.error('Supabase error:', error)
            return NextResponse.json(
                { error: 'Failed to delete playlist' },
                { status: 500 }
            )
        }

        return NextResponse.json({ message: 'Playlist deleted' })
    } catch (error) {
        console.error('Error in DELETE /api/playlists/[id]:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}
