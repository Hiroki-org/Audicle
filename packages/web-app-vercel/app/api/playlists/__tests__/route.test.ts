// @/lib/supabase モックを最初に定義
jest.mock('@/lib/supabase', () => ({
    supabase: {
        from: jest.fn((table: string) => {
            // Mock different table call patterns
            if (table === 'playlists') {
                const playlistData = [
                    {
                        id: '1',
                        name: 'Test Playlist',
                        owner_email: 'test@example.com',
                        playlist_items: [{ count: 2 }]
                    }
                ];

                return {
                    select: jest.fn(() => ({
                        eq: jest.fn(() => ({
                            in: jest.fn(() => ({
                                order: jest.fn(() => ({
                                    order: jest.fn(() => Promise.resolve({ data: playlistData, error: null }))
                                }))
                            })),
                            // Single owner check
                            single: jest.fn(() => Promise.resolve({
                                data: { id: '1', owner_email: 'test@example.com' },
                                error: null
                            })),
                            order: jest.fn(() => ({
                                order: jest.fn(() => Promise.resolve({ data: playlistData, error: null }))
                            }))
                        }))
                    })),
                    // For ownership check single()
                    selectOwner: jest.fn(),
                    // For playList update/insert
                    insert: jest.fn(() => ({
                        select: jest.fn(() => ({
                            single: jest.fn(() => Promise.resolve({
                                data: {
                                    id: '1',
                                    name: 'New Playlist',
                                    owner_email: 'test@example.com'
                                },
                                error: null
                            }))
                        }))
                    })),
                }
            }

            if (table === 'playlist_items') {
                return {
                    select: jest.fn(() => ({
                        eq: jest.fn(() => ({
                            order: jest.fn(() => Promise.resolve({
                                data: [
                                    {
                                        id: 'i1',
                                        playlist_id: '1',
                                        article_id: 'a1',
                                        position: 1,
                                        added_at: '2025-01-01T00:00:00Z',
                                        article: { url: 'https://example.com' }
                                    }
                                ],
                                error: null
                            }))
                        }))
                    }))
                }
            }

            // Default fallback for other calls
            return {
                select: jest.fn(() => ({
                    eq: jest.fn(() => ({
                        order: jest.fn(() => ({
                            order: jest.fn(() => Promise.resolve({ data: [], error: null }))
                        }))
                    }))
                })),
                insert: jest.fn(() => ({
                    select: jest.fn(() => ({
                        single: jest.fn(() => Promise.resolve({ data: null, error: null }))
                    }))
                }))
            }
        })
    }
}))

// 他のモック
jest.mock('@/lib/api-auth', () => ({
    requireAuth: jest.fn(() => Promise.resolve({
        userEmail: 'test@example.com',
        response: null
    }))
}))

import * as routeModule from '../route'

