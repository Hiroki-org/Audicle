// @/lib/supabaseLocal モック
jest.mock('@/lib/supabaseLocal', () => ({
    upsertArticle: jest.fn(),
    addPlaylistItem: jest.fn(),
}))

// @/lib/supabase モック
jest.mock('@/lib/supabase', () => ({
    supabase: {
        from: jest.fn()
    }
}))

// @/lib/api-auth モック
jest.mock('@/lib/api-auth', () => ({
    requireAuth: jest.fn()
}))

// next/server モック
jest.mock('next/server', () => ({
    NextResponse: {
        json: jest.fn((body, init) => {
            return {
                status: init?.status ?? 200,
                json: async () => body,
            }
        })
    }
}))

import { POST, GET } from '../route'
import { requireAuth } from '@/lib/api-auth'
import { supabase } from '@/lib/supabase'
import * as supabaseLocal from '@/lib/supabaseLocal'
import { NextResponse } from 'next/server'

describe('/api/playlists/[id]/items route', () => {
    let mockContext: { params: Promise<{ id: string }> }

    beforeEach(() => {
        jest.clearAllMocks()
        process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321'
        mockContext = { params: Promise.resolve({ id: 'playlist-123' }) }

        ;(requireAuth as jest.Mock).mockResolvedValue({
            userEmail: 'test@example.com',
            response: null
        })
    })

    afterEach(() => {
        delete process.env.NEXT_PUBLIC_SUPABASE_URL
    })

    const createRequest = (body: any) => {
        return new Request('http://localhost:3000/api/playlists/1/items', {
            method: 'POST',
            body: JSON.stringify(body),
            headers: { 'Content-Type': 'application/json' }
        })
    }

    describe('Authentication and Validation', () => {
        it('returns 401 if unauthenticated', async () => {
            const authResponse = NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
            ;(requireAuth as jest.Mock).mockResolvedValue({
                userEmail: null,
                response: authResponse
            })

            const request = createRequest({ article_url: 'http://test.com', article_title: 'Test' })
            const res = await POST(request, mockContext)

            expect(res).toBe(authResponse)
        })

        it('returns 404 if playlist not found', async () => {
            ;(supabase.from as jest.Mock).mockReturnValue({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                single: jest.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } })
            })

            const request = createRequest({ article_url: 'http://test.com', article_title: 'Test' })
            const res = await POST(request, mockContext) as any

            expect(res.status).toBe(404)
            expect(await res.json()).toEqual({ error: 'Playlist not found' })
        })

        it('returns 403 if user is not the owner of the playlist', async () => {
            ;(supabase.from as jest.Mock).mockReturnValue({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                single: jest.fn().mockResolvedValue({
                    data: { id: 'playlist-123', owner_email: 'other@example.com' },
                    error: null
                })
            })

            const request = createRequest({ article_url: 'http://test.com', article_title: 'Test' })
            const res = await POST(request, mockContext) as any

            expect(res.status).toBe(403)
            expect(await res.json()).toEqual({ error: 'Forbidden' })
        })

        it('returns 400 if article_url or article_title are missing', async () => {
            ;(supabase.from as jest.Mock).mockReturnValue({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                single: jest.fn().mockResolvedValue({
                    data: { id: 'playlist-123', owner_email: 'test@example.com' },
                    error: null
                })
            })

            const reqMissingBoth = createRequest({})
            const resBoth = await POST(reqMissingBoth, mockContext) as any
            expect(resBoth.status).toBe(400)

            const reqMissingUrl = createRequest({ article_title: 'Title' })
            const resUrl = await POST(reqMissingUrl, mockContext) as any
            expect(resUrl.status).toBe(400)

            const reqMissingTitle = createRequest({ article_url: 'http://test.com' })
            const resTitle = await POST(reqMissingTitle, mockContext) as any
            expect(resTitle.status).toBe(400)
        })
    })

    describe('Remote Supabase Integration (NEXT_PUBLIC_SUPABASE_URL set)', () => {
        let mockTables: Record<string, any>

        beforeEach(() => {
            mockTables = {
                playlists: {
                    select: jest.fn().mockReturnThis(),
                    eq: jest.fn().mockReturnThis(),
                    single: jest.fn().mockResolvedValue({ data: { owner_email: 'test@example.com' }, error: null })
                },
                articles: {
                    select: jest.fn().mockReturnThis(),
                    eq: jest.fn().mockReturnThis(),
                    update: jest.fn().mockReturnThis(),
                    insert: jest.fn().mockReturnThis(),
                    single: jest.fn() // Will be customized per test
                },
                playlist_items: {
                    select: jest.fn().mockReturnThis(),
                    eq: jest.fn().mockReturnThis(),
                    order: jest.fn().mockReturnThis(),
                    limit: jest.fn().mockReturnThis(),
                    insert: jest.fn().mockReturnThis(),
                    single: jest.fn() // Will be customized per test
                }
            }
            ;(supabase.from as jest.Mock).mockImplementation((table: string) => mockTables[table])
        })

        it('adds a new article and playlist item successfully', async () => {
            // Setup articles to not find existing, then return inserted
            mockTables.articles.single
                .mockResolvedValueOnce({ data: null, error: null }) // existingArticle
                .mockResolvedValueOnce({ data: { id: 'article-1', title: 'Test' }, error: null }) // created

            // Setup playlist_items to not find existing, return maxPos, return created
            mockTables.playlist_items.single
                .mockResolvedValueOnce({ data: null, error: null }) // existingItem
                .mockResolvedValueOnce({ data: { position: 5 }, error: null }) // maxPos
                .mockResolvedValueOnce({ data: { id: 'item-1', position: 6 }, error: null }) // created

            const request = createRequest({ article_url: 'http://test.com', article_title: 'Test' })
            const res = await POST(request, mockContext) as any
            const data = await res.json()

            expect(res.status).toBe(200)
            expect(data).toEqual({
                article: { id: 'article-1', title: 'Test' },
                item: { id: 'item-1', position: 6 }
            })
            expect(mockTables.articles.insert).toHaveBeenCalledWith({
                owner_email: 'test@example.com',
                url: 'http://test.com',
                title: 'Test',
                thumbnail_url: null,
                last_read_position: 0,
            })
            expect(mockTables.playlist_items.insert).toHaveBeenCalledWith({
                playlist_id: 'playlist-123',
                article_id: 'article-1',
                position: 6
            })
        })

        it('updates an existing article and returns existing playlist item', async () => {
            mockTables.articles.single
                .mockResolvedValueOnce({ data: { id: 'article-1', title: 'Old Title' }, error: null }) // existingArticle
                .mockResolvedValueOnce({ data: { id: 'article-1', title: 'Test' }, error: null }) // updated

            mockTables.playlist_items.single
                .mockResolvedValueOnce({ data: { id: 'item-1', article_id: 'article-1' }, error: null }) // existingItem

            const request = createRequest({ article_url: 'http://test.com', article_title: 'Test', thumbnail_url: 'http://thumb.com', last_read_position: 10 })
            const res = await POST(request, mockContext) as any
            const data = await res.json()

            expect(res.status).toBe(200)
            expect(data.article.id).toBe('article-1')
            expect(data.item.id).toBe('item-1')

            expect(mockTables.articles.update).toHaveBeenCalledWith({
                title: 'Test',
                thumbnail_url: 'http://thumb.com',
                last_read_position: 10,
            })
            expect(mockTables.playlist_items.insert).not.toHaveBeenCalled()
        })

        it('handles article creation error', async () => {
            mockTables.articles.single
                .mockResolvedValueOnce({ data: null, error: null }) // existingArticle
                .mockResolvedValueOnce({ data: null, error: { message: 'Insert failed' } }) // created

            const request = createRequest({ article_url: 'http://test.com', article_title: 'Test' })
            const res = await POST(request, mockContext) as any

            expect(res.status).toBe(500)
            expect(await res.json()).toEqual({ error: 'Insert failed' })
        })

        it('handles playlist item creation error', async () => {
            mockTables.articles.single
                .mockResolvedValueOnce({ data: null, error: null })
                .mockResolvedValueOnce({ data: { id: 'article-1' }, error: null })

            mockTables.playlist_items.single
                .mockResolvedValueOnce({ data: null, error: null }) // existingItem
                .mockResolvedValueOnce({ data: { position: 5 }, error: null }) // maxPos
                .mockResolvedValueOnce({ data: null, error: { message: 'Item insert failed' } }) // created error

            const request = createRequest({ article_url: 'http://test.com', article_title: 'Test' })
            const res = await POST(request, mockContext) as any

            expect(res.status).toBe(500)
            expect(await res.json()).toEqual({ error: 'Item insert failed' })
        })
    })

    describe('Local Supabase Integration (NEXT_PUBLIC_SUPABASE_URL not set)', () => {
        beforeEach(() => {
            delete process.env.NEXT_PUBLIC_SUPABASE_URL

            ;(supabase.from as jest.Mock).mockReturnValue({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                single: jest.fn().mockResolvedValue({ data: { owner_email: 'test@example.com' }, error: null })
            })
        })

        it('successfully adds an item via supabaseLocal', async () => {
            const mockArticle = { id: 'local-article-1', title: 'Local' }
            const mockItem = { id: 'local-item-1', article_id: 'local-article-1' }

            ;(supabaseLocal.upsertArticle as jest.Mock).mockResolvedValue(mockArticle)
            ;(supabaseLocal.addPlaylistItem as jest.Mock).mockResolvedValue(mockItem)

            const request = createRequest({ article_url: 'http://test.com', article_title: 'Test' })
            const res = await POST(request, mockContext) as any
            const data = await res.json()

            expect(res.status).toBe(200)
            expect(data).toEqual({ article: mockArticle, item: mockItem })

            expect(supabaseLocal.upsertArticle).toHaveBeenCalledWith(
                'test@example.com',
                'http://test.com',
                'Test',
                undefined,
                undefined
            )
            expect(supabaseLocal.addPlaylistItem).toHaveBeenCalledWith('playlist-123', 'local-article-1')
        })

        it('handles local article upsert error', async () => {
            ;(supabaseLocal.upsertArticle as jest.Mock).mockRejectedValue(new Error('Local upsert failed'))

            const request = createRequest({ article_url: 'http://test.com', article_title: 'Test' })
            const res = await POST(request, mockContext) as any

            expect(res.status).toBe(500)
            expect(await res.json()).toEqual({ error: 'Local upsert failed' })
        })

        it('handles local add playlist item error', async () => {
            ;(supabaseLocal.upsertArticle as jest.Mock).mockResolvedValue({ id: 'local-article-1' })
            ;(supabaseLocal.addPlaylistItem as jest.Mock).mockRejectedValue(new Error('Local item add failed'))

            const request = createRequest({ article_url: 'http://test.com', article_title: 'Test' })
            const res = await POST(request, mockContext) as any

            expect(res.status).toBe(500)
            expect(await res.json()).toEqual({ error: 'Local item add failed' })
        })
    })

    describe('GET method', () => {
        beforeEach(() => {
            process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321'
        })

        it('returns 404 if playlist not found', async () => {
            ;(supabase.from as jest.Mock).mockReturnValue({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                order: jest.fn().mockReturnThis(),
                single: jest.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } })
            })

            const request = new Request('http://localhost:3000/api/playlists/1/items', { method: 'GET' })
            const res = await GET(request, mockContext) as any
            expect(res.status).toBe(404)
        })

        it('returns playlist items successfully', async () => {
            const mockTables: Record<string, any> = {
                playlists: {
                    select: jest.fn().mockReturnThis(),
                    eq: jest.fn().mockReturnThis(),
                    single: jest.fn().mockResolvedValue({ data: { owner_email: 'test@example.com' }, error: null })
                },
                playlist_items: {
                    select: jest.fn().mockReturnThis(),
                    eq: jest.fn().mockReturnThis(),
                    order: jest.fn().mockResolvedValue({
                        data: [{ id: 'item-1', position: 1 }],
                        error: null
                    })
                }
            }
            ;(supabase.from as jest.Mock).mockImplementation((table: string) => mockTables[table])

            const request = new Request('http://localhost:3000/api/playlists/1/items', { method: 'GET' })
            const res = await GET(request, mockContext) as any
            const data = await res.json()

            expect(res.status).toBe(200)
            expect(data).toEqual([{ id: 'item-1', position: 1 }])
        })
    })
})

        it('adds a new playlist item with position 0 when playlist is empty', async () => {
            ;(requireAuth as jest.Mock).mockResolvedValue({
                userEmail: 'test@example.com',
                response: null
            })

            const mockTables: Record<string, any> = {
                playlists: {
                    select: jest.fn().mockReturnThis(),
                    eq: jest.fn().mockReturnThis(),
                    single: jest.fn().mockResolvedValue({ data: { owner_email: 'test@example.com' }, error: null })
                },
                articles: {
                    select: jest.fn().mockReturnThis(),
                    eq: jest.fn().mockReturnThis(),
                    update: jest.fn().mockReturnThis(),
                    insert: jest.fn().mockReturnThis(),
                    single: jest.fn().mockResolvedValue({ data: { id: 'article-1', title: 'Test' }, error: null }) // existingArticle
                },
                playlist_items: {
                    select: jest.fn().mockReturnThis(),
                    eq: jest.fn().mockReturnThis(),
                    order: jest.fn().mockReturnThis(),
                    limit: jest.fn().mockReturnThis(),
                    insert: jest.fn().mockReturnThis(),
                    single: jest.fn()
                }
            }
            ;(supabase.from as jest.Mock).mockImplementation((table: string) => mockTables[table])

            mockTables.playlist_items.single
                .mockResolvedValueOnce({ data: null, error: null }) // existingItem
                .mockResolvedValueOnce({ data: null, error: null }) // maxPos is null/empty
                .mockResolvedValueOnce({ data: { id: 'item-1', position: 0 }, error: null }) // created

            const request = new Request('http://localhost:3000/api/playlists/1/items', {
                method: 'POST',
                body: JSON.stringify({ article_url: 'http://test.com', article_title: 'Test' }),
                headers: { 'Content-Type': 'application/json' }
            })

            process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321'
            const res = await POST(request, { params: Promise.resolve({ id: 'playlist-123' }) }) as any

            expect(res.status).toBe(200)
            expect(mockTables.playlist_items.insert).toHaveBeenCalledWith({
                playlist_id: 'playlist-123',
                article_id: 'article-1',
                position: 0
            })
        })

        it('returns 403 if user is not the owner of the playlist on GET', async () => {
            ;(supabase.from as jest.Mock).mockReturnValue({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                single: jest.fn().mockResolvedValue({
                    data: { id: 'playlist-123', owner_email: 'other@example.com' },
                    error: null
                })
            })

            const request = new Request('http://localhost:3000/api/playlists/1/items', { method: 'GET' })
            const res = await GET(request, { params: Promise.resolve({ id: 'playlist-123' }) }) as any

            expect(res.status).toBe(403)
            expect(await res.json()).toEqual({ error: 'Forbidden' })
        })

        it('handles internal server errors on GET', async () => {
            ;(requireAuth as jest.Mock).mockRejectedValue(new Error('Auth service down'))

            const request = new Request('http://localhost:3000/api/playlists/1/items', { method: 'GET' })
            const res = await GET(request, { params: Promise.resolve({ id: 'playlist-123' }) }) as any

            expect(res.status).toBe(500)
            expect(await res.json()).toEqual({ error: 'Auth service down' })
        })

        it('handles database errors on playlist items GET', async () => {
            ;(requireAuth as jest.Mock).mockResolvedValue({
                userEmail: 'test@example.com',
                response: null
            })
            const mockTables: Record<string, any> = {
                playlists: {
                    select: jest.fn().mockReturnThis(),
                    eq: jest.fn().mockReturnThis(),
                    single: jest.fn().mockResolvedValue({ data: { owner_email: 'test@example.com' }, error: null })
                },
                playlist_items: {
                    select: jest.fn().mockReturnThis(),
                    eq: jest.fn().mockReturnThis(),
                    order: jest.fn().mockResolvedValue({
                        data: null,
                        error: { message: 'DB Error' }
                    })
                }
            }
            ;(supabase.from as jest.Mock).mockImplementation((table: string) => mockTables[table])

            const request = new Request('http://localhost:3000/api/playlists/1/items', { method: 'GET' })
            const res = await GET(request, { params: Promise.resolve({ id: 'playlist-123' }) }) as any

            expect(res.status).toBe(500)
            expect(await res.json()).toEqual({ error: 'Failed to fetch playlist items' })
        })
