/**
 * 記事アクセス統計を記録するヘルパー関数
 */

import { Chunk } from '@/types/api';
import { logger } from './logger';
import { getArticleChunks } from './indexedDB';

interface RecordStatsParams {
    url: string;
    title: string;
    content: string;
    chunks: Chunk[];
}

// リトライヘルパー関数
function retryFetch(fetchFn: () => Promise<Response>, maxRetries: number = 3, delay: number = 1000): Promise<Response> {
    return new Promise((resolve, reject) => {
        const attemptFn = (currentAttempt: number) => {
            // Promise.resolve().then wraps fetchFn() to safely catch synchronous errors inside the promise chain
            Promise.resolve().then(fetchFn).then(resolve).catch(error => {
                if (currentAttempt === maxRetries) {
                    reject(error);
                    return;
                }
                // ECONNRESET などのネットワークエラー時はリトライ
                if (error instanceof Error && (error.message.includes('ECONNRESET') || error.message.includes('aborted'))) {
                    logger.warn(`Fetch attempt ${currentAttempt} failed, retrying in ${delay}ms:`, error.message);
                    setTimeout(() => attemptFn(currentAttempt + 1), delay);
                } else {
                    reject(error); // ネットワークエラー以外は即座に投げる
                }
            });
        };
        attemptFn(1);
    });
}

/**
 * 簡易ハッシュ関数（記事識別用）
 * MD5の代わりにSHA-256を使用
 */
async function calculateHash(text: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * URLからドメインを抽出
 */
function extractDomain(url: string): string {
    try {
        return new URL(url).hostname;
    } catch {
        return 'unknown';
    }
}

/**
 * キャッシュヒット/ミスを計算
 * IndexedDBをチェックして実際のキャッシュ状況を返す
 */
export async function calculateCacheStats(url: string, chunks: Chunk[]) {
    try {
        const cachedChunks = await getArticleChunks(url);

        // chunkIndexの範囲チェック＆重複除去を行いながらSet生成
        // 不正なインデックス（負数、配列長超過）は除外
        const validIndices = new Set(
            cachedChunks
                .map(c => c.chunkIndex)
                .filter((i) => Number.isInteger(i) && i >= 0 && i < chunks.length)
        );

        // Set.sizeで重複を自動排除したカウントを取得
        const cacheHits = validIndices.size;

        const cacheMisses = chunks.length - cacheHits;
        const isFullyCached = cacheHits === chunks.length && chunks.length > 0;

        return {
            cacheHits,
            cacheMisses,
            isFullyCached,
        };
    } catch (error) {
        logger.warn('Failed to calculate cache stats from IndexedDB:', error);
        // エラー時は全てミスとして扱う（安全策）
        return {
            cacheHits: 0,
            cacheMisses: chunks.length,
            isFullyCached: false,
        };
    }
}

/**
 * 記事アクセス統計を記録
 * エラーが発生しても記事読み込みには影響しない
 */
export async function recordArticleStats({
    url,
    title,
    content,
    chunks,
}: RecordStatsParams): Promise<void> {
    try {
        // 記事ハッシュを計算
        const articleHash = await calculateHash(content);

        // ドメインを抽出
        const domain = extractDomain(url);

        // キャッシュ統計を計算
        const { cacheHits, cacheMisses, isFullyCached } = await calculateCacheStats(url, chunks);

        // 統計APIを呼び出し（非同期、エラー無視）
        const response = await retryFetch(() =>
            fetch('/api/stats/article', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    articleHash,
                    url,
                    title,
                    domain,
                    cacheHits,
                    cacheMisses,
                    isFullyCached,
                }),
                signal: AbortSignal.timeout(5000), // 5秒タイムアウト
            })
        );

        if (response.ok) {
            const data = await response.json();
            logger.info('記事統計を記録', {
                url,
                accessCount: data.accessCount,
                cacheHitRate: data.cacheHitRate,
            });
        } else {
            // エラーログのみ出力、処理は継続
            logger.warn('記事統計の記録に失敗', {
                status: response.status,
                url,
            });
        }
    } catch (error) {
        // エラーをログに記録するが、例外は投げない
        logger.warn('記事統計記録エラー', error);
    }
}
