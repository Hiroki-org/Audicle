import { GET } from '../route'
import { requireAuth } from '@/lib/api-auth'
import { resolveArticleId } from '@/lib/api-helpers'
import { supabase } from '@/lib/supabase'
import * as supabaseLocal from '@/lib/supabaseLocal'

jest.mock('@/lib/api-auth', () => ({
    requireAuth: jest.fn(),
}))

jest.mock('@/lib/api-helpers', () => ({
    resolveArticleId: jest.fn(),
}))

jest.mock('@/lib/supabase', () => ({
    supabase: {
        from: jest.fn(),
    },
}))

jest.mock('@/lib/supabaseLocal', () => ({
    getPlaylistsForOwner: jest.fn(),
    resolveArticleId: jest.fn(),
}))

describe('GET /api/articles/[id]/playlists', () => {
    const userEmail = 'test@example.com'
    const articleHash = 'hash-1'
    const actualArticleId = 'article-uuid'

    beforeEach(() => {
        jest.clearAllMocks()
        process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321'
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'
        delete process.env.AUTH_ENV
        delete process.env.NEXT_PUBLIC_AUTH_ENV

        ;(requireAuth as jest.Mock).mockResolvedValue({ userEmail, response: null })
        ;(resolveArticleId as jest.Mock).mockResolvedValue(actualArticleId)
        ;(supabaseLocal.resolveArticleId as jest.Mock).mockResolvedValue(actualArticleId)
    })

    afterEach(() => {
        delete process.env.NEXT_PUBLIC_SUPABASE_URL
        delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
        delete process.env.AUTH_ENV
        delete process.env.NEXT_PUBLIC_AUTH_ENV
    })

    it('uses local article hash resolution in test auth mode even with Supabase config', async () => {
        process.env.AUTH_ENV = 'test'
        ;(supabaseLocal.getPlaylistsForOwner as jest.Mock).mockResolvedValue([
            {
                id: 'playlist-1',
                name: 'Containing playlist',
                playlist_items: [{ id: 'item-1', article_id: actualArticleId }],
                items: [],
            },
            {
                id: 'playlist-2',
                name: 'Other playlist',
                playlist_items: [{ id: 'item-2', article_id: 'other-article' }],
                items: [],
            },
        ])

        const response = await GET(new Request('http://localhost/api/articles/hash-1/playlists'), {
            params: Promise.resolve({ id: articleHash }),
        })

        expect(response.status).toBe(200)
        await expect(response.json()).resolves.toEqual([
            { id: 'playlist-1', name: 'Containing playlist' },
        ])
        expect(supabaseLocal.resolveArticleId).toHaveBeenCalledWith(userEmail, articleHash)
        expect(resolveArticleId).not.toHaveBeenCalled()
        expect(supabase.from).not.toHaveBeenCalled()
    })

    it('returns 404 when local article hash resolution fails', async () => {
        process.env.AUTH_ENV = 'test'
        ;(supabaseLocal.resolveArticleId as jest.Mock).mockRejectedValue(new Error('Article stats not found'))

        const response = await GET(new Request('http://localhost/api/articles/missing/playlists'), {
            params: Promise.resolve({ id: 'missing' }),
        })

        expect(response.status).toBe(404)
        await expect(response.json()).resolves.toEqual({ error: 'Article stats not found' })
        expect(supabaseLocal.getPlaylistsForOwner).not.toHaveBeenCalled()
    })
})
