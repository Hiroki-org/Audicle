import { zIndex } from "@/lib/zIndex";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  ListPlus,
  ExternalLink,
  Download,
} from "lucide-react";
import { ReaderControlsProps } from "@/types/reader";

export function ReaderDesktopControls({
  chunks,
  playbackRate,
  setIsSpeedModalOpen,
  playlistState,
  isPlaylistContextReady,
  canMovePrevious,
  canMoveNext,
  navigateToPlaylistItem,
  wrapIndex,
  currentPlaylistIndex,
  isPlaying,
  isPlaybackLoading,
  pause,
  play,
  articleId,
  setIsPlaylistModalOpen,
  url,
  downloadStatus,
  startDownload,
}: ReaderControlsProps) {
  if (chunks.length === 0) return null;

  return (
    <div
      className="hidden sm:flex sm:fixed sm:bottom-0 sm:left-0 sm:right-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 p-4 shadow-lg"
      style={{ zIndex: zIndex.desktopControls }}
      data-testid="audio-player-desktop"
    >
      <div className="max-w-4xl mx-auto flex items-center gap-4 px-2 sm:px-6">
        {/* 左側: 再生速度ダイアル */}
        <button
          type="button"
          onClick={() => setIsSpeedModalOpen(true)}
          className="flex items-center gap-1 px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
          data-testid="speed-button"
          title="再生速度を変更"
        >
          <span className="hidden sm:inline">{playbackRate.toFixed(1)}x</span>
        </button>

        {/* 中央: 再生/一時停止 (flex-1で中央) */}
        <div className="flex-1 flex items-center justify-center">
          <div className="flex items-center gap-3 sm:gap-4">
            {playlistState.isPlaylistMode && (
              <button
                type="button"
                onClick={() => {
                  if (isPlaylistContextReady && canMovePrevious) {
                    navigateToPlaylistItem(wrapIndex(currentPlaylistIndex - 1));
                  }
                }}
                disabled={!isPlaylistContextReady || !canMovePrevious}
                className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                data-testid="desktop-prev-button"
                title="前の記事"
                aria-label="前の記事"
              >
                <SkipBack className="size-5" />
              </button>
            )}

            <button
              type="button"
              onClick={isPlaying ? pause : play}
              disabled={isPlaybackLoading}
              className="w-12 h-12 p-0 bg-primary text-primary-foreground rounded-full hover:bg-primary/90 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center text-2xl"
              data-testid={
                isPlaybackLoading
                  ? "playback-loading"
                  : isPlaying
                    ? "pause-button"
                    : "play-button"
              }
              title={
                isPlaybackLoading
                  ? "処理中..."
                  : isPlaying
                    ? "一時停止"
                    : "再生"
              }
            >
              {isPlaying ? (
                <Pause className="size-5" />
              ) : (
                <Play className="size-5" />
              )}
            </button>

            {playlistState.isPlaylistMode && (
              <button
                type="button"
                onClick={() => {
                  if (isPlaylistContextReady && canMoveNext) {
                    navigateToPlaylistItem(wrapIndex(currentPlaylistIndex + 1));
                  }
                }}
                disabled={!isPlaylistContextReady || !canMoveNext}
                className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                data-testid="desktop-next-button"
                title="次の記事"
                aria-label="次の記事"
              >
                <SkipForward className="size-5" />
              </button>
            )}
          </div>
        </div>

        {/* 右側: プレイリスト追加 + 元記事リンク・ダウンロード（アイコン化） */}
        <div className="flex items-center gap-1 sm:gap-2">
          {articleId && (
            <button
              type="button"
              onClick={() => setIsPlaylistModalOpen(true)}
              className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
              data-testid="playlist-add-button"
              title="プレイリストに追加"
            >
              <ListPlus className="size-5" />
            </button>
          )}

          {url && (
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
              title="元記事を開く"
            >
              <ExternalLink className="size-5" />
            </a>
          )}
          {/* Desktop-only: full-article download button */}
          <button
            type="button"
            onClick={() => startDownload()}
            disabled={downloadStatus === "downloading"}
            className="hidden sm:inline-flex p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full disabled:opacity-50 transition-colors"
            title="記事をダウンロード"
            data-testid="download-button"
          >
            <Download className="size-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
