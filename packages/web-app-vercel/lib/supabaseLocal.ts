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
    article_hash?: string;
    thumbnail_url?: string;
    last_read_position?: number;
    created_at: string;
    updated_at: string;
}

interface ArticleStat {
    article_hash: string;
    url: string;
    title: string;
    domain?: string;
    access_count: number;
    cache_hits: number;
    cache_misses: number;
    is_fully_cached: boolean;
    last_accessed_at: string;
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
    playlists: Map<string, Playlist>;
    articles: Map<string, Article>;
    playlist_items: Map<string, PlaylistItem>;
    article_stats: Map<string, ArticleStat>;
} = {
    playlists: new Map(),
    articles: new Map(),
    playlist_items: new Map(),
    article_stats: new Map(),
};

function normalizeOwnerEmail(email: string | null) {
    return email || '';
}

export function resetInMemorySupabase() {
    inMemoryDB.playlists.clear();
    inMemoryDB.articles.clear();
    inMemoryDB.playlist_items.clear();
    inMemoryDB.article_stats.clear();
}

export async function createPlaylist(email: string | null, name: string, description?: string | null) {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const ownerEmail = normalizeOwnerEmail(email);
    const playlist: Playlist = {
        id,
        owner_email: ownerEmail,
        name,
        description: description || undefined,
        visibility: 'private',
        share_url: undefined,
        is_default: false,
        allow_fork: true,
        created_at: now,
        updated_at: now,
    };
    inMemoryDB.playlists.set(id, playlist);
    return playlist;
}

