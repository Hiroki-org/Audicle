"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import ReaderView from "@/components/ReaderView";
import { Chunk } from "@/types/api";
import { extractContent } from "@/lib/api";
import { usePlayback } from "@/hooks/usePlayback";
import { articleStorage } from "@/lib/storage";
import { logger } from "@/lib/logger";
import { Play, Pause } from "lucide-react";
import { cn } from "@/lib/utils";

export default function ReaderPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const articleId = searchParams.get("id");

  const [url, setUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [chunks, setChunks] = useState<Chunk[]>([]);
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");

  // 再生制御フック
  const {
    isPlaying,
    isLoading: isPlaybackLoading,
    error: playbackError,
    currentChunkId,
    play,
    pause,
    seekToChunk,
    playbackRate,
    setPlaybackRate,
  } = usePlayback({ chunks });

  // 記事IDが指定されている場合は読み込み
  useEffect(() => {
    if (articleId) {
      const article = articleStorage.getById(articleId);
      if (article) {
        logger.info("記事を読み込み", { id: articleId, title: article.title });
        setTitle(article.title);
        setChunks(article.chunks || []);
        setUrl(article.url);
      } else {
        logger.warn("記事が見つかりません", { id: articleId });
        setError("記事が見つかりませんでした");
      }
    }
  }, [articleId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const response = await extractContent(url);

      // chunksにIDを付与
      const chunksWithId: Chunk[] = response.chunks.map((text, index) => ({
        id: `chunk-${index}`,
        text,
      }));

      setChunks(chunksWithId);
      setTitle(response.title);

      // 記事を保存
      const newArticle = {
        id: Date.now().toString(),
        url,
        title: response.title,
        chunks: chunksWithId,
        createdAt: Date.now(),
      };
      articleStorage.add(newArticle);
      logger.success("記事を保存", {
        id: newArticle.id,
        title: newArticle.title,
      });

      // URLに記事URLを追加（idではなくurlを使う）
      router.push(`/reader?url=${encodeURIComponent(newArticle.url)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
      logger.error("記事の抽出に失敗", err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* ヘッダー: URL入力欄 */}
      <header className="sticky top-0 z-10 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <div className="max-w-4xl mx-auto p-4">
          <div className="flex items-center gap-4 mb-4">
            <button
              onClick={() => router.push("/")}
              className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
            >
              ← 記事一覧
            </button>
            <h1 className="text-2xl font-bold">Audicle</h1>
          </div>
          {title && (
            <h2 className="text-lg text-gray-600 dark:text-gray-400 mb-4">
              {title}
            </h2>
          )}
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="記事のURLを入力してください"
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isLoading}
              required
            />
            <button
              type="submit"
              disabled={isLoading}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? "読込中..." : "読込"}
            </button>
          </form>
          {error && (
            <div className="mt-2 text-red-600 dark:text-red-400 text-sm">
              {error}
            </div>
          )}
          {playbackError && (
            <div className="mt-2 text-red-600 dark:text-red-400 text-sm">
              {playbackError}
            </div>
          )}

          {/* 再生コントロールはモバイル (640px未満) では上部に表示、デスクトップでは下部に固定 */}
          {chunks.length > 0 && (
            <div className="sm:hidden mt-4 flex items-center gap-4">
              <div className="flex gap-2">
                <button
                  onClick={isPlaying ? pause : play}
                  disabled={isPlaybackLoading}
                  className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                >
                  {isPlaybackLoading
                    ? "処理中..."
                    : isPlaying
                    ? "一時停止"
                    : "再生"}
                </button>
              </div>
              <div className="flex items-center gap-2 ml-auto">
                <label
                  htmlFor="playback-rate"
                  className="text-sm text-gray-600 dark:text-gray-400"
                >
                  再生速度:
                </label>
                <input
                  id="playback-rate"
                  type="range"
                  min="0.8"
                  max="3.0"
                  step="0.1"
                  value={playbackRate}
                  onChange={(e) => setPlaybackRate(parseFloat(e.target.value))}
                  className="w-32"
                />
                <span className="text-sm text-gray-600 dark:text-gray-400 w-12">
                  {playbackRate.toFixed(1)}x
                </span>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* メインコンテンツ: リーダービュー */}
      <main className="flex-1 overflow-hidden pb-24 sm:pb-24">
        <ReaderView
          chunks={chunks}
          currentChunkId={currentChunkId}
          onChunkClick={seekToChunk}
        />
      </main>
      {chunks.length > 0 && (
        <DesktopAudioControls
          isPlaying={isPlaying}
          isPlaybackLoading={isPlaybackLoading}
          play={play}
          pause={pause}
          playbackRate={playbackRate}
          setPlaybackRate={setPlaybackRate}
        />
      )}
    </div>
  );
}

// デスクトップ版の下部固定コントロールバー（640px以上）
interface DesktopAudioControlsProps {
  isPlaying: boolean;
  isPlaybackLoading: boolean;
  play: () => void;
  pause: () => void;
  setPlaybackRate: (rate: number) => void;
  playbackRate: number;
}

function DesktopAudioControls({
  isPlaying,
  isPlaybackLoading,
  play,
  pause,
  setPlaybackRate,
  playbackRate,
}: DesktopAudioControlsProps) {
  return (
    <div className="hidden sm:flex sm:fixed sm:bottom-0 sm:left-0 sm:right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-4 shadow-lg z-40">
      <div className="max-w-3xl mx-auto flex items-center gap-4 px-4">
        <div className="flex items-center gap-2">
          <label
            htmlFor="playback-rate-desktop"
            className="text-sm text-gray-600 dark:text-gray-400"
          >
            速度:
          </label>
          <input
            id="playback-rate-desktop"
            type="range"
            min="0.8"
            max="3.0"
            step="0.1"
            value={playbackRate}
            onChange={(e) => setPlaybackRate(parseFloat(e.target.value))}
            className="w-24"
          />
          <span className="text-sm text-gray-600 dark:text-gray-400 w-12">
            {playbackRate.toFixed(1)}x
          </span>
        </div>

        <div className="flex-1 flex justify-center items-center">
          <button
            onClick={isPlaying ? pause : play}
            disabled={isPlaybackLoading}
            className={cn(
              "w-12 h-12 p-0 rounded-full flex items-center justify-center text-2xl transition-colors",
              "bg-green-600 text-white",
              "hover:bg-green-700",
              "disabled:bg-gray-400 disabled:cursor-not-allowed",
              isPlaybackLoading && "opacity-50"
            )}
            title={
              isPlaybackLoading ? "処理中..." : isPlaying ? "一時停止" : "再生"
            }
          >
            {isPlaying ? (
              <Pause className="size-5" />
            ) : (
              <Play className="size-5" />
            )}
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* プレイリストやメニューは現在のweb-appでは未実装 */}
        </div>
      </div>
    </div>
  );
}
