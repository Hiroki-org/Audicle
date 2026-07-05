import { getKv } from '@/lib/kv';
import { parseArticleMetadata, serializeArticleMetadata } from '@/lib/kv-helpers';
import { calculateTextHash } from '@/lib/textHash';
import { getStorageProvider } from '@/lib/storage';
import { isCachedInIndex, addCachedChunk, CacheIndex } from '@/lib/db/cacheIndex';
import { removeSeparatorCharacters } from '@/lib/textCleaner';
import { SynthesizeChunk } from '@/types/api';
import { NextResponse } from 'next/server';

const POPULAR_ARTICLE_READ_COUNT_THRESHOLD = 2;

type LogFunction = (level: 'info' | 'warn' | 'error', message: string, data?: Record<string, unknown>) => void;

export async function processArticleMetadata(
    articleUrl: string | undefined,
    chunks: SynthesizeChunk[] | undefined,
    textChunks: string[],
    voiceToUse: string,
    chunkIndex: number | undefined,
    log: LogFunction,
    calculateArticleHash: (chunks: string[]) => string
) {
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

    return { isPopularArticle, metadata };
}

interface ProcessChunksOptions {
    textChunks: string[];
    voiceToUse: string;
    speakingRate: number;
    articleUrl: string | undefined;
    isPopularArticle: boolean;
    storage: ReturnType<typeof getStorageProvider>;
    signedUrlTtlSeconds: number;
    cacheIndex: CacheIndex | null;
    log: LogFunction;
    synthesizeToBuffer: (text: string, voice: string, rate: number) => Promise<Buffer>;
}

export async function processChunks(options: ProcessChunksOptions) {
    const { textChunks, voiceToUse, speakingRate, articleUrl, isPopularArticle, storage, signedUrlTtlSeconds, cacheIndex, log, synthesizeToBuffer } = options;

    let cacheHits = 0;
    let cacheMisses = 0;

    const audioUrls: string[] = [];
    const audioBuffers: Buffer[] = [];
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
                log('info', `❌ R2キャッシュミス (Supabase Index): ${cacheKey}`);
            }
        }

        if (!cacheIndex || !isCachedByIndex) {
            objectExists = await checkHeadObject();
        }

        if (objectExists) {
            log('info', `✅ R2キャッシュヒット (headObject): ${cacheKey}`);

            const hitRecorded = await recordCachedHit();
            if (hitRecorded) {
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

        log('info', `❌ R2キャッシュミス: ${cacheKey}。Google TTS APIを呼び出します。`);
        cacheMisses++;
        const audioBuffer = await synthesizeToBuffer(cleanedChunkText, voiceToUse, speakingRate);

        audioBuffers.push(audioBuffer);

        try {
            const storedUrl = await storage.uploadObject(cacheKey, audioBuffer, 'audio/mpeg', signedUrlTtlSeconds);
            audioUrls.push(storedUrl);
            log('info', `音声を作成しR2キャッシュに保存しました: ${cacheKey}`);

            if (articleUrl) {
                try {
                    await addCachedChunk(articleUrl, voiceToUse, textHash);
                    log('info', 'チャンクをSupabaseインデックスに追加しました', { textHash });
                } catch {
                }
            }
        } catch (putError) {
            log('error', `音声のキャッシュへの保存に失敗しました。base64にフォールバックします: ${cacheKey}`, { error: putError });
            const base64Audio = audioBuffer.toString('base64');
            audioUrls.push(`data:audio/mpeg;base64,${base64Audio}`);
        }
    }

    return {
        audioUrls,
        audioBuffers,
        cacheHits,
        cacheMisses,
        headOperationsSkipped
    };
}

export async function handleLegacyResponse(
    audioUrls: string[],
    audioBuffers: Buffer[],
    corsHeaders: Record<string, string>,
    log: LogFunction
) {
    let audioBuffer = audioBuffers[0];

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
