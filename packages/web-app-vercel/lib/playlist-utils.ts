import { supabase } from './supabase'
import * as supabaseLocal from './supabaseLocal'
import type { PlaylistWithItems } from '@/types/playlist'
import { STORAGE_KEYS } from './constants'

export interface DefaultPlaylistResult {
    playlist?: PlaylistWithItems
    error?: string
}

/**
 * プレイリストのsortKeyをlocalStorageから取得
 * @param playlistId プレイリストID
 * @returns sortKey (例: "position", "title", "title-desc" など)
 */
export function getPlaylistSortKey(playlistId: string): string {
    if (typeof window === "undefined") return "position";
    const storageKey = `${STORAGE_KEYS.PLAYLIST_SORT_PREFIX}${playlistId}`;
    return localStorage.getItem(storageKey) || "position";
}

/**
 * プレイリストのsortKeyをlocalStorageに保存
 * @param playlistId プレイリストID
 * @param sortKey sortKey (例: "position", "title", "title-desc" など)
 */
export function setPlaylistSortKey(playlistId: string, sortKey: string): void {
    if (typeof window === "undefined") return;
    const storageKey = `${STORAGE_KEYS.PLAYLIST_SORT_PREFIX}${playlistId}`;
    try {
        localStorage.setItem(storageKey, sortKey);
    } catch (e) {
        console.warn("Failed to save playlist sort key:", e);
    }
}

/**
 * ユーザーのデフォルトプレイリストを取得し、存在しない場合は作成する
 * @param userEmail ユーザーemail (nullでないことが保証されている)
 * @returns デフォルトプレイリストオブジェクトまたはエラー
 */
export async function getOrCreateDefaultPlaylist(userEmail: string): Promise<DefaultPlaylistResult> {
    // デフォルトプレイリストを取得
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
        // Local fallback (tests)
        const playlists = await supabaseLocal.getPlaylistsForOwner(userEmail)
        const defaultPlaylist = playlists.find(p => p.is_default)
        if (defaultPlaylist) {
            const { playlist_items: items = [], ...playlistData } = defaultPlaylist
            return { playlist: { ...playlistData, items, item_count: items.length } }
        }
        // create one
        const newPlaylist = await supabaseLocal.createPlaylist(userEmail, '読み込んだ記事', '読み込んだ記事が自動的に追加されます')
        await supabaseLocal.setDefaultPlaylist(userEmail, newPlaylist.id)
        return { playlist: { ...newPlaylist, items: [], item_count: 0 } }
    }

    const { data: defaultPlaylist, error: playlistError } = await supabase
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
        .eq('owner_email', userEmail)
        .eq('is_default', true)
        .order('position', { foreignTable: 'playlist_items', ascending: true })
        .single()

    if (defaultPlaylist) {
        // playlist_itemsをitemsにリネーム
        const { playlist_items: items = [], ...playlistData } = defaultPlaylist
        return { playlist: { ...playlistData, items, item_count: items.length } }
    }

    // プレイリストが存在しない場合は作成（PGRST116 = not found）
    if (playlistError && playlistError.code === 'PGRST116') {
        // デフォルトプレイリストが存在しない場合は作成
        const { data: newPlaylist, error: createError } = await supabase
            .from('playlists')
            .insert(
                {
                    owner_email: userEmail,
                    name: '読み込んだ記事',
                    description: '読み込んだ記事が自動的に追加されます',
                    visibility: 'private',
                    is_default: true,
                    allow_fork: true,
                },
            )
            .select()
            .single()

        if (createError) {
            console.error('Supabase error (create playlist):', createError)
            return { error: 'Failed to create default playlist' }
        }

        // 新規作成されたプレイリストにはアイテムがないため、再フェッチせずに手動でオブジェクトを構築します。
        return {
            playlist: {
                ...newPlaylist,
                items: [],
                item_count: 0,
            },
        }
    }

    console.error('Supabase error (playlist):', playlistError)
    return { error: 'Failed to find default playlist' }
}