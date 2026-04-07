import { NextRequest, NextResponse } from 'next/server';
import { Readability } from '@mozilla/readability';
import { normalizeArticleText } from '@/lib/parseArticle';
import { parseHTML } from 'linkedom';
import { ExtractResponse } from '@/types/api';
import { validateAndResolveUrl } from '@/lib/ssrf';
import { Agent } from 'undici';

// Node.js runtimeを明示的に指定（JSDOMはEdge Runtimeで動作しない）
export const runtime = 'nodejs';
// 動的レンダリングを強制（キャッシュを無効化）
export const dynamic = 'force-dynamic';

function getLoggableUrl(urlString: string): string {
    try {
        return new URL(urlString).origin;
    } catch {
        return 'invalid-url';
    }
}

export async function OPTIONS() {
    return NextResponse.json({}, {
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        },
    });
}

export async function POST(request: NextRequest) {
    console.log('[Extract API] POST request received');

    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
    };

    try {
        const { url } = await request.json();
        console.log('[Extract API] Extracting content from:', getLoggableUrl(url));

        if (!url || typeof url !== 'string') {
            return NextResponse.json(
                { error: 'URL is required' },
                { status: 400, headers: corsHeaders }
            );
        }

        // URLのバリデーション
        try {
            new URL(url);
        } catch {
            return NextResponse.json(
                { error: 'Invalid URL format' },
                { status: 400, headers: corsHeaders }
            );
        }

        // SSRFチェック (initial check)
        const validatedUrl = await validateAndResolveUrl(url);
        if (!validatedUrl.isSafe || !validatedUrl.ipAddress) {
            console.warn('[Extract API] SSRF attempt blocked:', getLoggableUrl(url));
            return NextResponse.json(
                { error: 'Access to this URL is restricted for security reasons' },
                { status: 403, headers: corsHeaders }
            );
        }

        // HTMLを取得 (with secure redirect handling)
        const html = await fetchWithTimeout(url, validatedUrl.ipAddress, validatedUrl.family);

        // linkedomでパース
        const { document } = parseHTML(html);

        // Readabilityで本文抽出
        const article = new Readability(document).parse();

        if (!article) {
            return NextResponse.json(
                { error: 'Failed to extract content from URL' },
                { status: 422, headers: corsHeaders }
            );
        }

        // テキストコンテンツの取得（重複やUIテキスト混入を防ぐため normalizeArticleText を利用）
        const textContent = normalizeArticleText(article.content || '') || (article.textContent || '');

        const response: ExtractResponse = {
            title: article.title || '',
            content: article.content || textContent,
            textLength: textContent.length,
            author: article.byline || undefined,
            siteName: article.siteName || undefined,
        };

        console.log('[Extract API] Successfully extracted:', {
            title: response.title,
            textLength: response.textLength,
        });

        return NextResponse.json(response, {
            headers: corsHeaders,
        });
    } catch (error) {
        const corsHeaders = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        };

        if (error instanceof SyntaxError) {
            return NextResponse.json(
                { error: 'Invalid request body' },
                { status: 400, headers: corsHeaders }
            );
        }

        if (error instanceof TimeoutError) {
            return NextResponse.json(
                { error: 'Request timeout - URL took too long to fetch' },
                { status: 408, headers: corsHeaders }
            );
        }

        if (error instanceof AuthenticationRequiredError) {
            return NextResponse.json(
                { error: 'このURLは認証が必要なサイトです。ログインが必要なページは読み込めません。' },
                { status: error.statusCode, headers: corsHeaders }
            );
        }

        if (error instanceof SSRFBlockedError) {
            return NextResponse.json(
                { error: 'Access to the redirect URL is restricted for security reasons' },
                { status: 403, headers: corsHeaders }
            );
        }

        if (error instanceof TooManyRedirectsError) {
            return NextResponse.json(
                { error: 'Too many redirects' },
                { status: 400, headers: corsHeaders }
            );
        }

        console.error('Extract error:', error);
        return NextResponse.json(
            { error: 'Failed to extract content' },
            { status: 500, headers: corsHeaders }
        );
    }
}

