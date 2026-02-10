// 簡易版テスト（MSWなし）
jest.mock('@/lib/api-auth', () => ({
    requireAuth: jest.fn(async (handler) => handler),
    getUserEmailFromRequest: jest.fn(() => Promise.resolve('test@example.com'))
}))

// SSRFチェックとfetchをモック
jest.mock('@/lib/ssrf', () => ({
    isSafeUrl: jest.fn().mockResolvedValue(true),
    safeFetch: jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: { get: () => null },
        text: () => Promise.resolve('<html><body><p>Test content</p></body></html>'),
        body: { cancel: jest.fn() }
    })
}))

import * as routeModule from '../route'
import { safeFetch, isSafeUrl } from '@/lib/ssrf'

describe('/api/extract route', () => {
    beforeEach(() => {
        // Reset fetch mock before each test
        (safeFetch as jest.Mock).mockReset();
        // Set default success response
        (safeFetch as jest.Mock).mockResolvedValue({
            ok: true,
            status: 200,
            headers: { get: () => null },
            text: () => Promise.resolve('<html><body><p>Test content</p></body></html>'),
            body: { cancel: jest.fn() }
        });
        (isSafeUrl as jest.Mock).mockResolvedValue(true);
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
        expect(safeFetch).toHaveBeenCalledWith('https://example.com', expect.any(Object))
    })

    it('returns 401 with Japanese error message for 401 Unauthorized response', async () => {
        (safeFetch as jest.Mock).mockResolvedValueOnce({
            ok: false,
            status: 401,
            statusText: 'Unauthorized',
            headers: { get: () => null },
            text: () => Promise.resolve('Unauthorized'),
            body: { cancel: jest.fn() }
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
        (safeFetch as jest.Mock).mockResolvedValueOnce({
            ok: false,
            status: 403,
            statusText: 'Forbidden',
            headers: { get: () => null },
            text: () => Promise.resolve('Forbidden'),
            body: { cancel: jest.fn() }
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

    it('returns 403 when SSRF check fails (isSafeUrl false)', async () => {
        (isSafeUrl as jest.Mock).mockResolvedValueOnce(false);

        const mockRequest = new Request('http://localhost:3000/api/extract', {
            method: 'POST',
            body: JSON.stringify({ url: 'http://internal-server/' }),
            headers: { 'Content-Type': 'application/json' }
        });

        const res = await routeModule.POST(mockRequest);
        expect(res.status).toBe(403);
        const body = await res.json();
        expect(body.error).toContain('restricted');
    })
})
