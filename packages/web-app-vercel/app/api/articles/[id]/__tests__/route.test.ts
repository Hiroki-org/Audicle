import { NextResponse } from 'next/server'
import { GET } from '../route'
import { requireAuth } from '@/lib/api-auth'
import { supabase } from '@/lib/supabase'

jest.mock('@/lib/api-auth', () => ({
    requireAuth: jest.fn(),
}))

const mockEq = jest.fn()
const mockSingle = jest.fn()
const mockSelect = jest.fn()

jest.mock('@/lib/supabase', () => ({
    supabase: {
        from: jest.fn(),
    },
}))

describe('GET /api/articles/[id]', () => {
    const userEmail = 'test@example.com'
    const articleId = 'article-123'

    beforeEach(() => {
        jest.clearAllMocks()

        // Setup supabase mock chain
        mockEq.mockReturnValue({ eq: mockEq, single: mockSingle })
        mockSelect.mockReturnValue({ eq: mockEq })
        ;(supabase.from as jest.Mock).mockReturnValue({ select: mockSelect })
    })

    it('returns unauthorized response if requireAuth returns a response', async () => {
        const unauthorizedResponse = NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        ;(requireAuth as jest.Mock).mockResolvedValue({ userEmail: null, response: unauthorizedResponse })

        const request = new Request('http://localhost/api/articles/article-123')
        const context = { params: Promise.resolve({ id: articleId }) }

        const response = await GET(request, context)

        expect(response.status).toBe(401)
        const json = await response.json()
        expect(json).toEqual({ error: 'Unauthorized' })
        expect(supabase.from).not.toHaveBeenCalled()
    })

    it('returns 404 when article is not found in supabase', async () => {
        ;(requireAuth as jest.Mock).mockResolvedValue({ userEmail, response: null })
        mockSingle.mockResolvedValue({
            data: null,
            error: { code: 'PGRST116', message: 'Not found' }
        })

        const request = new Request('http://localhost/api/articles/article-123')
        const context = { params: Promise.resolve({ id: articleId }) }

        const response = await GET(request, context)

        expect(response.status).toBe(404)
        const json = await response.json()
        expect(json).toEqual({ error: 'Article not found' })

        expect(supabase.from).toHaveBeenCalledWith('articles')
        expect(mockSelect).toHaveBeenCalledWith('id, url, title, thumbnail_url, last_read_position')
        expect(mockEq).toHaveBeenCalledWith('id', articleId)
        expect(mockEq).toHaveBeenCalledWith('owner_email', userEmail)
    })

    it('returns 500 when there is a supabase error', async () => {
        ;(requireAuth as jest.Mock).mockResolvedValue({ userEmail, response: null })
        mockSingle.mockResolvedValue({
            data: null,
            error: { code: 'OTHER_ERROR', message: 'Database error' }
        })

        const request = new Request('http://localhost/api/articles/article-123')
        const context = { params: Promise.resolve({ id: articleId }) }

        const response = await GET(request, context)

        expect(response.status).toBe(500)
        const json = await response.json()
        expect(json).toEqual({ error: 'Failed to fetch article' })
    })

    it('returns article data when successfully fetched', async () => {
        ;(requireAuth as jest.Mock).mockResolvedValue({ userEmail, response: null })

        const mockArticle = {
            id: articleId,
            url: 'https://example.com',
            title: 'Test Article',
            thumbnail_url: 'https://example.com/thumb.jpg',
            last_read_position: 100
        }

        mockSingle.mockResolvedValue({
            data: mockArticle,
            error: null
        })

        const request = new Request('http://localhost/api/articles/article-123')
        const context = { params: Promise.resolve({ id: articleId }) }

        const response = await GET(request, context)

        expect(response.status).toBe(200)
        const json = await response.json()
        expect(json).toEqual(mockArticle)
    })

    it('returns 500 on internal server error', async () => {
        // Mock to throw an exception
        ;(requireAuth as jest.Mock).mockRejectedValue(new Error('Unexpected failure'))

        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

        const request = new Request('http://localhost/api/articles/article-123')
        const context = { params: Promise.resolve({ id: articleId }) }

        const response = await GET(request, context)

        expect(response.status).toBe(500)
        const json = await response.json()
        expect(json).toEqual({ error: 'Internal server error' })

        consoleSpy.mockRestore()
    })
})
