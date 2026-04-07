'use client';

/**
 * IndexedDB for Audio Caching
 * 
 * データベース構造:
 * - DB名: audicle-cache
 * - Store名: audio-chunks
 * - キー: `${articleUrl}:${chunkIndex}:${voiceModel}`
 */

import { logger } from './logger';

const DB_NAME = 'audicle-cache';
const STORE_NAME = 'audio-chunks';
const DB_VERSION = 1;

// IndexedDB接続をキャッシュ（シングルトンパターン）
let dbPromise: Promise<IDBDatabase> | null = null;

export interface AudioCacheEntry {
    key: string; // `${articleUrl}:${chunkIndex}:${voiceModel}`
    audioData: Blob; // 音声データ（Blob形式）
    timestamp: number; // 保存日時
    articleUrl: string;
    chunkIndex: number;
    totalChunks: number;
    voiceModel?: string;
    size: number; // データサイズ（バイト）
}

export interface DownloadedArticle {
    url: string;
    totalChunks: number;
    downloadedChunks: number;
    totalSize: number;
    timestamp: number;
    voiceModel?: string;
}

/**
 * キーを生成する
 */
export function generateKey(
    articleUrl: string,
    chunkIndex: number,
    voiceModel?: string
): string {
    return `${articleUrl}:${chunkIndex}:${voiceModel || 'default'}`;
}

/**
 * IndexedDBを初期化（接続をキャッシュして再利用）
 */
function openDB(): Promise<IDBDatabase> {
    if (dbPromise) {
        return dbPromise;
    }

    dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => {
            logger.error('IndexedDB open error', request.error);
            dbPromise = null; // Reset on error
            reject(request.error);
        };

        request.onsuccess = () => {
            const db = request.result;
            // 接続が予期なく閉じられた場合はキャッシュをリセット
            db.onclose = () => {
                logger.warn('IndexedDB connection closed unexpectedly.');
                dbPromise = null;
            };
            resolve(db);
        };

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;

            // オブジェクトストアを作成
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                const objectStore = db.createObjectStore(STORE_NAME, { keyPath: 'key' });

                // インデックスを作成（高速検索用）
                objectStore.createIndex('articleUrl', 'articleUrl', { unique: false });
                objectStore.createIndex('timestamp', 'timestamp', { unique: false });

                logger.info('IndexedDB object store created');
            }
        };
    });

    return dbPromise;
}

/**
 * 音声データを保存
 */
export async function saveAudioChunk(entry: Omit<AudioCacheEntry, 'key'>): Promise<void> {
    const db = await openDB();
    const key = generateKey(entry.articleUrl, entry.chunkIndex, entry.voiceModel);

    const cacheEntry: AudioCacheEntry = {
        ...entry,
        key,
    };

    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');

        transaction.onerror = () => {
            logger.error('Save transaction error', transaction.error);
            reject(transaction.error);
        };

        const store = transaction.objectStore(STORE_NAME);
        const request = store.put(cacheEntry);

        request.onsuccess = () => {
            logger.info(`Saved chunk ${entry.chunkIndex + 1}/${entry.totalChunks} for ${entry.articleUrl}`);
            resolve();
        };

        request.onerror = () => {
            logger.error('Save error', request.error);
            reject(request.error);
        };
    });
}

/**
 * 音声データを取得
 */
export async function getAudioChunk(
    articleUrl: string,
    chunkIndex: number,
    voiceModel?: string
): Promise<AudioCacheEntry | null> {
    const db = await openDB();
    const key = generateKey(articleUrl, chunkIndex, voiceModel);

    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readonly');

        transaction.onerror = () => {
            logger.error('Get transaction error', transaction.error);
            reject(transaction.error);
        };

        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(key);

        request.onsuccess = () => {
            resolve(request.result || null);
        };

        request.onerror = () => {
            logger.error('Get error', request.error);
            reject(request.error);
        };
    });
}

/**
 * 記事の全チャンクを取得
 */
