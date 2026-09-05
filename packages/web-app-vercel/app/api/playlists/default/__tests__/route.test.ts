// @/lib/playlist-utils モックを最初に定義
jest.mock('@/lib/playlist-utils', () => ({
    getOrCreateDefaultPlaylist: jest.fn()
}))

// 他のモック
jest.mock('@/lib/api-auth', () => ({
    requireAuth: jest.fn()
}))

import { NextResponse } from 'next/server'
import * as routeModule from '../route'
import { requireAuth } from '@/lib/api-auth'
import { getOrCreateDefaultPlaylist } from '@/lib/playlist-utils'

describe('/api/playlists/default route', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        // モックのデフォルト動作
        ;(requireAuth as jest.Mock).mockResolvedValue({
            userEmail: 'test@example.com',
            response: null
        })
    })

    it('returns 401 if not authenticated (requireAuth returns response)', async () => {
        const mockAuthResponse = NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        ;(requireAuth as jest.Mock).mockResolvedValue({
            userEmail: null,
            response: mockAuthResponse
        })

        const res = await routeModule.GET()
        expect(res.status).toBe(401)
        const data = await res.json()
        expect(data).toHaveProperty('error', 'Unauthorized')
        expect(getOrCreateDefaultPlaylist).not.toHaveBeenCalled()
    })

    it('returns 200 with playlist data on success', async () => {
        const mockPlaylist = { id: 'p1', name: 'Default', items: [] }
        ;(getOrCreateDefaultPlaylist as jest.Mock).mockResolvedValue({
            playlist: mockPlaylist,
            error: undefined
        })

        const res = await routeModule.GET()
        expect(res.status).toBe(200)
        const data = await res.json()
        expect(data).toMatchObject(mockPlaylist)
        expect(getOrCreateDefaultPlaylist).toHaveBeenCalledWith('test@example.com')
    })

    it('returns 500 when getOrCreateDefaultPlaylist returns an error', async () => {
        ;(getOrCreateDefaultPlaylist as jest.Mock).mockResolvedValue({
            playlist: undefined,
            error: 'Failed to find default playlist'
        })

        const res = await routeModule.GET()
        expect(res.status).toBe(500)
        const data = await res.json()
        expect(data).toHaveProperty('error', 'Failed to find default playlist')
    })

    it('returns 500 when getOrCreateDefaultPlaylist returns no playlist and no error', async () => {
        ;(getOrCreateDefaultPlaylist as jest.Mock).mockResolvedValue({
            playlist: undefined,
            error: undefined
        })

        const res = await routeModule.GET()
        expect(res.status).toBe(500)
        const data = await res.json()
        expect(data).toHaveProperty('error', 'Failed to get default playlist')
    })

    it('returns 500 on unexpected exceptions and logs error', async () => {
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
        ;(getOrCreateDefaultPlaylist as jest.Mock).mockRejectedValue(new Error('Unexpected Database Error'))

        const res = await routeModule.GET()
        expect(res.status).toBe(500)
        const data = await res.json()
        expect(data).toHaveProperty('error', 'Internal server error')

        expect(consoleErrorSpy).toHaveBeenCalled()
        consoleErrorSpy.mockRestore()
    })
})
