import { NextResponse } from 'next/server'
import { POST } from '../route'
import { requireAuth } from '@/lib/api-auth'
import { resolveArticleId } from '@/lib/api-helpers'
import { supabase } from '@/lib/supabase'
import * as supabaseLocal from '@/lib/supabaseLocal'

// Mock dependencies
jest.mock('@/lib/api-auth', () => ({
    requireAuth: jest.fn(),
}))

jest.mock('@/lib/api-helpers', () => ({
    resolveArticleId: jest.fn(),
}))

jest.mock('@/lib/supabase', () => ({
    supabase: {
        from: jest.fn(),
        rpc: jest.fn(),
    },
}))

jest.mock('@/lib/supabaseLocal', () => ({
    addPlaylistItem: jest.fn(),
    getPlaylistWithItems: jest.fn(),
    getPlaylistsForOwner: jest.fn(),
    removePlaylistItem: jest.fn(),
}))

describe('POST /api/playlists/bulk_update', () => {
    const mockUserEmail = 'test@example.com'
    const mockArticleId = 'test-article-id'
    const actualArticleId = 'resolved-article-id'

    // Test utility to configure the supabase select mock correctly
    const mockSupabaseFrom = (count: number | null, error: Error | null = null) => {
        const mockEq = jest.fn().mockResolvedValue({ count, error })
        const mockIn = jest.fn().mockReturnValue({ eq: mockEq })
        const mockSelect = jest.fn().mockReturnValue({ in: mockIn })

        ;(supabase.from as jest.Mock).mockReturnValue({ select: mockSelect })

        return { mockSelect, mockIn, mockEq }
    }

    beforeEach(() => {
        jest.clearAllMocks()
        process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321'
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'
        delete process.env.AUTH_ENV
        delete process.env.NEXT_PUBLIC_AUTH_ENV

        // Default mock implementations
        ;(requireAuth as jest.Mock).mockResolvedValue({ userEmail: mockUserEmail, response: null })
        ;(resolveArticleId as jest.Mock).mockResolvedValue(actualArticleId)

        // Use the utility to setup the default mock chain returning count=0
        mockSupabaseFrom(0)

        ;(supabase.rpc as jest.Mock).mockResolvedValue({
            data: [{ added_count: 1, removed_count: 1 }],
            error: null,
        })
    })

    afterEach(() => {
        delete process.env.NEXT_PUBLIC_SUPABASE_URL
        delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
        delete process.env.AUTH_ENV
        delete process.env.NEXT_PUBLIC_AUTH_ENV
    })

    const createRequest = (body: any) => {
        return new Request('http://localhost/api/playlists/bulk_update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        })
    }

    it('should return 401 if authentication fails', async () => {
        const authResponse = NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        ;(requireAuth as jest.Mock).mockResolvedValue({ userEmail: null, response: authResponse })

        const request = createRequest({
            articleId: mockArticleId,
            addToPlaylistIds: ['playlist-1'],
            removeFromPlaylistIds: ['playlist-2'],
        })

        const response = await POST(request)
        expect(response.status).toBe(401)
    })

    it('should return 400 if articleId is missing', async () => {
        const request = createRequest({
            addToPlaylistIds: ['playlist-1'],
            removeFromPlaylistIds: ['playlist-2'],
        })

        const response = await POST(request)
        expect(response.status).toBe(400)

        const data = await response.json()
        expect(data.error).toBe('articleId is required')
    })

    it('should return 400 if playlist IDs are not arrays', async () => {
        const request = createRequest({
            articleId: mockArticleId,
            addToPlaylistIds: 'playlist-1', // Invalid type
            removeFromPlaylistIds: ['playlist-2'],
        })

        const response = await POST(request)
        expect(response.status).toBe(400)

        const data = await response.json()
        expect(data.error).toBe('addToPlaylistIds and removeFromPlaylistIds must be arrays')
    })

    it('should return 404 if article resolution fails', async () => {
        ;(resolveArticleId as jest.Mock).mockRejectedValue(new Error('Article not found'))

        const request = createRequest({
            articleId: mockArticleId,
            addToPlaylistIds: ['playlist-1'],
            removeFromPlaylistIds: ['playlist-2'],
        })

        const response = await POST(request)
        expect(response.status).toBe(404)

        const data = await response.json()
        expect(data.error).toBe('Article not found')
    })

    it('should return 500 if playlist ownership verification fails', async () => {
        mockSupabaseFrom(null, new Error('DB Error'))

        const request = createRequest({
            articleId: mockArticleId,
            addToPlaylistIds: ['playlist-1'],
            removeFromPlaylistIds: ['playlist-2'],
        })

        const response = await POST(request)
        expect(response.status).toBe(500)

        const data = await response.json()
        expect(data.error).toBe('Failed to verify playlists')
    })

    it('should return 403 if user does not own all playlists', async () => {
        // We have 2 unique playlists in the request, but we mock the db to return a count of 1
        mockSupabaseFrom(1)

        const request = createRequest({
            articleId: mockArticleId,
            addToPlaylistIds: ['playlist-1'],
            removeFromPlaylistIds: ['playlist-2'],
        })

        const response = await POST(request)
        expect(response.status).toBe(403)

        const data = await response.json()
        expect(data.error).toBe('One or more playlist IDs are invalid or not owned by the user')
    })

    it('should skip ownership verification if arrays are empty and call RPC directly', async () => {
        const request = createRequest({
            articleId: mockArticleId,
            addToPlaylistIds: [],
            removeFromPlaylistIds: [],
        })

        const response = await POST(request)
        expect(response.status).toBe(200)

        // Verify supabase.from('playlists') was NOT called
        expect(supabase.from).not.toHaveBeenCalled()

        // Verify RPC was called
        expect(supabase.rpc).toHaveBeenCalledWith('bulk_update_playlist_items', {
            article_id_param: actualArticleId,
            add_playlist_ids: [],
            remove_playlist_ids: [],
        })
    })

    it('should successfully update playlists when user owns all playlists', async () => {
        // User provides 3 unique playlists: ['playlist-1', 'playlist-2', 'playlist-3']
        const { mockSelect, mockIn, mockEq } = mockSupabaseFrom(3)

        const request = createRequest({
            articleId: mockArticleId,
            addToPlaylistIds: ['playlist-1'],
            removeFromPlaylistIds: ['playlist-2', 'playlist-3'],
        })

        const response = await POST(request)
        expect(response.status).toBe(200)

        // Validate supabase.from() call args
        expect(supabase.from).toHaveBeenCalledWith('playlists')
        expect(mockSelect).toHaveBeenCalledWith('id', { count: 'exact' })
        expect(mockIn).toHaveBeenCalledWith('id', ['playlist-1', 'playlist-2', 'playlist-3'])
        expect(mockEq).toHaveBeenCalledWith('owner_email', mockUserEmail)

        const data = await response.json()
        expect(data.message).toBe('Bulk update completed')
        expect(data.addedCount).toBe(1)
        expect(data.removedCount).toBe(1)

        // Verify proper RPC call
        expect(supabase.rpc).toHaveBeenCalledWith('bulk_update_playlist_items', {
            article_id_param: actualArticleId,
            add_playlist_ids: ['playlist-1'],
            remove_playlist_ids: ['playlist-2', 'playlist-3'],
        })
    })

    it('should handle duplicate playlist IDs in the request body correctly', async () => {
        // Request has duplicates, but the unique Set will be length 2
        const { mockSelect, mockIn, mockEq } = mockSupabaseFrom(2)

        const request = createRequest({
            articleId: mockArticleId,
            addToPlaylistIds: ['playlist-1', 'playlist-1'],
            removeFromPlaylistIds: ['playlist-2', 'playlist-2'],
        })

        const response = await POST(request)
        expect(response.status).toBe(200)

        // Validate that duplicates were removed before calling supabase
        expect(mockIn).toHaveBeenCalledWith('id', ['playlist-1', 'playlist-2'])

        // Verify proper RPC call (array values are passed exactly as provided to RPC, let DB handle duplicates if needed)
        expect(supabase.rpc).toHaveBeenCalledWith('bulk_update_playlist_items', {
            article_id_param: actualArticleId,
            add_playlist_ids: ['playlist-1', 'playlist-1'],
            remove_playlist_ids: ['playlist-2', 'playlist-2'],
        })
    })

    it('should return 500 if RPC call fails', async () => {
        // Setup ownership check to pass
        mockSupabaseFrom(2)

        ;(supabase.rpc as jest.Mock).mockResolvedValue({
            data: null,
            error: new Error('RPC Error'),
        })

        const request = createRequest({
            articleId: mockArticleId,
            addToPlaylistIds: ['playlist-1'],
            removeFromPlaylistIds: ['playlist-2'],
        })

        const response = await POST(request)
        expect(response.status).toBe(500)

        const data = await response.json()
        expect(data.error).toBe('Bulk update failed')
    })

    it('should handle RPC call returning null data successfully', async () => {
        // Setup ownership check to pass
        mockSupabaseFrom(2)

        ;(supabase.rpc as jest.Mock).mockResolvedValue({
            data: null, // rpc returning null but no error
            error: null,
        })

        const request = createRequest({
            articleId: mockArticleId,
            addToPlaylistIds: ['playlist-1'],
            removeFromPlaylistIds: ['playlist-2'],
        })

        const response = await POST(request)
        expect(response.status).toBe(200)

        const data = await response.json()
        expect(data.addedCount).toBe(0)
        expect(data.removedCount).toBe(0)
    })

    it('uses local fallback in test auth mode even with Supabase config', async () => {
        process.env.AUTH_ENV = 'test'

        ;(supabaseLocal.getPlaylistsForOwner as jest.Mock).mockResolvedValue([
            { id: 'playlist-1', owner_email: mockUserEmail },
            { id: 'playlist-2', owner_email: mockUserEmail },
        ])
        ;(supabaseLocal.addPlaylistItem as jest.Mock).mockResolvedValue({
            id: 'item-new',
            playlist_id: 'playlist-1',
            article_id: mockArticleId,
        })
        ;(supabaseLocal.getPlaylistWithItems as jest.Mock).mockResolvedValue({
            playlist_items: [{ id: 'item-old', article_id: mockArticleId }],
        })
        ;(supabaseLocal.removePlaylistItem as jest.Mock).mockResolvedValue(true)

        const request = createRequest({
            articleId: mockArticleId,
            addToPlaylistIds: ['playlist-1'],
            removeFromPlaylistIds: ['playlist-2'],
        })

        const response = await POST(request)
        expect(response.status).toBe(200)

        const data = await response.json()
        expect(data).toMatchObject({
            message: 'Bulk update completed',
            addedCount: 1,
            removedCount: 1,
        })
        expect(resolveArticleId).not.toHaveBeenCalled()
        expect(supabase.rpc).not.toHaveBeenCalled()
        expect(supabaseLocal.addPlaylistItem).toHaveBeenCalledWith('playlist-1', mockArticleId)
        expect(supabaseLocal.removePlaylistItem).toHaveBeenCalledWith('playlist-2', 'item-old')
    })

    it('should return 500 for generic unhandled exceptions', async () => {
        // Force an unhandled exception by making body parsing throw
        const request = new Request('http://localhost/api/playlists/bulk_update', {
            method: 'POST',
            body: '{invalid-json}', // Will throw on request.json()
        })

        const response = await POST(request)
        expect(response.status).toBe(500)

        const data = await response.json()
        expect(data.error).toBe('Internal server error')
    })
})
