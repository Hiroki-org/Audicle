import { NextRequest, NextResponse } from 'next/server'
import { GET, POST } from '../route'
import { validateUrl } from '@/lib/validation'

// モックを定義
jest.mock('@/lib/auth', () => ({
    auth: jest.fn(),
}))

jest.mock('@/lib/supabase', () => ({
    supabase: {
        from: jest.fn(),
        rpc: jest.fn(),
    },
}))

jest.mock('@/lib/supabaseLocal', () => ({
    upsertArticle: jest.fn(),
    addPlaylistItem: jest.fn(),
}))

jest.mock('@/lib/playlist-utils', () => ({
    getOrCreateDefaultPlaylist: jest.fn(),
}))

import { auth } from '@/lib/auth'
import { getOrCreateDefaultPlaylist } from '@/lib/playlist-utils'
import * as supabaseLocal from '@/lib/supabaseLocal'
import { supabase } from '@/lib/supabase'

describe('Share Target Route Handlers', () => {
    const mockAuth = auth as jest.MockedFunction<typeof auth>
    const mockGetOrCreateDefaultPlaylist = getOrCreateDefaultPlaylist as jest.MockedFunction<
        typeof getOrCreateDefaultPlaylist
    >

    beforeEach(() => {
        jest.clearAllMocks()
        delete process.env.NEXT_PUBLIC_SUPABASE_URL
    })

    describe('GET handler', () => {
        it('URLパラメータがない場合はホームにリダイレクト', async () => {
            const request = new NextRequest('http://localhost:3000/share-target')

            const response = await GET(request)

            expect(response.status).toBe(307)
            expect(response.headers.get('Location')).toBe('http://localhost:3000/')
        })

        it('無効なURLスキームの場合はエラーページにリダイレクト', async () => {
            const request = new NextRequest(
                'http://localhost:3000/share-target?url=javascript:alert(1)'
            )

            const response = await GET(request)

            expect(response.status).toBe(307)
            expect(response.headers.get('Location')).toContain('/share-target/error')
        })

        it('未ログインの場合はログインページにリダイレクト', async () => {
            mockAuth.mockResolvedValue(null)

            const request = new NextRequest(
                'http://localhost:3000/share-target?url=https://example.com'
            )

            const response = await GET(request)

            expect(response.status).toBe(307)
            expect(response.headers.get('Location')).toContain('/auth/signin')
        })

        it('ログイン済みで記事を追加成功（ローカルモード）', async () => {
            mockAuth.mockResolvedValue({
                user: { id: 'test-user', email: 'test@example.com' },
                expires: '2025-12-31',
            })

            mockGetOrCreateDefaultPlaylist.mockResolvedValue({
                playlist: {
                    id: 'playlist-1',
                    owner_email: 'test@example.com',
                    name: '読み込んだ記事',
                    visibility: 'private',
                    is_default: true,
                    allow_fork: true,
                    created_at: '2025-01-01T00:00:00Z',
                    updated_at: '2025-01-01T00:00:00Z',
                    items: [],
                    item_count: 0,
                },
            })

            const mockUpsertArticle = supabaseLocal.upsertArticle as jest.MockedFunction<
                typeof supabaseLocal.upsertArticle
            >
            mockUpsertArticle.mockResolvedValue({
                id: 'article-1',
                owner_email: 'test@example.com',
                url: 'https://example.com/article',
                title: 'Test Article',
                created_at: '2025-01-01T00:00:00Z',
                updated_at: '2025-01-01T00:00:00Z',
                last_read_position: 0,
            })

            const mockAddPlaylistItem = supabaseLocal.addPlaylistItem as jest.MockedFunction<
                typeof supabaseLocal.addPlaylistItem
            >
            mockAddPlaylistItem.mockResolvedValue({
                id: 'item-1',
                playlist_id: 'playlist-1',
                article_id: 'article-1',
                position: 0,
                added_at: '2025-01-01T00:00:00Z',
            })

            const request = new NextRequest(
                'http://localhost:3000/share-target?url=https://example.com/article&title=Test Article'
            )

            const response = await GET(request)

            expect(response.status).toBe(307)
            expect(response.headers.get('Location')).toContain('/share-target/success')
            expect(mockAuth).toHaveBeenCalled()
            expect(mockGetOrCreateDefaultPlaylist).toHaveBeenCalledWith('test@example.com')
            expect(mockUpsertArticle).toHaveBeenCalledWith(
                'test@example.com',
                'https://example.com/article',
                'Test Article',
                undefined,
                0
            )
        })
    })

    describe('POST handler', () => {
        it('formDataがない場合はホームにリダイレクト', async () => {
            const formData = new FormData()
            const request = new NextRequest('http://localhost:3000/share-target', {
                method: 'POST',
                body: formData,
            })

            const response = await POST(request)

            expect(response.status).toBe(307)
            expect(response.headers.get('Location')).toBe('http://localhost:3000/')
        })

        it('無効なURLスキームの場合はエラーページにリダイレクト', async () => {
            const formData = new FormData()
            formData.append('url', 'data:text/html,<script>alert(1)</script>')

            const request = new NextRequest('http://localhost:3000/share-target', {
                method: 'POST',
                body: formData,
            })

            const response = await POST(request)

            expect(response.status).toBe(307)
            expect(response.headers.get('Location')).toContain('/share-target/error')
        })

        it('未ログインの場合はログインページにリダイレクト', async () => {
            mockAuth.mockResolvedValue(null)

            const formData = new FormData()
            formData.append('url', 'https://example.com')

            const request = new NextRequest('http://localhost:3000/share-target', {
                method: 'POST',
                body: formData,
            })

            const response = await POST(request)

            expect(response.status).toBe(307)
            expect(response.headers.get('Location')).toContain('/auth/signin')
        })

        it('ログイン済みで記事を追加成功（ローカルモード）', async () => {
            mockAuth.mockResolvedValue({
                user: { id: 'test-user', email: 'test@example.com' },
                expires: '2025-12-31',
            })

            mockGetOrCreateDefaultPlaylist.mockResolvedValue({
                playlist: {
                    id: 'playlist-1',
                    owner_email: 'test@example.com',
                    name: '読み込んだ記事',
                    visibility: 'private',
                    is_default: true,
                    allow_fork: true,
                    created_at: '2025-01-01T00:00:00Z',
                    updated_at: '2025-01-01T00:00:00Z',
                    items: [],
                    item_count: 0,
                },
            })

            const mockUpsertArticle = supabaseLocal.upsertArticle as jest.MockedFunction<
                typeof supabaseLocal.upsertArticle
            >
            mockUpsertArticle.mockResolvedValue({
                id: 'article-1',
                owner_email: 'test@example.com',
                url: 'https://example.com/article',
                title: 'Test Article',
                created_at: '2025-01-01T00:00:00Z',
                updated_at: '2025-01-01T00:00:00Z',
                last_read_position: 0,
            })

            const mockAddPlaylistItem = supabaseLocal.addPlaylistItem as jest.MockedFunction<
                typeof supabaseLocal.addPlaylistItem
            >
            mockAddPlaylistItem.mockResolvedValue({
                id: 'item-1',
                playlist_id: 'playlist-1',
                article_id: 'article-1',
                position: 0,
                added_at: '2025-01-01T00:00:00Z',
            })

            const formData = new FormData()
            formData.append('url', 'https://example.com/article')
            formData.append('title', 'Test Article')

            const request = new NextRequest('http://localhost:3000/share-target', {
                method: 'POST',
                body: formData,
            })

            const response = await POST(request)

            expect(response.status).toBe(307)
            expect(response.headers.get('Location')).toContain('/share-target/success')
            expect(mockAuth).toHaveBeenCalled()
            expect(mockGetOrCreateDefaultPlaylist).toHaveBeenCalledWith('test@example.com')
        })

        it('デフォルトプレイリスト取得失敗時はエラーページにリダイレクト', async () => {
            mockAuth.mockResolvedValue({
                user: { id: 'test-user', email: 'test@example.com' },
                expires: '2025-12-31',
            })

            mockGetOrCreateDefaultPlaylist.mockResolvedValue({
                error: 'Failed to create default playlist',
            })

            const formData = new FormData()
            formData.append('url', 'https://example.com/article')

            const request = new NextRequest('http://localhost:3000/share-target', {
                method: 'POST',
                body: formData,
            })

            const response = await POST(request)

            expect(response.status).toBe(307)
            expect(response.headers.get('Location')).toContain('/share-target/error')
        })
    })


    describe('Supabase (Remote) Error Paths', () => {
        beforeEach(() => {
            process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';

            mockAuth.mockResolvedValue({
                user: { id: 'test-user', email: 'test@example.com' },
                expires: '2025-12-31',
            });

            mockGetOrCreateDefaultPlaylist.mockResolvedValue({
                playlist: {
                    id: 'playlist-1',
                    owner_email: 'test@example.com',
                    name: '読み込んだ記事',
                    visibility: 'private',
                    is_default: true,
                    allow_fork: true,
                    created_at: '2025-01-01T00:00:00Z',
                    updated_at: '2025-01-01T00:00:00Z',
                    items: [],
                    item_count: 0,
                },
            });
        });

        it('記事の検索に失敗した場合はエラーページにリダイレクト', async () => {
            (supabase.from as jest.Mock).mockReturnValue({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({ data: null, error: { message: 'Search error' } })
            });

            const request = new NextRequest('http://localhost:3000/share-target?url=https://example.com/article');
            const response = await GET(request);

            expect(response.status).toBe(307);
            expect(response.headers.get('Location')).toContain('/share-target/error');
        });

        it('既存の記事のタイトル更新に失敗した場合はエラーページにリダイレクト', async () => {
            const mockSelectSingle = jest.fn().mockResolvedValue({ data: null, error: { message: 'Update error' } });

            (supabase.from as jest.Mock).mockImplementation((table) => {
                if (table === 'articles') {
                    return {
                        select: jest.fn().mockReturnThis(),
                        eq: jest.fn().mockReturnThis(),
                        update: jest.fn().mockReturnThis(),
                        maybeSingle: jest.fn().mockResolvedValueOnce({
                            data: { id: 'article-1', title: 'Old Title', url: 'https://example.com/article' },
                            error: null
                        }),
                        single: mockSelectSingle
                    };
                }
            });

            const request = new NextRequest('http://localhost:3000/share-target?url=https://example.com/article&title=New Title');
            const response = await GET(request);

            expect(response.status).toBe(307);
            expect(response.headers.get('Location')).toContain('/share-target/error');
        });

        it('新規記事の作成に失敗した場合はエラーページにリダイレクト', async () => {
            const mockInsertSingle = jest.fn().mockResolvedValue({ data: null, error: { message: 'Insert error' } });

            (supabase.from as jest.Mock).mockImplementation((table) => {
                if (table === 'articles') {
                    return {
                        select: jest.fn().mockReturnThis(),
                        eq: jest.fn().mockReturnThis(),
                        insert: jest.fn().mockReturnThis(),
                        maybeSingle: jest.fn().mockResolvedValueOnce({ data: null, error: null }),
                        single: mockInsertSingle
                    };
                }
            });

            const request = new NextRequest('http://localhost:3000/share-target?url=https://example.com/article');
            const response = await GET(request);

            expect(response.status).toBe(307);
            expect(response.headers.get('Location')).toContain('/share-target/error');
        });

        it('プレイリストへの追加(RPC)に失敗した場合はエラーページにリダイレクト', async () => {
            (supabase.from as jest.Mock).mockImplementation((table) => {
                if (table === 'articles') {
                    return {
                        select: jest.fn().mockReturnThis(),
                        eq: jest.fn().mockReturnThis(),
                        maybeSingle: jest.fn().mockResolvedValueOnce({
                            data: { id: 'article-1', title: 'Test Title', url: 'https://example.com/article' },
                            error: null
                        }),
                    };
                }
            });

            (supabase.rpc as jest.Mock).mockReturnValue({
                single: jest.fn().mockResolvedValue({ data: null, error: { message: 'RPC error' } })
            });

            const request = new NextRequest('http://localhost:3000/share-target?url=https://example.com/article');
            const response = await GET(request);

            expect(response.status).toBe(307);
            expect(response.headers.get('Location')).toContain('/share-target/error');
        });

        it('予期せぬエラーが発生した場合はエラーページにリダイレクト', async () => {
            mockGetOrCreateDefaultPlaylist.mockRejectedValueOnce(new Error('Unexpected system error'));

            const request = new NextRequest('http://localhost:3000/share-target?url=https://example.com/article');
            const response = await GET(request);

            expect(response.status).toBe(307);
            expect(response.headers.get('Location')).toContain('/share-target/error');
        });
    });

    describe('URL validation during GET request', () => {
        it('http:// スキームは許可される', async () => {
            mockAuth.mockResolvedValue({
                user: { id: 'test-user', email: 'test@example.com' },
                expires: '2025-12-31',
            })

            mockGetOrCreateDefaultPlaylist.mockResolvedValue({
                playlist: {
                    id: 'playlist-1',
                    owner_email: 'test@example.com',
                    name: '読み込んだ記事',
                    visibility: 'private',
                    is_default: true,
                    allow_fork: true,
                    created_at: '2025-01-01T00:00:00Z',
                    updated_at: '2025-01-01T00:00:00Z',
                    items: [],
                    item_count: 0,
                },
            })

            const mockUpsertArticle = supabaseLocal.upsertArticle as jest.MockedFunction<
                typeof supabaseLocal.upsertArticle
            >
            mockUpsertArticle.mockResolvedValue({
                id: 'article-1',
                owner_email: 'test@example.com',
                url: 'http://example.com',
                title: 'Test Article',
                created_at: '2025-01-01T00:00:00Z',
                updated_at: '2025-01-01T00:00:00Z',
                last_read_position: 0,
            })

            const request = new NextRequest('http://localhost:3000/share-target?url=http://example.com')

            const response = await GET(request)

            expect(response.status).toBe(307)
            expect(response.headers.get('Location')).toContain('/share-target/success')
        })

        it('javascript: スキームは拒否される', async () => {
            const request = new NextRequest(
                'http://localhost:3000/share-target?url=javascript:alert(1)'
            )

            const response = await GET(request)

            expect(response.status).toBe(307)
            expect(response.headers.get('Location')).toContain('/share-target/error')
        })

        it('data: スキームは拒否される', async () => {
            const request = new NextRequest(
                'http://localhost:3000/share-target?url=data:text/html,<h1>test</h1>'
            )

            const response = await GET(request)

            expect(response.status).toBe(307)
            expect(response.headers.get('Location')).toContain('/share-target/error')
        })
    })

    describe('validateUrl function', () => {
        it('http URL は true を返す', () => {
            expect(validateUrl('http://example.com')).toBe(true)
        })

        it('https URL は true を返す', () => {
            expect(validateUrl('https://example.com/path?query=1#hash')).toBe(true)
        })

        it('URL形式が不正な場合は false を返す', () => {
            expect(validateUrl('not-a-url')).toBe(false)
        })

        it('javascript スキームは false を返す', () => {
            expect(validateUrl('javascript:alert(1)')).toBe(false)
        })

        it('data スキームは false を返す', () => {
            expect(validateUrl('data:text/html,<h1>test</h1>')).toBe(false)
        })

        it('ftp スキームは false を返す', () => {
            expect(validateUrl('ftp://example.com')).toBe(false)
        })

        it('file スキームは false を返す', () => {
            expect(validateUrl('file:///etc/passwd')).toBe(false)
        })

        it('空文字は false を返す', () => {
            expect(validateUrl('')).toBe(false)
        })

        // new URL() automatically trims spaces, so this returns true, which is acceptable
        it('前後スペース付きURLは new URL の仕様により true を返す', () => {
            expect(validateUrl(' https://example.com ')).toBe(true)
        })
    })
})
