"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { useAutoScroll } from "@/hooks/useAutoScroll";
import { useDownload } from "@/hooks/useDownload";
import { cn } from "@/lib/utils";
import { Chunk } from "@/types/api";
import { logger } from "@/lib/logger";
import ReaderChunk from "./ReaderChunk";
import DownloadPanel from "./DownloadPanel";

interface ReaderViewProps {
  chunks?: Chunk[];
  currentChunkId?: string;
  articleUrl?: string;
  voiceModel?: string;
  speed?: number;
  onChunkClick?: (chunkId: string) => void;
}


function getDownloadButtonLabel(status: string): string {
  switch (status) {
    case "downloading":
      return "音声を準備中...";
    case "error":
      return "再試行";
    case "cancelled":
      return "もう一度ダウンロード";
    default:
      return "全文をダウンロード";
  }
}

export default function ReaderView({
  chunks = [],
  currentChunkId,
  articleUrl = "",
  voiceModel,
  speed,
  onChunkClick,
}: ReaderViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [gradientState, setGradientState] = useState({
    top: false,
    bottom: false,
    enabled: false,
  });
  const [chunkListPaddingBottom, setChunkListPaddingBottom] = useState(0);

  const chunkCount = chunks.length;
  const chunkSignature = useMemo(
    () => chunks.map((chunk) => chunk.id).join("|"),
    [chunks]
  );

  useEffect(() => {
    if (!articleUrl) return;
    logger.info("ReaderView received articleUrl", {
      articleUrl,
      chunkCount,
    });
  }, [articleUrl, chunkCount]);

  // ダウンロード機能
  const {
    status: downloadStatus,
    progress,
    error: downloadError,
    estimatedTime,
    startDownload,
    cancelDownload,
  } = useDownload({
    articleUrl,
    chunks,
    voiceModel,
    speed,
  });

  // 自動スクロール: 再生中のチャンクが変わったら画面中央にスクロール
  // Chrome拡張版と同等の動作を提供
  useAutoScroll({
    activeChunkIndex: currentChunkId,
    containerRef,
    enabled: true,
    delay: 0,
  });

  // Keep gradient overlays and padding in sync with scroll position and container size
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const MIN_SPACER_PX = 120;

    const updateGradientState = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const hasOverflow = scrollHeight - clientHeight > 4;
      if (!hasOverflow) {
        setGradientState((prev) =>
          prev.enabled ? { top: false, bottom: false, enabled: false } : prev
        );
        return;
      }

      const epsilon = 4;
      const nextState = {
        top: scrollTop > epsilon,
        bottom: scrollTop + clientHeight < scrollHeight - epsilon,
        enabled: true,
      };

      setGradientState((prev) =>
        prev.top === nextState.top &&
        prev.bottom === nextState.bottom &&
        prev.enabled === nextState.enabled
          ? prev
          : nextState
      );
    };

    const updatePadding = () => {
      const nextPadding = Math.max(
        Math.round(container.clientHeight / 2),
        MIN_SPACER_PX
      );
      setChunkListPaddingBottom((prev) =>
        prev === nextPadding ? prev : nextPadding
      );
    };

    const handleResize = () => {
      updateGradientState();
      updatePadding();
    };

    updateGradientState();
    updatePadding();

    const resizeObserver =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(handleResize)
        : undefined;

    // Scroll optimization: Throttle scroll event updates using requestAnimationFrame
    // to prevent excessive reflows and main thread blocking during scrolling.
    let ticking = false;
    let rafId: number;

    const onScroll = () => {
      if (!ticking) {
        rafId = window.requestAnimationFrame(() => {
          updateGradientState();
          ticking = false;
        });
        ticking = true;
      }
    };

    container.addEventListener("scroll", onScroll, {
      passive: true,
    });
    resizeObserver?.observe(container);

    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
      container.removeEventListener("scroll", onScroll);
      resizeObserver?.disconnect();
    };
  }, [chunkSignature]);

  const downloadButtonLabel = useMemo(() => getDownloadButtonLabel(downloadStatus), [downloadStatus]);

  return (
    <div
      ref={containerRef}
      className="h-full overflow-y-auto bg-black px-4 py-8"
    >
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        {chunks.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-800 bg-zinc-900 px-10 py-16 text-center">
            <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-zinc-800 text-2xl">
              📖
            </div>
            <h2 className="mt-6 text-2xl font-semibold">
              読み上げたい記事のURLを入力してください
            </h2>
            <p className="mt-4 text-sm text-zinc-400">
              記事を解析して、読みやすいチャンクに分割したビューと音声ダウンロード機能を提供します。
            </p>
            <p className="mt-2 text-xs text-zinc-500">
              プレイリストや設定は右上のメニューから引き続き利用できます。
            </p>
          </div>
        ) : (
          <>
            <DownloadPanel
              status={downloadStatus}
              progress={progress}
              error={downloadError}
              estimatedTime={estimatedTime}
              onCancel={cancelDownload}
            />

            <section className="relative overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900">
              <div
                aria-hidden="true"
                className={cn(
                  "pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-zinc-900 via-transparent to-transparent transition-opacity duration-300",
                  gradientState.enabled && gradientState.top
                    ? "opacity-100"
                    : "opacity-0"
                )}
              />
              <div
                aria-hidden="true"
                className={cn(
                  "pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-zinc-900 via-transparent to-transparent transition-opacity duration-300",
                  gradientState.enabled && gradientState.bottom
                    ? "opacity-100"
                    : "opacity-0"
                )}
              />
              <div
                className="space-y-3 sm:space-y-4"
                style={{
                  paddingBottom: chunkListPaddingBottom
                    ? `${chunkListPaddingBottom}px`
                    : undefined,
                }}
              >
                {chunks.map((chunk) => (
                  <ReaderChunk
                    key={chunk.id}
                    chunk={chunk}
                    isActive={chunk.id === currentChunkId}
                    onClick={onChunkClick}
                  />
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
