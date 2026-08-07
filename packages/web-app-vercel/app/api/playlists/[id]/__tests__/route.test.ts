// @/lib/supabase 모ックを最初に定義
jest.mock('@/lib/supabase', () => ({
    supabase: {
        from: jest.fn((table: string) => {
            if (table === 'playlists') {
                return {
                    select: jest.fn(() => ({
                        eq: jest.fn(() => ({
                            eq: jest.fn(() => ({
                                single: jest.fn(() => Promise.resolve({
                                    data: {
                                        id: '1',
                                        name: 'Test Playlist',
                                        owner_email: 'test@example.com',
                                        is_default: false,
                                        playlist_items: []
                                    },
                                    error: null
                                })),
                                order: jest.fn(() => ({
                                    order: jest.fn(() => ({
                                        single: jest.fn(() => Promise.resolve({
                                            data: {
                                                id: '1',
                                                name: 'Test Playlist',
                                                owner_email: 'test@example.com',
                                                is_default: false,
                                                playlist_items: []
                                            },
                                            error: null
                                        }))
                                    }))
                                }))
                            }))
                        }))
                    })),
                    update: jest.fn(() => ({
                        eq: jest.fn(() => ({
                            eq: jest.fn(() => ({
                                select: jest.fn(() => ({
                                    single: jest.fn(() => Promise.resolve({
                                        data: {
                                            id: '1',
                                            name: 'Updated Playlist',
                                            description: 'Updated Description',
                                            owner_email: 'test@example.com'
                                        },
                                        error: null
                                    }))
                                }))
                            }))
                        }))
                    })),
                    delete: jest.fn(() => ({
                        eq: jest.fn(() => ({
                            eq: jest.fn(() => Promise.resolve({ error: null }))
                        }))
                    }))
                }
            }
            return {}
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

describe('/api/playlists/[id] route', () => {
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

    describe('GET', () => {
        it('returns 200 with playlist details (Supabase)', async () => {
            const mockRequest = new Request('http://localhost:3000/api/playlists/1')
            const res = await routeModule.GET(mockRequest, { params: Promise.resolve({ id: '1' }) })
            expect(res.status).toBe(200)
            const data = await res.json()
            expect(data).toHaveProperty('name', 'Test Playlist')
            expect(data).toHaveProperty('items')
            expect(data).toHaveProperty('item_count', 0)
        })

        it('uses local fallback when Supabase is not configured', async () => {
            delete process.env.NEXT_PUBLIC_SUPABASE_URL
            delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

            const supabaseLocal = require('@/lib/supabaseLocal')
            supabaseLocal.resetInMemorySupabase()
            const playlist = await supabaseLocal.createPlaylist('test@example.com', 'Local Detail Playlist')

            const mockRequest = new Request(`http://localhost:3000/api/playlists/${playlist.id}`)
            const res = await routeModule.GET(mockRequest, { params: Promise.resolve({ id: playlist.id }) })
            expect(res.status).toBe(200)
            const data = await res.json()
            expect(data).toHaveProperty('name', 'Local Detail Playlist')
        })
    })

    describe('PATCH', () => {
        it('returns 200 on successful update (Supabase)', async () => {
            const mockRequest = new Request('http://localhost:3000/api/playlists/1', {
                method: 'PATCH',
                body: JSON.stringify({ name: 'Updated Playlist', description: 'Updated Description' }),
                headers: { 'Content-Type': 'application/json' }
            })
            const res = await routeModule.PATCH(mockRequest, { params: Promise.resolve({ id: '1' }) })
            expect(res.status).toBe(200)
            const data = await res.json()
            expect(data).toHaveProperty('name', 'Updated Playlist')
            expect(data).toHaveProperty('description', 'Updated Description')
        })

        it('returns 400 when name is missing', async () => {
            const mockRequest = new Request('http://localhost:3000/api/playlists/1', {
                method: 'PATCH',
                body: JSON.stringify({ description: 'Updated Description' }),
                headers: { 'Content-Type': 'application/json' }
            })
            const res = await routeModule.PATCH(mockRequest, { params: Promise.resolve({ id: '1' }) })
            expect(res.status).toBe(400)
            const data = await res.json()
            expect(data).toHaveProperty('error', 'Name is required')
        })

        it('uses local fallback when Supabase is not configured', async () => {
            delete process.env.NEXT_PUBLIC_SUPABASE_URL
            delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

            const supabaseLocal = require('@/lib/supabaseLocal')
            supabaseLocal.resetInMemorySupabase()
            const playlist = await supabaseLocal.createPlaylist('test@example.com', 'Original Name')

            const mockRequest = new Request(`http://localhost:3000/api/playlists/${playlist.id}`, {
                method: 'PATCH',
                body: JSON.stringify({ name: 'Locally Updated Name' }),
                headers: { 'Content-Type': 'application/json' }
            })
            const res = await routeModule.PATCH(mockRequest, { params: Promise.resolve({ id: playlist.id }) })
            expect(res.status).toBe(200)
            const data = await res.json()
            expect(data).toHaveProperty('name', 'Locally Updated Name')
        })
    })

    describe('DELETE', () => {
        it('returns 200 on successful deletion (Supabase)', async () => {
            const mockRequest = new Request('http://localhost:3000/api/playlists/1', {
                method: 'DELETE'
            })
            const res = await routeModule.DELETE(mockRequest, { params: Promise.resolve({ id: '1' }) })
            expect(res.status).toBe(200)
            const data = await res.json()
            expect(data).toHaveProperty('message', 'Playlist deleted')
        })

        it('returns 400 when trying to delete default playlist (Supabase)', async () => {
            // Mock to return is_default: true
            const supabase = require('@/lib/supabase').supabase
            supabase.from.mockImplementationOnce((table: string) => {
                if (table === 'playlists') {
                    return {
                        select: jest.fn(() => ({
                            eq: jest.fn(() => ({
                                eq: jest.fn(() => ({
                                    single: jest.fn(() => Promise.resolve({
                                        data: { is_default: true },
                                        error: null
                                    }))
                                }))
                            }))
                        }))
                    }
                }
            })

            const mockRequest = new Request('http://localhost:3000/api/playlists/1', {
                method: 'DELETE'
            })
            const res = await routeModule.DELETE(mockRequest, { params: Promise.resolve({ id: '1' }) })
            expect(res.status).toBe(400)
            const data = await res.json()
            expect(data).toHaveProperty('error', 'Cannot delete default playlist')
        })

        it('uses local fallback when Supabase is not configured', async () => {
            delete process.env.NEXT_PUBLIC_SUPABASE_URL
            delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

            const supabaseLocal = require('@/lib/supabaseLocal')
            supabaseLocal.resetInMemorySupabase()
            const playlist = await supabaseLocal.createPlaylist('test@example.com', 'Playlist To Delete')

            const mockRequest = new Request(`http://localhost:3000/api/playlists/${playlist.id}`, {
                method: 'DELETE'
            })
            const res = await routeModule.DELETE(mockRequest, { params: Promise.resolve({ id: playlist.id }) })
            expect(res.status).toBe(200)

            // Verify it was deleted
            const playlists = await supabaseLocal.getPlaylistsForOwner('test@example.com')
            expect(playlists.length).toBe(0) // Assuming createPlaylist was the only one added
        })
    })
})