/**
 * タイムアウト付きでURLをフェッチ
 * Vercelのサーバーレス関数は10秒制限があるため、8秒に設定
 *
 * NOTE: SSRF保護のため、リダイレクトは手動で処理し、ホップごとに `validateAndResolveUrl` をチェックします。
 */
async function fetchWithTimeout(
    url: string,
    validatedIp: string,
    validatedFamily?: number,
    timeout: number = 8000,
): Promise<string> {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    const maxRedirects = 5;
    let currentUrl = url;
    let redirectCount = 0;
    let currentHostname = new URL(currentUrl).hostname;
    let currentIp = validatedIp;
    let currentFamily = validatedFamily ?? 4;
    const agent = new Agent({
        connect: {
            lookup: (hostname, _options, callback) => {
                if (hostname !== currentHostname) {
                    callback(
                        new SSRFBlockedError('Access to the redirect URL is restricted for security reasons'),
                        [],
                    );
                    return;
                }

                callback(null, [{ address: currentIp, family: currentFamily }]);
            },
        },
    });

    try {
        while (redirectCount < maxRedirects) {
            // Use the custom dispatcher so the validated IP is always used.
            const response = await fetch(currentUrl, {
                signal: controller.signal,
                redirect: 'manual', // 自動リダイレクトを無効化
                // @ts-ignore - undici agent dispatcher
                dispatcher: agent,
                headers: {
                    'User-Agent':
                        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                },
                // @ts-ignore - duplex is needed for some fetch implementations but not in standard type
                duplex: 'half',
            });

            // 認証が必要なサイトの場合は専用エラーをスロー
            if (response.status === 401 || response.status === 403) {
                throw new AuthenticationRequiredError(
                    `このURLには認証が必要です（HTTP ${response.status}）`,
                    response.status,
                );
            }

            // リダイレクト処理
            if (response.status >= 300 && response.status < 400) {
                // レスポンスボディを破棄してリソースを解放
                // biome-ignore lint/suspicious/noExplicitAny: response.body might be missing in some environments
                await response.body?.cancel();

                const location = response.headers.get('Location');
                if (!location) {
                    throw new Error(`HTTP ${response.status} Redirect without Location header`);
                }

                // 相対パスの場合は絶対パスに変換
                const nextUrlObj = new URL(location, currentUrl);
                const nextUrl = nextUrlObj.toString();

                // SSRFチェック（リダイレクト先もチェック）
                const validatedRedirectUrl = await validateAndResolveUrl(nextUrl);
                if (!validatedRedirectUrl.isSafe || !validatedRedirectUrl.ipAddress) {
                    console.warn('[Extract API] Blocked unsafe redirect to:', getLoggableUrl(nextUrl));
                    throw new SSRFBlockedError('Access to the redirect URL is restricted for security reasons');
                }

                currentIp = validatedRedirectUrl.ipAddress;
                currentFamily = validatedRedirectUrl.family ?? 4;

                currentUrl = nextUrl;
                currentHostname = nextUrlObj.hostname;
                redirectCount++;
                continue;
            }

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            return await response.text();
        }

        throw new TooManyRedirectsError('Too many redirects');
    } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
            throw new TimeoutError('Fetch timeout');
        }
        throw error;
    } finally {
        clearTimeout(id);
        agent.destroy();
    }
}

class TimeoutError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'TimeoutError';
    }
}

class AuthenticationRequiredError extends Error {
    statusCode: number;
    constructor(message: string, statusCode: number = 403) {
        super(message);
        this.name = 'AuthenticationRequiredError';
        this.statusCode = statusCode;
    }
}

class SSRFBlockedError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'SSRFBlockedError';
    }
}

class TooManyRedirectsError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'TooManyRedirectsError';
    }
}
