'use client';

import { useState, useCallback, useRef } from 'react';
import { Chunk } from '@/types/api';
import { synthesizeSpeech } from '@/lib/api';
import { saveAudioChunk, checkStorageCapacity } from '@/lib/indexedDB';
import { logger } from '@/lib/logger';

export type DownloadStatus = 'idle' | 'downloading' | 'completed' | 'error' | 'cancelled';

interface UseDownloadProps {
    articleUrl: string;
    chunks: Chunk[];
    voiceModel?: string;
    speed?: number;
    onSlowConnection?: () => Promise<boolean>; // 低速接続時のコールバック
}

const MAX_RETRIES = 3;
const MAX_CONCURRENT = 3; // 最大3チャンク同時ダウンロード
const RETRY_DELAY = 1000; // リトライ間隔（ミリ秒）
const ESTIMATED_CHUNK_SIZE_BYTES = 50 * 1024; // 1チャンクあたりの推定サイズ（50KB）

export function useDownload({ articleUrl, chunks, voiceModel, speed, onSlowConnection }: UseDownloadProps) {
    const [status, setStatus] = useState<DownloadStatus>('idle');
    const [progress, setProgress] = useState({ current: 0, total: 0 });
    const [error, setError] = useState<string>('');
    const [estimatedTime, setEstimatedTime] = useState<number>(0); // 秒単位

    const cancelledRef = useRef(false);
    const startTimeRef = useRef<number>(0);

    /**
     * 単一チャンクをダウンロード（リトライ付き）
     */
    const downloadChunk = useCallback(async (chunk: Chunk, index: number, retryCount = 0): Promise<void> => {
        if (cancelledRef.current) {
            throw new Error('Cancelled');
        }

        try {
            // 音声合成（1倍速固定）
            logger.info('ダウンロード用音声合成リクエスト', {
                chunkIndex: index,
                hasArticleUrl: !!articleUrl,
                articleUrl,
            });
            const audioBlob = await synthesizeSpeech(chunk.cleanedText, undefined, voiceModel, articleUrl);

            if (cancelledRef.current) {
                throw new Error('Cancelled');
            }

            // IndexedDBに直接保存
            await saveAudioChunk({
                audioData: audioBlob,
                timestamp: Date.now(),
                articleUrl,
                chunkIndex: index,
                totalChunks: chunks.length,
                voiceModel: voiceModel,
                size: audioBlob.size,
            });

            logger.success(`チャンク ${index + 1}/${chunks.length} ダウンロード完了`, {
                articleUrl,
            });
        } catch (err) {
            if (cancelledRef.current) {
                throw err; // Cancelledエラーはそのまま投げる (or rethrow 'Cancelled')
            }

            // Cancelledエラーの場合はリトライしない
            if (err instanceof Error && err.message === 'Cancelled') {
                 throw err;
            }

            // リトライ
            if (retryCount < MAX_RETRIES) {
                logger.warn(`チャンク ${index + 1} リトライ ${retryCount + 1}/${MAX_RETRIES}`);
                await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
                return downloadChunk(chunk, index, retryCount + 1);
            }

            throw new Error(`チャンク ${index + 1} のダウンロードに失敗しました: ${err}`);
        }
    }, [articleUrl, voiceModel, chunks]);

    /**
     * バッチでチャンクをダウンロード
     */
    const downloadBatch = useCallback(async (
        chunksToDownload: Chunk[],
        startIndex: number
    ): Promise<void> => {
        const promises: Promise<void>[] = [];

        for (let i = 0; i < Math.min(MAX_CONCURRENT, chunksToDownload.length); i++) {
            const chunk = chunksToDownload[i];
            const index = startIndex + i;
            promises.push(downloadChunk(chunk, index));
        }

        await Promise.all(promises);

        // 次のバッチを処理
        if (chunksToDownload.length > MAX_CONCURRENT) {
            await downloadBatch(
                chunksToDownload.slice(MAX_CONCURRENT),
                startIndex + MAX_CONCURRENT
            );
        }
    }, [downloadChunk]);

    /**
     * 推定残り時間を更新
     */
    const updateEstimatedTime = useCallback((current: number, total: number) => {
        if (current === 0) return;

        const elapsed = Date.now() - startTimeRef.current;
        const averageTime = elapsed / current;
        const remaining = total - current;
        const estimatedMs = averageTime * remaining;

        setEstimatedTime(Math.ceil(estimatedMs / 1000));
    }, []);

    /**
     * ダウンロード開始
     */
    const startDownload = useCallback(async () => {
        if (chunks.length === 0) {
            setError('チャンクが存在しません');
            return;
        }

        // ストレージ容量チェック
        const estimatedSize = chunks.length * ESTIMATED_CHUNK_SIZE_BYTES;
        const hasCapacity = await checkStorageCapacity(estimatedSize);

        if (!hasCapacity) {
            setError('ストレージ容量が不足しています');
            setStatus('error');
            return;
        }

        // モバイルデータ通信チェック
        if ('connection' in navigator) {
             
            const connection = (navigator as any).connection;
            if (connection && connection.effectiveType) {
                const type = connection.effectiveType;
                if (type === 'slow-2g' || type === '2g' || type === '3g') {
                    if (onSlowConnection) {
                        const confirmed = await onSlowConnection();
                        if (!confirmed) {
                            setStatus('cancelled');
                            return;
                        }
                    }
                }
            }
        }

        setStatus('downloading');
        setProgress({ current: 0, total: chunks.length });
        setError('');
        cancelledRef.current = false;
        startTimeRef.current = Date.now();

        try {
            logger.info(`ダウンロード開始: ${chunks.length}チャンク`);

            // チャンクを順次ダウンロード（バッチ処理）
            for (let i = 0; i < chunks.length; i += MAX_CONCURRENT) {
                if (cancelledRef.current) {
                    setStatus('cancelled');
                    logger.info('ダウンロードがキャンセルされました');
                    return;
                }

                const batch = chunks.slice(i, i + MAX_CONCURRENT);
                await downloadBatch(batch, i);

                // バッチ完了後にもキャンセルチェック
                 if (cancelledRef.current) {
                    setStatus('cancelled');
                    logger.info('ダウンロードがキャンセルされました');
                    return;
                }

                const current = Math.min(i + MAX_CONCURRENT, chunks.length);
                setProgress({ current, total: chunks.length });
                updateEstimatedTime(current, chunks.length);
            }

            setStatus('completed');
            logger.success(`全${chunks.length}チャンクのダウンロードが完了しました`);
        } catch (err) {
            if (cancelledRef.current || (err instanceof Error && err.message === 'Cancelled')) {
                setStatus('cancelled');
            } else {
                setStatus('error');
                setError(err instanceof Error ? err.message : 'ダウンロードエラー');
                logger.error('ダウンロードエラー', err);
            }
        }
    }, [chunks, updateEstimatedTime, onSlowConnection, downloadBatch]);

    /**
     * ダウンロードキャンセル
     */
    const cancelDownload = useCallback(() => {
        cancelledRef.current = true;
        setStatus('cancelled');
        logger.info('ダウンロードをキャンセルしました');
    }, []);

    /**
     * リセット
     */
    const reset = useCallback(() => {
        setStatus('idle');
        setProgress({ current: 0, total: 0 });
        setError('');
        setEstimatedTime(0);
        cancelledRef.current = false;
    }, []);

    return {
        status,
        progress,
        error,
        estimatedTime,
        startDownload,
        cancelDownload,
        reset,
    };
}
