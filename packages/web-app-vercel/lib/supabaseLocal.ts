import { PlaylistItemWithArticle } from '@/types/playlist';

/**
 * Very small in-memory supabase fallback for tests.
 * Implements minimal operations used by playlist endpoints.
 */

interface Article {
    id: string;
    owner_email: string;
    url: string;
    title: string;
    thumbnail_url?: string;
    last_read_position?: number;
    created_at: string;
    updated_at: string;
}

interface Playlist {
    id: string;
    owner_email: string;
    name: string;
    description?: string;
    visibility: 'private' | 'shared' | 'collaborative';
    share_url?: string;
    is_default: boolean;
    allow_fork: boolean;
    created_at: string;
    updated_at: string;
}

interface PlaylistItem {
    id: string;
    playlist_id: string;
    article_id: string;
    position: number;
    added_at: string;
}

const inMemoryDB: {
    playlists: Playlist[];
    articles: Article[];
    playlist_items: PlaylistItem[];
} = {
    playlists: [],
    articles: [],
    playlist_items: [],
};

export function resetInMemorySupabase() {
    inMemoryDB.playlists = [];
    inMemoryDB.articles = [];
    inMemoryDB.playlist_items = [];
}

export async function createPlaylist(email: string | null, name: string, description?: string | null) {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const playlist: Playlist = {
        id,
        owner_email: email || '',
        name,
        description: description || undefined,
        visibility: 'private',
        share_url: undefined,
        is_default: false,
        allow_fork: true,
        created_at: now,
        updated_at: now,
    };
    inMemoryDB.playlists.push(playlist);
    return playlist;
}

export async function getPlaylistsForOwner(email: string | null) {
    return inMemoryDB.playlists
        .filter(p => p.owner_email === email)
        .map(p => {
            const rawItems = inMemoryDB.playlist_items.filter(i => i.playlist_id === p.id);
            const itemsWithArticle: PlaylistItemWithArticle[] = rawItems.map(pi => ({
                ...pi,
                article: inMemoryDB.articles.find(a => a.id === pi.article_id) || undefined,
            }));
            return {
                ...p,
                // keep raw storage shape
                playlist_items: rawItems,
                // provide `items` for frontend convenience (with article attached)
                items: itemsWithArticle,
            };
        });
}

export async function updatePlaylist(playlistId: string, updates: Partial<Playlist>) {
    const playlist = inMemoryDB.playlists.find(p => p.id === playlistId);
    if (!playlist) return null;

    Object.assign(playlist, updates);
    playlist.updated_at = new Date().toISOString();
    return playlist;
}

export async function setDefaultPlaylist(ownerEmail: string, playlistId: string) {
    // Unset default for all other playlists of this owner
    inMemoryDB.playlists.forEach(p => {
        if (p.owner_email === ownerEmail) {
            p.is_default = p.id === playlistId;
        }
    });
}

export async function deletePlaylistById(ownerEmail: string | null, id: string) {
    const idx = inMemoryDB.playlists.findIndex(p => p.id === id && p.owner_email === ownerEmail);
    if (idx === -1) return false;
    const [removed] = inMemoryDB.playlists.splice(idx, 1);
    // remove associated items
    inMemoryDB.playlist_items = inMemoryDB.playlist_items.filter(i => i.playlist_id !== removed.id);
    return true;
}

export async function upsertArticle(ownerEmail: string | null, url: string, title: string, thumbnail_url?: string | null, last_read_position?: number) {
    let article = inMemoryDB.articles.find(a => a.owner_email === ownerEmail && a.url === url);
    const now = new Date().toISOString();
    if (!article) {
        article = {
            id: crypto.randomUUID(),
            owner_email: ownerEmail || '',
            url,
            title,
            thumbnail_url: thumbnail_url || undefined,
            last_read_position: last_read_position || 0,
            created_at: now,
            updated_at: now,
        };
        inMemoryDB.articles.push(article);
    } else {
        // update title & thumbnail if provided
        article.title = title || article.title;
        article.thumbnail_url = thumbnail_url || article.thumbnail_url || undefined;
        article.updated_at = now;
    }
    return article;
}

export async function addPlaylistItem(playlistId: string, articleId: string) {
    // If item exists, return it
    const existing = inMemoryDB.playlist_items.find(pi => pi.playlist_id === playlistId && pi.article_id === articleId);
    if (existing) return existing;

    // Determine position: find max position for playlist
    const items = inMemoryDB.playlist_items.filter(i => i.playlist_id === playlistId);
    const maxPos = items.length === 0 ? 0 : Math.max(...items.map(i => i.position ?? 0));

    const item: PlaylistItem = {
        id: crypto.randomUUID(),
        playlist_id: playlistId,
        article_id: articleId,
        position: maxPos + 1,
        added_at: new Date().toISOString(),
    };
    inMemoryDB.playlist_items.push(item);
    return item;
}

export async function getPlaylistWithItems(ownerEmail: string | null, id: string, sort?: { field?: string; order?: 'asc' | 'desc' }) {
    const playlist = inMemoryDB.playlists.find(p => p.id === id && p.owner_email === ownerEmail);
    if (!playlist) return null;

    // Collect items with article info
    const items: PlaylistItemWithArticle[] = inMemoryDB.playlist_items
        .filter(pi => pi.playlist_id === playlist.id)
        .map(pi => {
            const article = inMemoryDB.articles.find(a => a.id === pi.article_id);
            return {
                ...pi,
                article: article || undefined,
            };
        });

    const sortField = sort?.field || 'position';
    const sortOrder = sort?.order || 'asc';

    let sorted = [...items];

    if (sortField === 'title') {
        sorted = [...items].sort((a, b) => {
            const at = a.article?.title || '';
            const bt = b.article?.title || '';
            return sortOrder === 'desc' ? bt.localeCompare(at) : at.localeCompare(bt);
        });
    } else if (['added_at', 'created_at', 'updated_at'].includes(sortField)) {
        sorted = [...items].sort((a, b) => {
            const sField = sortField as keyof Article;
            const aDate = sortField === 'added_at' ? a.added_at : (a.article?.[sField] as string) || '';
            const bDate = sortField === 'added_at' ? b.added_at : (b.article?.[sField] as string) || '';
            return sortOrder === 'desc' ? bDate.localeCompare(aDate) : aDate.localeCompare(bDate);
        });
    } else {
        // position
        sorted = [...items].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    }

    return {
        ...playlist,
        // keep both names: `playlist_items` (storage-like) and `items` (frontend-friendly)
        playlist_items: sorted,
        items: sorted,
    };
}

export async function removePlaylistItem(playlistId: string, itemId: string) {
    const idx = inMemoryDB.playlist_items.findIndex(i => i.id === itemId && i.playlist_id === playlistId);
    if (idx === -1) return false;
    inMemoryDB.playlist_items.splice(idx, 1);
    return true;
}
