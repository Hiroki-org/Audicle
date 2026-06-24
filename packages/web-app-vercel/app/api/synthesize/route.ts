import { NextRequest, NextResponse } from 'next/server';
import { getCorsHeaders, CorsError } from '@/lib/cors';
import { randomUUID } from 'crypto';
import { auth } from '@/lib/auth';
import { getKv } from '@/lib/kv';
import { parseArticleMetadata, serializeArticleMetadata } from '@/lib/kv-helpers';
import { CacheStats, SynthesizeChunk } from '@/types/api';
import { getCacheIndex, addCachedChunk, isCachedInIndex } from '@/lib/db/cacheIndex';
import { calculateTextHash } from '@/lib/textHash';
import { getStorageProvider } from '@/lib/storage';
import { removeSeparatorCharacters } from '@/lib/textCleaner';
import { TTSError } from './helpers/ttsError';
import { synthesizeToBuffer } from './helpers/ttsClient';
import { calculateArticleHash } from './helpers/articleHash';

import { TTSError } from './helpers/ttsError';
import { synthesizeToBuffer } from './helpers/ttsClient';
import { calculateArticleHash } from './helpers/articleHash';


// Node.js runtimeを明示的に指定（Google Cloud TTS SDKはEdge Runtimeで動作しない）
export const runtime = 'nodejs';
// 動的レンダリングを強制（キャッシュを無効化）
export const dynamic = 'force-dynamic';



// 許可リスト（環境変数から取得、カンマ区切り）
const ALLOWED_EMAILS = process.env.ALLOWED_EMAILS?.split(',').map(e => e.trim()) || [];

// 人気記事判定の閾値（本番環境では5以上に調整することを推奨）
// 現在は2に設定して開発/テスト環境での最適化検証を行う
const POPULAR_ARTICLE_READ_COUNT_THRESHOLD = 2;





export async function OPTIONS(request: NextRequest) {
    try {
        const headers = getCorsHeaders(request);
        return NextResponse.json({}, { headers });
    } catch (error) {
        if (error instanceof CorsError) {
            return new NextResponse(null, { status: 403, statusText: "Forbidden" });
        }
        throw error;
    }
}

