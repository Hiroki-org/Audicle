/** @jest-environment node */
// 簡易版テスト（MSWなし）
jest.mock('@/lib/api-auth', () => ({
    requireAuth: jest.fn(async (handler) => handler),
    getUserEmailFromRequest: jest.fn(() => Promise.resolve('test@example.com'))
}))

// SSRFチェックをモック（常に許可）
jest.mock('@/lib/ssrf', () => ({
    validateAndResolveUrl: jest.fn().mockResolvedValue({ isSafe: true, ipAddress: '127.0.0.1', family: 4 })
}))

// fetchをモック
global.fetch = jest.fn(() =>
    Promise.resolve({
        ok: true,
        text: () => Promise.resolve('<html><body><p>Test content</p></body></html>')
    })
) as jest.Mock

import * as routeModule from '../route'

describe('/api/extract route', () => {
    beforeEach(() => {
        // Reset fetch mock before each test
        (global.fetch as jest.Mock).mockReset()
    })

    it('returns 400 for missing url', async () => {
        const mockRequest = new Request('http://localhost:3000/api/extract', {
            method: 'POST',
            body: JSON.stringify({}),
            headers: { 'Content-Type': 'application/json' }
        })
        const res = await routeModule.POST(mockRequest)
        expect(res.status).toBe(400)
    })

    it('returns 200 and extracted content for valid url', async () => {
        (global.fetch as jest.Mock).mockResolvedValueOnce({
            ok: true,
            status: 200,
            text: () => Promise.resolve('<html><body><p>Test content</p></body></html>')
        })

        const mockRequest = new Request('http://localhost:3000/api/extract', {
            method: 'POST',
            body: JSON.stringify({ url: 'https://example.com' }),
            headers: { 'Content-Type': 'application/json' }
        })
        const res = await routeModule.POST(mockRequest)
        expect(res.status).toBe(200)
        const body = await res.json()
        expect(body).toHaveProperty('content')
        expect(body.content).toContain('Test content')
    })

    it('returns 401 with Japanese error message for 401 Unauthorized response', async () => {
        (global.fetch as jest.Mock).mockResolvedValueOnce({
            ok: false,
            status: 401,
            statusText: 'Unauthorized'
        })

        const mockRequest = new Request('http://localhost:3000/api/extract', {
            method: 'POST',
            body: JSON.stringify({ url: 'https://auth-required-site.com' }),
            headers: { 'Content-Type': 'application/json' }
        })
        const res = await routeModule.POST(mockRequest)
        expect(res.status).toBe(401)
        const body = await res.json()
        expect(body.error).toBe('このURLは認証が必要なサイトです。ログインが必要なページは読み込めません。')
    })

    it('returns 403 with Japanese error message for 403 Forbidden response', async () => {
        (global.fetch as jest.Mock).mockResolvedValueOnce({
            ok: false,
            status: 403,
            statusText: 'Forbidden'
        })

        const mockRequest = new Request('http://localhost:3000/api/extract', {
            method: 'POST',
            body: JSON.stringify({ url: 'https://forbidden-site.com' }),
            headers: { 'Content-Type': 'application/json' }
        })
        const res = await routeModule.POST(mockRequest)
        expect(res.status).toBe(403)
        const body = await res.json()
        expect(body.error).toBe('このURLは認証が必要なサイトです。ログインが必要なページは読み込めません。')
    })

    it('returns 403 when SSRF check fails (validateAndResolveUrl false)', async () => {
        (jest.requireMock('@/lib/ssrf').validateAndResolveUrl as jest.Mock).mockResolvedValueOnce({ isSafe: false })

        const mockRequest = new Request('http://localhost:3000/api/extract', {
            method: 'POST',
            body: JSON.stringify({ url: 'http://internal-server/' }),
            headers: { 'Content-Type': 'application/json' }
        })

        const res = await routeModule.POST(mockRequest)
        expect(res.status).toBe(403)
        const body = await res.json()
        expect(body.error).toContain('restricted')
    })

    it('returns 403 when redirect target fails SSRF validation', async () => {
        (jest.requireMock('@/lib/ssrf').validateAndResolveUrl as jest.Mock).mockResolvedValueOnce({ isSafe: true, ipAddress: '127.0.0.1', family: 4 });
        (jest.requireMock('@/lib/ssrf').validateAndResolveUrl as jest.Mock).mockResolvedValueOnce({ isSafe: false });

        (global.fetch as jest.Mock).mockResolvedValueOnce({
            ok: false,
            status: 302,
            statusText: 'Found',
            headers: { get: jest.fn().mockReturnValue('http://internal-server/') },
            body: { cancel: jest.fn() }
        })

        const mockRequest = new Request('http://localhost:3000/api/extract', {
            method: 'POST',
            body: JSON.stringify({ url: 'https://example.com' }),
            headers: { 'Content-Type': 'application/json' }
        })

        const res = await routeModule.POST(mockRequest)
        expect(res.status).toBe(403)
        const body = await res.json()
        expect(body.error).toContain('redirect URL')
    })
})
