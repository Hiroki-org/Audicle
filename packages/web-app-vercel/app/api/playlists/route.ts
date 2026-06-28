import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import * as supabaseLocal from '@/lib/supabaseLocal'
import { requireAuth } from '@/lib/api-auth'
import { shouldUseLocalSupabaseFallback } from '@/lib/auth-env'
import type { Playlist } from '@/types/playlist'

type PlaylistItemCountRow = { count?: number }
type PlaylistWithItemCount = Playlist & {
    playlist_items?: PlaylistItemCountRow[] | unknown[]
}

function getPlaylistItemCount(playlistItems?: PlaylistWithItemCount['playlist_items']): number {
    if (!Array.isArray(playlistItems) || playlistItems.length === 0) {
        return 0
    }

    const firstItem = playlistItems[0]
    if (
        typeof firstItem === 'object' &&
        firstItem !== null &&
        'count' in firstItem
    ) {
        const count = (firstItem as PlaylistItemCountRow).count
        if (typeof count === 'number') {
            return count
        }
    }

    return playlistItems.length
}

// GET: ユーザーのプレイリスト一覧取得
export async function GET() {
    try {
        const { userEmail, response } = await requireAuth()
        if (response) return response

        let data: Playlist[] | null = null
        let error: Error | null = null

        if (shouldUseLocalSupabaseFallback()) {
            // Local fallback for tests (no Supabase configured)
            try {
                const playlists = await supabaseLocal.getPlaylistsForOwner(userEmail)
                data = playlists
            } catch (e) {
                error = e as Error
            }
        } else {
            const resp = await supabase
                .from('playlists')
                .select('*, playlist_items(count)')
                .eq('owner_email', userEmail)
                .order('is_default', { ascending: false })
                .order('created_at', { ascending: false })
            data = resp.data
            error = resp.error
        }

        if (error) {
            console.error('Supabase error:', error)
            return NextResponse.json(
                { error: 'Failed to fetch playlists' },
                { status: 500 }
            )
        }

        // カウントを含めて整形
        const playlists = (data || []).map((playlist: PlaylistWithItemCount) => ({
            ...playlist,
            item_count: getPlaylistItemCount(playlist.playlist_items),
            playlist_items: undefined,
        }))

        return NextResponse.json(playlists)
    } catch (error) {
        console.error('Error in GET /api/playlists:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}

// POST: プレイリスト作成
export async function POST(request: Request) {
    try {
        const { userEmail, response } = await requireAuth()
        if (response) return response
        const body = await request.json()

        const { name, description } = body

        if (!name) {
            return NextResponse.json(
                { error: 'Name is required' },
                { status: 400 }
            )
        }

        let insertData: Playlist | null = null
        let insertError: Error | null = null

        if (shouldUseLocalSupabaseFallback()) {
            insertData = await supabaseLocal.createPlaylist(userEmail, name, description)
        } else {
            const resp = await supabase
                .from('playlists')
                .insert({
                    owner_email: userEmail,
                    name,
                    description: description || null,
                    visibility: 'private',
                    is_default: false,
                    allow_fork: true,
                })
                .select()
                .single()
            insertData = resp.data
            insertError = resp.error
        }

        if (insertError || !insertData) {
            console.error('Supabase/Local error:', insertError)
            return NextResponse.json(
                { error: 'Failed to create playlist' },
                { status: 500 }
            )
        }

        return NextResponse.json(insertData as Playlist, { status: 201 })
    } catch (error) {
        console.error('Error in POST /api/playlists:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}
