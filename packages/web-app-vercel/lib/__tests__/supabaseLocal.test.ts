import {
    resetInMemorySupabase,
    createPlaylist,
    getPlaylistsForOwner,
    updatePlaylist,
    setDefaultPlaylist,
    deletePlaylistById,
    upsertArticle,
    addPlaylistItem,
    getPlaylistWithItems,
    removePlaylistItem
} from '../supabaseLocal';

describe('supabaseLocal', () => {
    const fixedTime = new Date('2024-01-01T12:00:00Z');

    beforeAll(() => {
        jest.useFakeTimers();
        jest.setSystemTime(fixedTime);
    });

    afterAll(() => {
        jest.useRealTimers();
    });

    beforeEach(() => {
        resetInMemorySupabase();
        jest.setSystemTime(fixedTime);
    });

    afterEach(() => {
        resetInMemorySupabase();
        jest.setSystemTime(fixedTime);
    });

    describe('resetInMemorySupabase', () => {
        it('clears playlists, articles, and playlist items', async () => {
            const playlist = await createPlaylist('user@example.com', 'My Playlist');
            const article = await upsertArticle('user@example.com', 'https://test.com', 'Test Title');
            await addPlaylistItem(playlist.id, article.id);

            resetInMemorySupabase();

            expect(await getPlaylistsForOwner('user@example.com')).toHaveLength(0);
            expect(await getPlaylistWithItems('user@example.com', playlist.id)).toBeNull();
        });
    });

    describe('createPlaylist', () => {
        it('creates a new playlist with default values', async () => {
            const playlist = await createPlaylist('user@example.com', 'My Playlist');

            expect(playlist).toMatchObject({
                owner_email: 'user@example.com',
                name: 'My Playlist',
                visibility: 'private',
                is_default: false,
                allow_fork: true,
                created_at: fixedTime.toISOString(),
                updated_at: fixedTime.toISOString(),
            });
            expect(playlist.id).toBeDefined();
            expect(playlist.description).toBeUndefined();
        });

        it('creates a new playlist with description', async () => {
            const playlist = await createPlaylist('user@example.com', 'My Playlist', 'A description');

            expect(playlist.description).toBe('A description');
        });

        it('handles null email and description', async () => {
            const playlist = await createPlaylist(null, 'My Playlist', null);

            expect(playlist.owner_email).toBe('');
            expect(playlist.description).toBeUndefined();
        });
    });

    describe('getPlaylistsForOwner', () => {
        it('returns only playlists for the specified owner with attached items', async () => {
            const p1 = await createPlaylist('user1@example.com', 'P1');
            const _p2 = await createPlaylist('user2@example.com', 'P2');

            const article = await upsertArticle('user1@example.com', 'url1', 'A1');
            await addPlaylistItem(p1.id, article.id);

            const playlists = await getPlaylistsForOwner('user1@example.com');

            expect(playlists).toHaveLength(1);
            expect(playlists[0].id).toBe(p1.id);
            expect(playlists[0].playlist_items).toHaveLength(1);
            expect(playlists[0].items[0].article).toMatchObject({ title: 'A1' });
        });
    });

    describe('updatePlaylist', () => {
        it('updates playlist fields and updated_at timestamp', async () => {
            const playlist = await createPlaylist('user@example.com', 'Old Name');

            jest.setSystemTime(new Date('2024-01-02T12:00:00Z'));

            const updated = await updatePlaylist(playlist.id, { name: 'New Name' });

            expect(updated?.name).toBe('New Name');
            expect(updated?.updated_at).toBe('2024-01-02T12:00:00.000Z');
            // Check if it persists
            const fetched = await getPlaylistsForOwner('user@example.com');
            expect(fetched[0].name).toBe('New Name');
        });

        it('returns null if playlist not found', async () => {
            const result = await updatePlaylist('non-existent-id', { name: 'New' });
            expect(result).toBeNull();
        });
    });

    describe('setDefaultPlaylist', () => {
        it('sets is_default to true for target and false for others of same owner', async () => {
            const p1 = await createPlaylist('user@example.com', 'P1');
            const _p2 = await createPlaylist('user@example.com', 'P2');
            const _otherUserP = await createPlaylist('other@example.com', 'Other');

            await setDefaultPlaylist('user@example.com', p1.id);

            const playlists = await getPlaylistsForOwner('user@example.com');
            expect(playlists.find(p => p.id === p1.id)?.is_default).toBe(true);
            expect(playlists.find(p => p.id === _p2.id)?.is_default).toBe(false);

            const otherPlaylists = await getPlaylistsForOwner('other@example.com');
            expect(otherPlaylists[0].is_default).toBe(false); // Should remain unchanged

            // Switch default
            await setDefaultPlaylist('user@example.com', _p2.id);
            const updatedPlaylists = await getPlaylistsForOwner('user@example.com');
            expect(updatedPlaylists.find(p => p.id === p1.id)?.is_default).toBe(false);
            expect(updatedPlaylists.find(p => p.id === _p2.id)?.is_default).toBe(true);
        });
    });

    describe('deletePlaylistById', () => {
        it('removes playlist and its items', async () => {
            const p = await createPlaylist('user@example.com', 'P1');
            const article = await upsertArticle('user@example.com', 'url1', 'A1');
            await addPlaylistItem(p.id, article.id);

            const result = await deletePlaylistById('user@example.com', p.id);
            expect(result).toBe(true);

            const playlists = await getPlaylistsForOwner('user@example.com');
            expect(playlists).toHaveLength(0);

            // Recreate a playlist and ensure the old items aren't mapped
            const _p2 = await createPlaylist('user@example.com', 'P2');
            const newPlaylists = await getPlaylistsForOwner('user@example.com');
            expect(newPlaylists[0].playlist_items).toHaveLength(0);
        });

        it('returns false if playlist not found or wrong owner', async () => {
            const p = await createPlaylist('user@example.com', 'P1');

            const r1 = await deletePlaylistById('wrong@example.com', p.id);
            expect(r1).toBe(false);

            const r2 = await deletePlaylistById('user@example.com', 'wrong-id');
            expect(r2).toBe(false);
        });
    });

    describe('upsertArticle', () => {
        it('creates a new article if not exists', async () => {
            const article = await upsertArticle('user@example.com', 'https://test.com', 'Test Title', 'thumb.jpg', 10);

            expect(article).toMatchObject({
                owner_email: 'user@example.com',
                url: 'https://test.com',
                title: 'Test Title',
                thumbnail_url: 'thumb.jpg',
                last_read_position: 10,
                created_at: fixedTime.toISOString(),
                updated_at: fixedTime.toISOString(),
            });
            expect(article.id).toBeDefined();
        });

        it('updates title and thumbnail if article exists', async () => {
            await upsertArticle('user@example.com', 'https://test.com', 'Old Title', 'old.jpg', 0);

            jest.setSystemTime(new Date('2024-01-02T12:00:00Z'));

            const article = await upsertArticle('user@example.com', 'https://test.com', 'New Title', 'new.jpg', 20);

            expect(article.title).toBe('New Title');
            expect(article.thumbnail_url).toBe('new.jpg');
            expect(article.updated_at).toBe('2024-01-02T12:00:00.000Z');
            expect(article.last_read_position).toBe(20);
        });

        it('handles null owner and optional parameters', async () => {
            const article = await upsertArticle(null, 'url', 'Title');
            expect(article.owner_email).toBe('');
            expect(article.thumbnail_url).toBeUndefined();
            expect(article.last_read_position).toBe(0);
        });

        it('updates an existing null-owner article instead of duplicating it', async () => {
            const initial = await upsertArticle(null, 'url', 'Old Title');
            const updated = await upsertArticle(null, 'url', 'New Title', undefined, 30);

            expect(updated.id).toBe(initial.id);
            expect(updated.title).toBe('New Title');
            expect(updated.last_read_position).toBe(30);
        });
    });

    describe('addPlaylistItem', () => {
        it('adds a new item with max position + 1', async () => {
            const p = await createPlaylist('user@example.com', 'P1');
            const a1 = await upsertArticle('user@example.com', 'url1', 'A1');
            const a2 = await upsertArticle('user@example.com', 'url2', 'A2');

            const item1 = await addPlaylistItem(p.id, a1.id);
            expect(item1.position).toBe(1);

            const item2 = await addPlaylistItem(p.id, a2.id);
            expect(item2.position).toBe(2);
        });

        it('returns existing item if already exists', async () => {
            const p = await createPlaylist('user@example.com', 'P1');
            const a1 = await upsertArticle('user@example.com', 'url1', 'A1');

            const item1 = await addPlaylistItem(p.id, a1.id);
            const item2 = await addPlaylistItem(p.id, a1.id);

            expect(item1.id).toBe(item2.id);
            expect(item2.position).toBe(1);
        });
    });

    describe('null owner operations', () => {
        it('reads and deletes playlists stored for a null owner', async () => {
            const playlist = await createPlaylist(null, 'Anonymous Playlist');
            const article = await upsertArticle(null, 'anonymous-url', 'Anonymous Article');
            await addPlaylistItem(playlist.id, article.id);

            const playlists = await getPlaylistsForOwner(null);
            expect(playlists).toHaveLength(1);
            expect(playlists[0].items[0].article?.id).toBe(article.id);

            const playlistWithItems = await getPlaylistWithItems(null, playlist.id);
            expect(playlistWithItems?.id).toBe(playlist.id);

            expect(await deletePlaylistById(null, playlist.id)).toBe(true);
            expect(await getPlaylistsForOwner(null)).toHaveLength(0);
        });
    });

    describe('removePlaylistItem', () => {
        it('removes item from playlist', async () => {
            const p = await createPlaylist('user@example.com', 'P1');
            const a = await upsertArticle('user@example.com', 'url', 'A1');
            const item = await addPlaylistItem(p.id, a.id);

            const result = await removePlaylistItem(p.id, item.id);
            expect(result).toBe(true);

            const playlists = await getPlaylistsForOwner('user@example.com');
            expect(playlists[0].playlist_items).toHaveLength(0);
        });

        it('returns false if item not found', async () => {
            const result = await removePlaylistItem('playlist', 'item');
            expect(result).toBe(false);
        });
    });

    describe('getPlaylistWithItems sorting', () => {
        let pId: string;

        beforeEach(async () => {
            const p = await createPlaylist('user@example.com', 'P1');
            pId = p.id;

            // Add items with different timestamps and titles
            jest.setSystemTime(new Date('2024-01-01T10:00:00Z'));
            const a1 = await upsertArticle('user@example.com', 'url1', 'Zebra'); // Older article, title Z

            jest.setSystemTime(new Date('2024-01-02T10:00:00Z'));
            const a2 = await upsertArticle('user@example.com', 'url2', 'Apple'); // Newer article, title A

            jest.setSystemTime(new Date('2024-01-03T10:00:00Z'));
            await addPlaylistItem(pId, a1.id); // Added later

            jest.setSystemTime(new Date('2024-01-01T12:00:00Z'));
            // Position is assigned from insertion order even when fake timers control added_at.
            await addPlaylistItem(pId, a2.id);
        });

        afterEach(() => {
            jest.setSystemTime(fixedTime);
        });

        it('returns null for non-existent playlist', async () => {
            const result = await getPlaylistWithItems('user@example.com', 'wrong-id');
            expect(result).toBeNull();
        });

        it('sorts by position by default (asc)', async () => {
            const playlist = await getPlaylistWithItems('user@example.com', pId);
            expect(playlist?.items[0].article?.title).toBe('Zebra'); // pos 1
            expect(playlist?.items[1].article?.title).toBe('Apple'); // pos 2
        });

        it('sorts by position desc when requested', async () => {
            const playlist = await getPlaylistWithItems('user@example.com', pId, { field: 'position', order: 'desc' });
            expect(playlist?.items[0].article?.title).toBe('Apple'); // pos 2
            expect(playlist?.items[1].article?.title).toBe('Zebra'); // pos 1
        });

        it('sorts by title asc/desc', async () => {
            const asc = await getPlaylistWithItems('user@example.com', pId, { field: 'title', order: 'asc' });
            expect(asc?.items[0].article?.title).toBe('Apple');
            expect(asc?.items[1].article?.title).toBe('Zebra');

            const desc = await getPlaylistWithItems('user@example.com', pId, { field: 'title', order: 'desc' });
            expect(desc?.items[0].article?.title).toBe('Zebra');
            expect(desc?.items[1].article?.title).toBe('Apple');
        });

        it('sorts by added_at asc/desc', async () => {
            const asc = await getPlaylistWithItems('user@example.com', pId, { field: 'added_at', order: 'asc' });
            expect(asc?.items[0].article?.title).toBe('Apple'); // Added 2024-01-01T12:00:00Z
            expect(asc?.items[1].article?.title).toBe('Zebra'); // Added 2024-01-03T10:00:00Z

            const desc = await getPlaylistWithItems('user@example.com', pId, { field: 'added_at', order: 'desc' });
            expect(desc?.items[0].article?.title).toBe('Zebra');
            expect(desc?.items[1].article?.title).toBe('Apple');
        });

        it('sorts by created_at asc/desc (article created_at)', async () => {
            const asc = await getPlaylistWithItems('user@example.com', pId, { field: 'created_at', order: 'asc' });
            expect(asc?.items[0].article?.title).toBe('Zebra'); // Created 2024-01-01
            expect(asc?.items[1].article?.title).toBe('Apple'); // Created 2024-01-02

            const desc = await getPlaylistWithItems('user@example.com', pId, { field: 'created_at', order: 'desc' });
            expect(desc?.items[0].article?.title).toBe('Apple');
            expect(desc?.items[1].article?.title).toBe('Zebra');
        });

        it('handles items without associated articles during sort gracefully', async () => {
             // force a scenario where article is missing
             const _p2 = await createPlaylist('user@example.com', 'P2');
             await addPlaylistItem(_p2.id, 'missing-article-id');

             // Sorting by title should not crash
             const asc = await getPlaylistWithItems('user@example.com', _p2.id, { field: 'title', order: 'asc' });
             expect(asc?.items).toHaveLength(1);
             expect(asc?.items[0].article).toBeUndefined();

             // Sorting by created_at should not crash
             const descDate = await getPlaylistWithItems('user@example.com', _p2.id, { field: 'created_at', order: 'desc' });
             expect(descDate?.items).toHaveLength(1);
        });
    });
});
