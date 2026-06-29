import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import * as supabaseLocal from '@/lib/supabaseLocal'
import { requireAuth } from '@/lib/api-auth'
import { Playlist } from '@/types/playlist'

// PUT: デフォルトプレイリストを変更
export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { userEmail, response } = await requireAuth()
        if (response) return response
        const { id } = await params

        if (!userEmail) {
            return NextResponse.json(
                { error: 'User email not found' },
                { status: 400 }
            )
        }

        // 指定されたプレイリストがユーザーに属しているか確認
        let targetPlaylist: Partial<Playlist> | null = null
        let fetchError: { code: string } | null = null

        if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
            const playlists = await supabaseLocal.getPlaylistsForOwner(userEmail)
            const found = playlists.find(p => p.id === id)
            targetPlaylist = found || null
            if (!targetPlaylist) fetchError = { code: 'PGRST116' }
        } else {
            const resp = await supabase
                .from('playlists')
                .select('id, owner_email, is_default')
                .eq('id', id)
                .eq('owner_email', userEmail)
                .single()
            targetPlaylist = resp.data
            fetchError = resp.error
        }

        if (fetchError || !targetPlaylist) {
            return NextResponse.json(
                { error: 'Playlist not found or permission denied' },
                { status: 403 }
            )
        }

        // 既にデフォルトプレイリストの場合はスキップ
        if (targetPlaylist.is_default) {
            return NextResponse.json({
                success: true,
                message: 'このプレイリストは既にデフォルト設定されています',
            })
        }

        // Supabase RPC関数 set_default_playlist を呼び出し
        if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
            await supabaseLocal.setDefaultPlaylist(userEmail, id)
            return NextResponse.json({ success: true, message: 'デフォルトプレイリストを更新しました' })
        }

        const { data, error } = await supabase.rpc('set_default_playlist', {
            p_playlist_id: id,
            p_user_email: userEmail,
        })

        if (error) {
            console.error('Supabase RPC error:', error)
            return NextResponse.json(
                { error: 'Failed to set default playlist' },
                { status: 500 }
            )
        }

        return NextResponse.json({
            success: true,
            message: 'デフォルトプレイリストを更新しました',
            data,
        })
    } catch (error) {
        console.error('Error in PUT /api/playlists/[id]/set-default:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}
