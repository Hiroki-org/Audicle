import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import * as supabaseLocal from '@/lib/supabaseLocal'
import { getOrCreateDefaultPlaylist } from '@/lib/playlist-utils'
import type { Article } from '@/types/playlist'

/**
 * 共有されたURLを検証する
 * @param url 検証対象のURL
 * @returns URLが有効な場合はtrue、無効な場合はfalse
 */
function validateUrl(url: string): boolean {
    try {
        const parsedUrl = new URL(url)
        // http/httpsスキームのみ許可（javascript:, data:などの危険なスキームを拒否）
        const allowedProtocols = ['http:', 'https:']
        return allowedProtocols.includes(parsedUrl.protocol)
    } catch {
        return false
    }
}

/**
 * GET リクエスト: 後方互換性のため（既存のブックマークなど）
 */
export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams
    const sharedUrl = searchParams.get('url')
    const sharedTitle = searchParams.get('title')

    // URLパラメータが存在しない場合はホームへリダイレクト
    if (!sharedUrl) {
        return NextResponse.redirect(new URL('/', request.url))
    }

    // URL検証
    if (!validateUrl(sharedUrl)) {
        console.error('Invalid URL scheme or format:', sharedUrl)
        return NextResponse.redirect(
            new URL(`/share-target/error?message=${encodeURIComponent('無効なURLです')}`, request.url)
        )
    }

    // 認証チェック
    const session = await auth()

    if (!session || !session.user?.email) {
        // 未ログインの場合はログインページへリダイレクト
        const returnUrl = `/share-target?url=${encodeURIComponent(sharedUrl)}${sharedTitle ? `&title=${encodeURIComponent(sharedTitle)}` : ''}`
        return NextResponse.redirect(
            new URL(`/auth/signin?callbackUrl=${encodeURIComponent(returnUrl)}`, request.url)
        )
    }

    // 処理を共有関数に委譲
    return await handleShareTarget(sharedUrl, sharedTitle, session.user.email, request.url)
}

/**
 * POST リクエスト: Web Share Target API からの共有（CSRF対策済み）
 */
export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData()
        const sharedUrl = formData.get('url') as string | null
        const sharedTitle = formData.get('title') as string | null

        // URLパラメータが存在しない場合はホームへリダイレクト
        if (!sharedUrl) {
            return NextResponse.redirect(new URL('/', request.url))
        }

        // URL検証
        if (!validateUrl(sharedUrl)) {
            console.error('Invalid URL scheme or format:', sharedUrl)
            return NextResponse.redirect(
                new URL(`/share-target/error?message=${encodeURIComponent('無効なURLです')}`, request.url)
            )
        }

        // 認証チェック
        const session = await auth()

        if (!session || !session.user?.email) {
            // 未ログインの場合はログインページへリダイレクト
            const returnUrl = `/share-target?url=${encodeURIComponent(sharedUrl)}${sharedTitle ? `&title=${encodeURIComponent(sharedTitle)}` : ''}`
            return NextResponse.redirect(
                new URL(`/auth/signin?callbackUrl=${encodeURIComponent(returnUrl)}`, request.url)
            )
        }

        // 処理を共有関数に委譲
        return await handleShareTarget(sharedUrl, sharedTitle, session.user.email, request.url)
    } catch (error) {
        console.error('Error parsing POST request:', error)
        return NextResponse.redirect(
            new URL(`/share-target/error?message=${encodeURIComponent('リクエストの処理に失敗しました')}`, request.url)
        )
    }
}

/**
 * 共有ターゲット処理の共通ロジック
 */
async function handleShareTarget(
    sharedUrl: string,
    sharedTitle: string | null,
    userEmail: string,
    baseUrl: string
): Promise<NextResponse> {

    try {
        // デフォルトプレイリストを取得または作成
        const defaultPlaylistResult = await getOrCreateDefaultPlaylist(userEmail)

        if (defaultPlaylistResult.error || !defaultPlaylistResult.playlist) {
            console.error('Failed to get default playlist:', defaultPlaylistResult.error)
            return NextResponse.redirect(
                new URL(`/share-target/error?message=${encodeURIComponent('プレイリストの取得に失敗しました')}`, baseUrl)
            )
        }

        const playlistId = defaultPlaylistResult.playlist.id

        // 記事を作成または既存のものを取得
        let article: Article | null = null

        if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
            // Local fallback
            article = await supabaseLocal.upsertArticle(
                userEmail,
                sharedUrl,
                sharedTitle || 'Shared Article',
                undefined,
                0
            )
        } else {
            // まず既存の記事を検索
            const { data: existingArticle, error: searchError } = await supabase
                .from('articles')
                .select()
                .eq('owner_email', userEmail)
                .eq('url', sharedUrl)
                .maybeSingle()

            if (searchError) {
                console.error('Error searching for existing article:', searchError)
                throw new Error('記事の検索に失敗しました')
            }

            if (existingArticle) {
                // 既存の記事があればタイトルを更新（共有時にタイトルが渡された場合）
                if (sharedTitle && sharedTitle !== existingArticle.title) {
                    const { data: updated, error: updateError } = await supabase
                        .from('articles')
                        .update({ title: sharedTitle })
                        .eq('id', existingArticle.id)
                        .select()
                        .single()

                    if (updateError) {
                        console.error('Error updating article title:', updateError)
                        throw new Error('記事タイトルの更新に失敗しました')
                    }
                    article = updated
                } else {
                    article = existingArticle
                }
            } else {
                // 新規作成
                const { data: created, error: createError } = await supabase
                    .from('articles')
                    .insert({
                        owner_email: userEmail,
                        url: sharedUrl,
                        title: sharedTitle || 'Shared Article',
                        last_read_position: 0,
                    })
                    .select()
                    .single()

                if (createError) {
                    console.error('Error creating article:', createError)
                    throw new Error('記事の作成に失敗しました')
                }
                article = created
            }
        }

        if (!article) {
            console.error('Failed to create or fetch article')
            return NextResponse.redirect(
                new URL(`/share-target/error?message=${encodeURIComponent('記事の追加に失敗しました')}`, baseUrl)
            )
        }

        // プレイリストに追加（既に存在する場合はスキップ）
        if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
            // Local fallback
            await supabaseLocal.addPlaylistItem(playlistId, article.id)
        } else {
            // RPC関数を使用してアトミックに追加（race condition対策）
            const { data: rpcResult, error: rpcError } = (await supabase
                .rpc('add_playlist_item_at_end', {
                    p_playlist_id: playlistId,
                    p_article_id: article.id,
                })
                .single()) as {
                    data: { item_position: number; already_exists: boolean } | null;
                    error: any;
                }

            if (rpcError) {
                console.error('Error calling add_playlist_item_at_end:', rpcError)
                throw new Error('プレイリストへの追加に失敗しました')
            }
        }
        // 成功：成功ページへリダイレクト

        const successUrl = new URL('/share-target/success', baseUrl)
        successUrl.searchParams.set('title', sharedTitle || article.title)
        return NextResponse.redirect(successUrl)

    } catch (error) {
        console.error('Error in share-target:', error)

        return NextResponse.redirect(
            new URL(`/share-target/error?message=${encodeURIComponent('記事の追加に失敗しました')}`, baseUrl)
        )
    }
}