export async function getArticleChunks(articleUrl: string): Promise<AudioCacheEntry[]> {
    const db = await openDB();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readonly');

        transaction.onerror = () => {
            logger.error('Get all transaction error', transaction.error);
            reject(transaction.error);
        };

        const store = transaction.objectStore(STORE_NAME);
        const index = store.index('articleUrl');
        const request = index.getAll(articleUrl);

        request.onsuccess = () => {
            resolve(request.result || []);
        };

        request.onerror = () => {
            logger.error('Get all error', request.error);
            reject(request.error);
        };
    });
}

/**
 * 記事を削除
 */
export async function deleteArticle(articleUrl: string): Promise<void> {
    const db = await openDB();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');

        transaction.onerror = () => {
            logger.error('Delete transaction error', transaction.error);
            reject(transaction.error);
        };

        const store = transaction.objectStore(STORE_NAME);
        const index = store.index('articleUrl');
        const request = index.openCursor(IDBKeyRange.only(articleUrl));

        request.onsuccess = (event) => {
            const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
            if (cursor) {
                cursor.delete();
                cursor.continue();
            }
        };

        request.onerror = () => {
            logger.error('Delete error', request.error);
            reject(request.error);
        };

        transaction.oncomplete = () => {
            logger.info(`Deleted all chunks for ${articleUrl}`);
            resolve();
        };
    });
}

/**
 * 全てのデータを削除
 */
export async function clearAll(): Promise<void> {
    const db = await openDB();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');

        transaction.onerror = () => {
            logger.error('Clear transaction error', transaction.error);
            reject(transaction.error);
        };

        const store = transaction.objectStore(STORE_NAME);
        const request = store.clear();

        request.onsuccess = () => {
            logger.info('Cleared all cache');
            resolve();
        };

        request.onerror = () => {
            logger.error('Clear error', request.error);
            reject(request.error);
        };
    });
}

/**
 * ダウンロード済み記事の一覧を取得
 */
export async function getDownloadedArticles(): Promise<DownloadedArticle[]> {
    const db = await openDB();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readonly');

        transaction.onerror = () => {
            logger.error('Get downloaded articles transaction error', transaction.error);
            reject(transaction.error);
        };

        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();

        request.onsuccess = () => {
            const entries = request.result as AudioCacheEntry[];

            // 記事URLごとにグループ化
            const articlesMap = new Map<string, DownloadedArticle>();

            entries.forEach((entry) => {
                const existing = articlesMap.get(entry.articleUrl);

                if (existing) {
                    existing.downloadedChunks++;
                    existing.totalSize += entry.size;
                    existing.timestamp = Math.max(existing.timestamp, entry.timestamp);
                } else {
                    articlesMap.set(entry.articleUrl, {
                        url: entry.articleUrl,
                        totalChunks: entry.totalChunks,
                        downloadedChunks: 1,
                        totalSize: entry.size,
                        timestamp: entry.timestamp,
                        voiceModel: entry.voiceModel,
                    });
                }
            });

            resolve(Array.from(articlesMap.values()));
        };

        request.onerror = () => {
            logger.error('Get downloaded articles error', request.error);
            reject(request.error);
        };
    });
}

/**
 * ストレージ使用量を計算
 */
export async function getStorageUsage(): Promise<{ used: number; available: number }> {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate();
        return {
            used: estimate.usage || 0,
            available: estimate.quota || 0,
        };
    }

    // フォールバック: IndexedDBから計算
    const articles = await getDownloadedArticles();
    const used = articles.reduce((sum, article) => sum + article.totalSize, 0);

    return {
        used,
        available: Infinity, // デフォルト50GB
    };
}

/**
 * 記事のダウンロード状態を確認
 */
export async function getArticleDownloadStatus(
    articleUrl: string
): Promise<{ downloaded: number; total: number; isComplete: boolean } | null> {
    const chunks = await getArticleChunks(articleUrl);

    if (chunks.length === 0) {
        return null;
    }

    const totalChunks = chunks[0].totalChunks;
    const downloaded = chunks.length;

    return {
        downloaded,
        total: totalChunks,
        isComplete: downloaded === totalChunks,
    };
}

/**
 * ストレージ容量をチェック
 */
export async function checkStorageCapacity(requiredSize: number): Promise<boolean> {
    const { used, available } = await getStorageUsage();
    return used + requiredSize < available;
}