describe('/api/playlists route', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        // Set full Supabase config to use the mocked supabase
        process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321'
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'
        delete process.env.AUTH_ENV
        delete process.env.NEXT_PUBLIC_AUTH_ENV
    })

    afterEach(() => {
        delete process.env.NEXT_PUBLIC_SUPABASE_URL
        delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
        delete process.env.AUTH_ENV
        delete process.env.NEXT_PUBLIC_AUTH_ENV
    })

    it('returns 200 on GET with playlists data', async () => {
        const res = await routeModule.GET()
        expect(res.status).toBe(200)
        const data = await res.json()
        expect(Array.isArray(data)).toBe(true)
        expect(data.length).toBeGreaterThan(0)
        expect(data[0]).toHaveProperty('name', 'Test Playlist')
    })

    it('returns 400 on POST when name missing', async () => {
        const mockRequest = new Request('http://localhost:3000/api/playlists', {
            method: 'POST',
            body: JSON.stringify({}),
            headers: { 'Content-Type': 'application/json' }
        })
        const res = await routeModule.POST(mockRequest)
        expect(res.status).toBe(400)
    })

    it('GET /items returns playlist items', async () => {
        // Prepare a mock for select(). This relies on the earlier jest.mock / chain
        // The route expects `requireAuth` to return `test@example.com` as above.
        // Call the GET handler for playlist items
        const mockRequest = new Request('http://localhost:3000/api/playlists/1/items')
        // Import the items route directly
        const itemsModule = require('../[id]/items/route')
        const res = await itemsModule.GET(mockRequest, { params: Promise.resolve({ id: '1' }) })
        expect(res.status).toBe(200)
        const data = await res.json()
        expect(Array.isArray(data)).toBe(true)
        // because our supabase mock returns playlist_items in the parent route mock,
        // here we assume the items array is returned (mock stub may vary)
    })

    it('POST /items uses the local playlist fallback when Supabase is not configured', async () => {
        delete process.env.NEXT_PUBLIC_SUPABASE_URL
        delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

        const supabaseLocal = require('@/lib/supabaseLocal')
        supabaseLocal.resetInMemorySupabase()
        const playlist = await supabaseLocal.createPlaylist('test@example.com', 'Local Playlist')

        const mockRequest = new Request(`http://localhost:3000/api/playlists/${playlist.id}/items`, {
            method: 'POST',
            body: JSON.stringify({
                article_url: 'https://example.com/?id=apple',
                article_title: 'Apple',
                thumbnail_url: null,
                last_read_position: 0,
            }),
            headers: { 'Content-Type': 'application/json' },
        })

        const itemsModule = require('../[id]/items/route')
        const res = await itemsModule.POST(mockRequest, {
            params: Promise.resolve({ id: playlist.id }),
        })

        expect(res.status).toBe(200)
        const data = await res.json()
        expect(data.article).toMatchObject({
            owner_email: 'test@example.com',
            title: 'Apple',
            url: 'https://example.com/?id=apple',
        })
        expect(data.item).toMatchObject({
            playlist_id: playlist.id,
            article_id: data.article.id,
        })
    })

    it('GET /items uses the local playlist fallback when Supabase is not configured', async () => {
        delete process.env.NEXT_PUBLIC_SUPABASE_URL
        delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

        const supabaseLocal = require('@/lib/supabaseLocal')
        supabaseLocal.resetInMemorySupabase()
        const playlist = await supabaseLocal.createPlaylist('test@example.com', 'Local Playlist')
        const article = await supabaseLocal.upsertArticle(
            'test@example.com',
            'https://example.com/?id=banana',
            'Banana',
            null,
            0,
        )
        const item = await supabaseLocal.addPlaylistItem(playlist.id, article.id)

        const mockRequest = new Request(`http://localhost:3000/api/playlists/${playlist.id}/items`)
        const itemsModule = require('../[id]/items/route')
        const res = await itemsModule.GET(mockRequest, {
            params: Promise.resolve({ id: playlist.id }),
        })

        expect(res.status).toBe(200)
        const data = await res.json()
        expect(data).toHaveLength(1)
        expect(data[0]).toMatchObject({
            id: item.id,
            playlist_id: playlist.id,
            article_id: article.id,
            article: {
                title: 'Banana',
                url: 'https://example.com/?id=banana',
            },
        })
    })

    it('POST /api/playlists uses local fallback in test auth mode even with Supabase config', async () => {
        process.env.AUTH_ENV = 'test'

        const supabaseLocal = require('@/lib/supabaseLocal')
        supabaseLocal.resetInMemorySupabase()

        const mockRequest = new Request('http://localhost:3000/api/playlists', {
            method: 'POST',
            body: JSON.stringify({ name: 'Test Auth Playlist' }),
            headers: { 'Content-Type': 'application/json' },
        })

        const res = await routeModule.POST(mockRequest)

        expect(res.status).toBe(201)
        const data = await res.json()
        expect(data).toMatchObject({
            owner_email: 'test@example.com',
            name: 'Test Auth Playlist',
        })
    })
})