export async function POST(request: NextRequest) {
    const requestId = randomUUID();
    // biome-ignore lint/suspicious/noExplicitAny: The data payload for structured logging can accept any object shape.
    const log = (level: 'info' | 'warn' | 'error', message: string, data: Record<string, unknown> = {}) => {
        console[level](JSON.stringify({ requestId, level, message, ...data }));
    };

    let corsHeaders: Record<string, string>;
    try {
        corsHeaders = getCorsHeaders(request);
    } catch (error) {
        if (error instanceof CorsError) {
            return NextResponse.json({ error: "Forbidden: Origin not allowed" }, { status: 403 });
        }
        throw error;
    }

    try {
        log('info', 'リクエスト受信');
        // 認証チェック
        const session = await auth();
        if (!session?.user?.email) {
            log('warn', '認証されていないリクエスト');
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
        }

        // 許可リストチェック
        if (ALLOWED_EMAILS.length > 0 && !ALLOWED_EMAILS.includes(session.user.email)) {
            log('warn', 'アクセスが拒否されました', { email: session.user.email });
            return NextResponse.json({ error: 'Access denied' }, { status: 403, headers: corsHeaders });
        }

        // リクエストボディをパース
        const body = await request.json();

        log('info', 'リクエストパラメータ', {
            hasText: !!body.text,
            hasArticleUrl: !!body.articleUrl,
            hasChunks: !!body.chunks,
            voice: body.voice || body.voice_model
        });

        // 入力バリデーション
        if (!body.chunks && !body.text) {
            log('warn', 'text または chunks がリクエストボディにありません');
            return NextResponse.json(
                { error: 'text or chunks is required' },
                { status: 400, headers: corsHeaders }
            );
        }

        const speakingRate = body.speakingRate || 1.0;
        const storage = getStorageProvider();
        const signedUrlTtlSeconds = 60 * 60;

        // 旧形式（text + voiceModel）または新形式（chunks + voice）の両方をサポート
        const textChunks = body.chunks
            ? body.chunks.map((c: SynthesizeChunk) => c.text)
            : [body.text];

        const voiceToUse = body.voice || body.voice_model || 'ja-JP-Standard-B';
        const { articleUrl, chunks, chunkIndex } = body;

        // 記事メタデータ処理
        let isPopularArticle = false;
        let metadata = null;
        const kv = await getKv();

        if (kv) {
            const metadataKey = `article:${articleUrl}:${voiceToUse}`;

            // ステップ1: 記事レベルのメタデータ（body.chunks存在時のみ）
            if (articleUrl && chunks && Array.isArray(chunks)) {
                const currentHash = calculateArticleHash(textChunks);
                const totalChunks = textChunks.length;

                try {
                    // 既存メタデータを確認
                    const metadataHash = await kv.hgetall(metadataKey);
                    metadata = parseArticleMetadata(metadataHash);

                    // 新規 or 記事編集時のみハッシュ/totalChunksを保存
                    if (!metadata || metadata.articleHash !== currentHash) {
                        await kv.hset(metadataKey, serializeArticleMetadata({
                            articleUrl,
                            articleHash: currentHash,
                            voice: voiceToUse,
                            totalChunks,
                            completedPlayback: false,
                            readCount: 0,
                            lastUpdated: new Date().toISOString(),
                            lastAccessed: new Date().toISOString()
                        }));
                        log('info', '記事メタデータを初期化しました', { articleUrl, totalChunks });
                    }
                } catch (kvError) {
                    log('error', '記事メタデータの初期化に失敗しました', { error: kvError });
                }
            }

            // ステップ2: アクセスレベルのメタデータ（articleUrl存在時は常に）
            if (articleUrl) {
                try {
                    // アクセスメタデータを取得（人気記事判定用）
                    const metadataHash = await kv.hgetall(metadataKey);
                    metadata = parseArticleMetadata(metadataHash);

                    // 人気記事判定（記事レベルメタデータから）
                    if (metadata && metadata.readCount >= POPULAR_ARTICLE_READ_COUNT_THRESHOLD && metadata.completedPlayback === true) {
                        isPopularArticle = true;
                        log('info', '人気記事を検出しました', {
                            articleUrl,
                            readCount: metadata.readCount,
                            completedPlayback: metadata.completedPlayback,
                            threshold: POPULAR_ARTICLE_READ_COUNT_THRESHOLD
                        });
                    }

                    // アクセスカウントと最終アクセス時刻を更新
                    await kv.hincrby(metadataKey, 'readCount', 1);
                    await kv.hset(metadataKey, {
                        lastAccessed: new Date().toISOString(),
                        lastPlayedChunk: chunkIndex ?? 0
                    });
                    log('info', 'アクセスメタデータを更新しました', { articleUrl });
                } catch (kvError) {
                    log('error', 'アクセスメタデータの更新に失敗しました', { error: kvError });
                }
            }
        }

        log('info', '記事メタデータ', {
            articleUrl,
            readCount: metadata?.readCount ?? 0,
            completedPlayback: metadata?.completedPlayback ?? false,
            isPopular: isPopularArticle
        });

        // Supabaseキャッシュインデックスを取得（articleUrlがある場合）
        let cacheIndex = null;
        if (articleUrl) {
            try {
                cacheIndex = await getCacheIndex(articleUrl, voiceToUse);
                log('info', 'Supabaseキャッシュインデックスをロードしました', {
                    articleUrl,
                    voice: voiceToUse,
                    cachedChunksCount: cacheIndex?.cached_chunks.length ?? 0
                });
            } catch {
                // getCacheIndex関数内で既にエラーログが出力されているため、ここではログ出力しない
            }
        }

        // キャッシュ統計情報
        let cacheHits = 0;
        let cacheMisses = 0;

        // 各チャンクを合成またはキャッシュから取得
        const audioUrls: string[] = [];
        const audioBuffers: Buffer[] = [];

        // Simple Operations 削減カウンター
        let headOperationsSkipped = 0;

        for (let i = 0; i < textChunks.length; i++) {
            const chunkText = textChunks[i];
            const cleanedChunkText = removeSeparatorCharacters(chunkText);
            const textHash = calculateTextHash(cleanedChunkText, i);
            const cacheKey = `${textHash}:${voiceToUse}.mp3`;
            const isCachedByIndex = cacheIndex ? isCachedInIndex(cacheIndex, textHash) : false;

            const recordCachedHit = async (): Promise<boolean> => {
                try {
                    const url = await storage.generatePresignedGetUrl(cacheKey, signedUrlTtlSeconds);
                    cacheHits++;
                    audioUrls.push(url);
                    audioBuffers.push(Buffer.alloc(0));
                    return true;
                } catch (urlError) {
                    log('warn', '署名付きGET URLの発行に失敗しました', {
                        cacheKey,
                        error: urlError instanceof Error ? urlError.message : urlError,
                    });
                    return false;
                }
            };

            const checkHeadObject = async (): Promise<boolean> => {
                log('info', `R2キャッシュをチェック中 (headObject): ${cacheKey}`);
                const result = await storage.headObject(cacheKey).catch((error: unknown) => {
                    log('error', `キー ${cacheKey} のキャッシュチェックに失敗しました`, { error });
                    return null;
                });
                return result?.exists ?? false;
            };

            // 人気記事の場合：全チャンクがキャッシュ済みと仮定してhead()をスキップ
            if (isPopularArticle) {
                log('info', `人気記事のためhead()をスキップ: チャンク ${audioUrls.length + 1}`);
                headOperationsSkipped++;

                const hitRecorded = await recordCachedHit();
                if (hitRecorded) {
                    continue;
                }

                log('warn', '人気記事の署名付きURLの取得に失敗しました。通常のフローにフォールバックします。');
            }

            let objectExists = false;

            if (cacheIndex) {
                if (isCachedByIndex) {
                    // Supabaseインデックスにキャッシュ済み → head()スキップ！
                    log('info', `✅ R2キャッシュヒット (Supabase Index): ${cacheKey}のためhead()をスキップ`);
                    headOperationsSkipped++;

                    const hitRecorded = await recordCachedHit();
                    if (hitRecorded) {
                        continue;
                    }

                    log('warn', '署名付きURLの取得に失敗しました。head()チェックにフォールバックします。');
                    objectExists = await checkHeadObject();
                    if (objectExists) {
                        const fallbackHit = await recordCachedHit();
                        if (fallbackHit) {
                            continue;
                        }
                    }
                } else {
                    // Supabaseインデックスになし → キャッシュミス確定
                    log('info', `❌ R2キャッシュミス (Supabase Index): ${cacheKey}`);
                }
            }

            // 通常フロー or Supabaseインデックスなし or ミス → head()でチェック
            if (!cacheIndex || !isCachedByIndex) {
                objectExists = await checkHeadObject();
            }

            if (objectExists) {
                log('info', `✅ R2キャッシュヒット (headObject): ${cacheKey}`);

                const hitRecorded = await recordCachedHit();
                if (hitRecorded) {
                    // インデックスにはないが Blob に存在する場合：遅延インデックス作成
                    if (articleUrl && cacheIndex && !isCachedByIndex) {
                        addCachedChunk(articleUrl, voiceToUse, textHash)
                            .then(() => {
                                log('info', '既存のキャッシュのインデックスをバックフィルしました', { textHash });
                            })
                            .catch((error) => {
                                log('error', 'インデックスのバックフィルに失敗しました', { textHash, error });
                            });
                    }

                    continue;
                }
            }

            // 2. キャッシュミス：TTS生成
            log('info', `❌ R2キャッシュミス: ${cacheKey}。Google TTS APIを呼び出します。`);
            cacheMisses++;
            const audioBuffer = await synthesizeToBuffer(cleanedChunkText, voiceToUse, speakingRate);

            // 音声バッファを保存
            audioBuffers.push(audioBuffer);

            // 3. ストレージに保存（失敗時はbase64にフォールバック）
            try {
                const storedUrl = await storage.uploadObject(cacheKey, audioBuffer, 'audio/mpeg', signedUrlTtlSeconds);
                audioUrls.push(storedUrl);
                log('info', `音声を作成しR2キャッシュに保存しました: ${cacheKey}`);

                // 4. Supabaseインデックスに追加（articleUrlがある場合）
                if (articleUrl) {
                    try {
                        await addCachedChunk(articleUrl, voiceToUse, textHash);
                        log('info', 'チャンクをSupabaseインデックスに追加しました', { textHash });
                    } catch {
                        // addCachedChunk関数内で既にエラーログが出力されているため、ここではログ出力しない
                    }
                }
            } catch (putError) {
                log('error', `音声のキャッシュへの保存に失敗しました。base64にフォールバックします: ${cacheKey}`, { error: putError });
                const base64Audio = audioBuffer.toString('base64');
                audioUrls.push(`data:audio/mpeg;base64,${base64Audio}`);
            }
        }        // キャッシュヒット率を計算
        const totalChunks = textChunks.length;
        const hitRate = totalChunks > 0 ? cacheHits / totalChunks : 0;

        const cacheStats: CacheStats = {
            hitRate,
            cacheHits,
            cacheMisses,
            totalChunks,
        };

        log('info', 'キャッシュ統計', { cacheHits, cacheMisses, hitRate: `${(hitRate * 100).toFixed(2)}%` });
        log('info', `最適化: ${headOperationsSkipped} 回の head() コールをスキップしました`);

        // 旧形式（1チャンク）の場合はbase64を返す
        if (!body.chunks && body.text) {
            // 旧形式：base64レスポンス
            // audioBuffersに保存された音声データを直接base64に変換
            let audioBuffer = audioBuffers[0];

            // キャッシュヒット時はバッファが空のため、URLから音声データを取得
            if (!audioBuffer || audioBuffer.length === 0) {
                const audioUrl = audioUrls[0];
                log('info', 'キャッシュされた音声をフェッチ中', { audioUrl });
                const response = await fetch(audioUrl);

                if (!response.ok) {
                    log('error', `キャッシュされた音声のフェッチに失敗しました: ${audioUrl}`, { status: response.status });
                    return NextResponse.json(
                        { error: 'Failed to fetch cached audio' },
                        { status: 500, headers: corsHeaders }
                    );
                }

                const arrayBuffer = await response.arrayBuffer();
                audioBuffer = Buffer.from(arrayBuffer);
            }

            const base64Audio = audioBuffer.toString('base64');

            log('info', '古い形式のリクエストにbase64でエンコードされた音声を返します');
            return NextResponse.json({
                audio: base64Audio
            }, {
                headers: corsHeaders,
            });
        }

        // 新形式：URL配列レスポンス
        log('info', '新しい形式のリクエストに音声URLの配列を返します');

        // チャンクメタデータを構築
        const chunkMetadata = audioUrls.map((url, index) => ({
            url,
            isSplitChunk: body.chunks?.[index]?.isSplitChunk ?? false,
        }));

        return NextResponse.json(
            {
                audioUrls,
                chunkMetadata,
                cacheStats,
            },
            {
                headers: corsHeaders,
            }
        );
    } catch (error) {

        log('error', '音声合成エラー', {
            error,
            errorType: error instanceof TTSError ? 'TTSError' : error instanceof SyntaxError ? 'SyntaxError' : 'Unknown',
            statusCode: error instanceof TTSError ? error.statusCode : undefined,
        });

        if (error instanceof SyntaxError) {
            return NextResponse.json(
                { error: 'Invalid request body' },
                { status: 400, headers: corsHeaders }
            );
        }

        // TTSエラーの場合は適切なステータスコードとユーザーフレンドリーなメッセージを返す
        if (error instanceof TTSError) {
            return NextResponse.json(
                {
                    error: error.message,
                    errorType: error.errorType,
                },
                { status: error.statusCode, headers: corsHeaders }
            );
        }

        // When not in production, include the original error message for easier
        // debugging. Do not include sensitive details in production.
        interface SynthesizeErrorResponse {
            error: string;
            detail?: string;
            errorType?: string;
        }

        const responseBody: SynthesizeErrorResponse = {
            error: 'Failed to synthesize speech',
            errorType: 'UNKNOWN'
        };
        if (process.env.NODE_ENV !== 'production' && error instanceof Error) {
            responseBody.detail = error.message;
        }

        return NextResponse.json(responseBody, { status: 500, headers: corsHeaders });
    }
}