export async function getPlaylistsForOwner(email: string | null) {
    const ownerEmail = normalizeOwnerEmail(email);
    return Array.from(inMemoryDB.playlists.values())
        .filter(p => p.owner_email === ownerEmail)
        .map(p => {
            const rawItems = Array.from(inMemoryDB.playlist_items.values()).filter(i => i.playlist_id === p.id);
            const itemsWithArticle: PlaylistItemWithArticle[] = rawItems.map(pi => ({
                ...pi,
                article: inMemoryDB.articles.get(pi.article_id) || undefined,
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
    const playlist = inMemoryDB.playlists.get(playlistId);
    if (!playlist) return null;

    Object.assign(playlist, updates);
    playlist.updated_at = new Date().toISOString();
    return playlist;
}

export async function setDefaultPlaylist(ownerEmail: string, playlistId: string) {
    const normalizedOwnerEmail = normalizeOwnerEmail(ownerEmail);
    // Unset default for all other playlists of this owner
    Array.from(inMemoryDB.playlists.values()).forEach(p => {
        if (p.owner_email === normalizedOwnerEmail) {
            p.is_default = p.id === playlistId;
        }
    });
}

export async function deletePlaylistById(ownerEmail: string | null, id: string) {
    const normalizedOwnerEmail = normalizeOwnerEmail(ownerEmail);
    const playlist = inMemoryDB.playlists.get(id);
    if (!playlist || playlist.owner_email !== normalizedOwnerEmail) return false;
    inMemoryDB.playlists.delete(id);
    // remove associated items
    for (const [itemId, item] of inMemoryDB.playlist_items.entries()) {
        if (item.playlist_id === id) {
            inMemoryDB.playlist_items.delete(itemId);
        }
    }
    return true;
}

export async function upsertArticle(
    ownerEmail: string | null,
    url: string,
    title: string,
    thumbnail_url?: string | null,
    last_read_position?: number,
    article_hash?: string | null,
) {
    const normalizedOwnerEmail = normalizeOwnerEmail(ownerEmail);
    let article = Array.from(inMemoryDB.articles.values()).find(a => a.owner_email === normalizedOwnerEmail && a.url === url);
    const now = new Date().toISOString();
    if (!article) {
        const id = crypto.randomUUID();
        article = {
            id,
            owner_email: normalizedOwnerEmail,
            url,
            title,
            article_hash: article_hash || undefined,
            thumbnail_url: thumbnail_url || undefined,
            last_read_position: last_read_position ?? 0,
            created_at: now,
            updated_at: now,
        };
        inMemoryDB.articles.set(id, article);
    } else {
        // update title & thumbnail if provided
        article.title = title || article.title;
        article.article_hash = article_hash || article.article_hash || undefined;
        article.thumbnail_url = thumbnail_url || article.thumbnail_url || undefined;
        if (last_read_position !== undefined) {
            article.last_read_position = last_read_position;
        }
        article.updated_at = now;
    }
    return article;
}

export async function recordArticleStat(input: {
    articleHash: string;
    url: string;
    title: string;
    domain?: string;
    cacheHits: number;
    cacheMisses: number;
    isFullyCached: boolean;
}) {
    const now = new Date().toISOString();
    let stat = inMemoryDB.article_stats.get(input.articleHash);

    if (!stat) {
        stat = {
            article_hash: input.articleHash,
            url: input.url,
            title: input.title,
            domain: input.domain,
            access_count: 0,
            cache_hits: 0,
            cache_misses: 0,
            is_fully_cached: input.isFullyCached,
            last_accessed_at: now,
        };
        inMemoryDB.article_stats.set(input.articleHash, stat);
    }

    stat.url = input.url;
    stat.title = input.title;
    stat.domain = input.domain || stat.domain;
    stat.access_count += 1;
    stat.cache_hits += input.cacheHits;
    stat.cache_misses += input.cacheMisses;
    stat.is_fully_cached = input.isFullyCached;
    stat.last_accessed_at = now;

    return stat;
}

export async function resolveArticleId(ownerEmail: string | null, articleId: string) {
    const normalizedOwnerEmail = normalizeOwnerEmail(ownerEmail);
    const existingById = inMemoryDB.articles.get(articleId);
    if (existingById && existingById.owner_email === normalizedOwnerEmail) return existingById.id;

    const existingByHash = Array.from(inMemoryDB.articles.values()).find(a => a.owner_email === normalizedOwnerEmail && a.article_hash === articleId);
    if (existingByHash) return existingByHash.id;

    const existingByUrl = Array.from(inMemoryDB.articles.values()).find(a => a.owner_email === normalizedOwnerEmail && a.url === articleId);
    if (existingByUrl) return existingByUrl.id;

    const stat = inMemoryDB.article_stats.get(articleId);
    if (!stat) {
        throw new Error('Article stats not found');
    }

    const article = await upsertArticle(normalizedOwnerEmail, stat.url, stat.title, undefined, undefined, articleId);
    return article.id;
}

export async function addPlaylistItem(playlistId: string, articleId: string) {
    // If item exists, return it
    const existing = Array.from(inMemoryDB.playlist_items.values()).find(pi => pi.playlist_id === playlistId && pi.article_id === articleId);
    if (existing) return existing;

    // Determine position: find max position for playlist
    const items = Array.from(inMemoryDB.playlist_items.values()).filter(i => i.playlist_id === playlistId);
    const maxPos = items.length === 0 ? 0 : Math.max(...items.map(i => i.position ?? 0));

    const id = crypto.randomUUID();
    const item: PlaylistItem = {
        id,
        playlist_id: playlistId,
        article_id: articleId,
        position: maxPos + 1,
        added_at: new Date().toISOString(),
    };
    inMemoryDB.playlist_items.set(id, item);
    return item;
}

export async function getPlaylistWithItems(ownerEmail: string | null, id: string, sort?: { field?: string; order?: 'asc' | 'desc' }) {
    const normalizedOwnerEmail = normalizeOwnerEmail(ownerEmail);
    const playlist = inMemoryDB.playlists.get(id);
    if (!playlist || playlist.owner_email !== normalizedOwnerEmail) return null;

    // Collect items with article info
    const items: PlaylistItemWithArticle[] = Array.from(inMemoryDB.playlist_items.values())
        .filter(pi => pi.playlist_id === playlist.id)
        .map(pi => {
            const article = inMemoryDB.articles.get(pi.article_id);
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
            const sField = sortField as 'created_at' | 'updated_at';
            const aDate = sortField === 'added_at' ? a.added_at : (a.article?.[sField] as string) || '';
            const bDate = sortField === 'added_at' ? b.added_at : (b.article?.[sField] as string) || '';
            return sortOrder === 'desc' ? bDate.localeCompare(aDate) : aDate.localeCompare(bDate);
        });
    } else {
        // position
        sorted = [...items].sort((a, b) =>
            sortOrder === 'desc'
                ? (b.position ?? 0) - (a.position ?? 0)
                : (a.position ?? 0) - (b.position ?? 0)
        );
    }

    return {
        ...playlist,
        // keep both names: `playlist_items` (storage-like) and `items` (frontend-friendly)
        playlist_items: sorted,
        items: sorted,
    };
}

export async function removePlaylistItem(playlistId: string, itemId: string) {
    const item = inMemoryDB.playlist_items.get(itemId);
    if (!item || item.playlist_id !== playlistId) return false;
    inMemoryDB.playlist_items.delete(itemId);
    return true;
}
