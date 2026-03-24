import { NextResponse } from 'next/server'
import { POST } from '../route'
import { requireAuth } from '@/lib/api-auth'
import { resolveArticleId } from '@/lib/api-helpers'
import { supabase } from '@/lib/supabase'

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

describe('POST /api/playlists/bulk_update', () => {
    const mockUserEmail = 'test@example.com'
    const mockArticleId = 'test-article-id'
    const actualArticleId = 'resolved-article-id'

    beforeEach(() => {
        jest.clearAllMocks()

        // Default mock implementations
        ;(requireAuth as jest.Mock).mockResolvedValue({ userEmail: mockUserEmail, response: null })
        ;(resolveArticleId as jest.Mock).mockResolvedValue(actualArticleId)

        const mockSelect = jest.fn().mockReturnThis()
        const mockIn = jest.fn().mockReturnThis()
        const mockEq = jest.fn().mockResolvedValue({ count: 2, error: null })

        ;(supabase.from as jest.Mock).mockReturnValue({
            select: mockSelect,
            in: mockIn,
            eq: mockEq,
        })

        ;(supabase.rpc as jest.Mock).mockResolvedValue({
            data: [{ added_count: 1, removed_count: 1 }],
            error: null,
        })
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
        const mockEq = jest.fn().mockResolvedValue({ count: null, error: new Error('DB Error') })
        ;(supabase.from as jest.Mock).mockReturnValue({
            select: jest.fn().mockReturnThis(),
            in: jest.fn().mockReturnThis(),
            eq: mockEq,
        })

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
        // Return count=1 when expecting 2 (1 to add, 1 to remove)
        const mockEq = jest.fn().mockResolvedValue({ count: 1, error: null })
        ;(supabase.from as jest.Mock).mockReturnValue({
            select: jest.fn().mockReturnThis(),
            in: jest.fn().mockReturnThis(),
            eq: mockEq,
        })

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

    it('should return 500 if RPC call fails', async () => {
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

    it('should successfully update playlists and return counts', async () => {
        const request = createRequest({
            articleId: mockArticleId,
            addToPlaylistIds: ['playlist-1'],
            removeFromPlaylistIds: ['playlist-2', 'playlist-3'],
        })

        // 3 unique playlists expected
        const mockEq = jest.fn().mockResolvedValue({ count: 3, error: null })
        ;(supabase.from as jest.Mock).mockReturnValue({
            select: jest.fn().mockReturnThis(),
            in: jest.fn().mockReturnThis(),
            eq: mockEq,
        })

        const response = await POST(request)
        expect(response.status).toBe(200)

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
