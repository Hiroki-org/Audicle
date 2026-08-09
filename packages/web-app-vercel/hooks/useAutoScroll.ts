"use client";

import { useEffect, useRef, useCallback } from "react";

/**
 * 読み上げ中の段落へ自動スクロールするカスタムフック
 * 
 * Chrome拡張版と同等のユーザー体験を提供
 * - チャンク切り替え時に自動スクロール
 * - スムーズスクロール（behavior: 'smooth'）
 * - 画面中央付近に表示（block: 'center'）
 * - モバイルデバイス対応
 */

export interface AutoScrollProps {
    /**
     * 現在再生中のチャンクID
     */
    activeChunkIndex?: string;

    /**
     * スクロール対象となるコンテナ要素の参照
     * 指定しない場合はwindowをスクロール対象とする
     */
    containerRef?: React.RefObject<HTMLDivElement | null>;

    /**
     * スクロール有効化フラグ
     * @default true
     */
    enabled?: boolean;

    /**
     * スクロール時の遅延（ミリ秒）
     * チャンク切り替えのタイミングに合わせるために使用
     * @default 0
     */
    delay?: number;
}

/**
 * 共通のスクロール実行関数
 * useAutoScrollとuseAutoScrollWithCacheで重複するロジックを共通化
 */
function scrollElementIntoView(
    element: Element,
    containerRef?: React.RefObject<HTMLDivElement | null>,
    chunkId?: string
): void {
    try {
        if (containerRef?.current) {
            const container = containerRef.current;
            const elementRect = element.getBoundingClientRect();
            const containerRect = container.getBoundingClientRect();

            // コンテナの中央に要素を配置するためのスクロール位置を計算
            const scrollTop =
                container.scrollTop +
                elementRect.top -
                containerRect.top -
                containerRect.height / 2 +
                elementRect.height / 2;

            container.scrollTo({
                top: scrollTop,
                behavior: "smooth",
                left: 0,
            });

        } else {
            // windowをスクロール対象とする場合
            // scrollIntoViewを使用（Chrome拡張版と同等）
            element.scrollIntoView({
                behavior: "smooth",
                block: "center",
                inline: "nearest",
            });

        }
    } catch (error) {
        console.warn(`[useAutoScroll] スクロール失敗:`, error);
        // フォールバック: 古いブラウザ対応
        try {
            element.scrollIntoView(true);
        } catch (fallbackError) {
            console.error(
                `[useAutoScroll] フォールバックスクロール失敗:`,
                fallbackError
            );
        }
    }
}

export function useAutoScroll({
    activeChunkIndex,
    containerRef,
    enabled = true,
    delay = 100,
}: AutoScrollProps) {
    useEffect(() => {
        if (!enabled || !activeChunkIndex) {
            return;
        }

        // 遅延がある場合はタイマーを使用
        const timer = setTimeout(() => {
            // data-audicle-id属性でチャンクを検索
            const element = document.querySelector(
                `[data-audicle-id="${CSS.escape(activeChunkIndex)}"]`
            );

            if (!element) {
                console.warn(
                    `[useAutoScroll] チャンクが見つかりません: ${activeChunkIndex}`
                );
                return;
            }

            scrollElementIntoView(element, containerRef, activeChunkIndex);
        }, delay);

        return () => clearTimeout(timer);
    }, [activeChunkIndex, containerRef, enabled, delay]);
}

/**
 * 別の実装方法: useRefを使用した参照キャッシュ版
 * （現在は使用されていないが、性能最適化が必要な場合に使用可能）
 */
export function useAutoScrollWithCache({
    activeChunkIndex,
    containerRef,
    enabled = true,
    delay = 100,
    cacheSize = 10,
}: AutoScrollProps & { cacheSize?: number }) {
    const elementRefCache = useRef<Map<string, Element | null>>(new Map());

    // キャッシュサイズを制限する処理
    const setCachedElement = useCallback((id: string, element: Element | null) => {
        if (elementRefCache.current.size >= cacheSize && !elementRefCache.current.has(id)) {
            // 最も古いエントリを削除（LRU的な動作）
            const firstKey = elementRefCache.current.keys().next().value as string;
            if (firstKey) {
                elementRefCache.current.delete(firstKey);
            }
        }
        elementRefCache.current.set(id, element);
    }, [cacheSize]);

    useEffect(() => {
        if (!enabled || !activeChunkIndex) {
            return;
        }

        const timer = setTimeout(() => {
            // キャッシュから検索
            let element = elementRefCache.current.get(activeChunkIndex);
            if (element) {
                elementRefCache.current.delete(activeChunkIndex);
                elementRefCache.current.set(activeChunkIndex, element);
            }

            if (!element) {
                // キャッシュミス: DOM検索
                element = document.querySelector(
                    `[data-audicle-id="${CSS.escape(activeChunkIndex)}"]`
                );

                if (element) {
                    setCachedElement(activeChunkIndex, element);
                }
            }

            if (!element) {
                console.warn(
                    `[useAutoScrollWithCache] チャンクが見つかりません: ${activeChunkIndex}`
                );
                return;
            }

            scrollElementIntoView(element, containerRef, activeChunkIndex);
        }, delay);

        return () => clearTimeout(timer);
    }, [activeChunkIndex, containerRef, enabled, delay, cacheSize, setCachedElement]);
}
