import { zIndex } from "@/lib/zIndex";
import { MobileArticleMenu } from "@/components/MobileArticleMenu";
import { Play, Pause, SkipBack, SkipForward, Plus } from "lucide-react";
import { ReaderControlsProps } from "@/types/reader";

export function ReaderMobileControls({
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
      className="sm:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 p-4 shadow-lg"
      style={{ zIndex: zIndex.mobileControls }}
      data-testid="audio-player"
    >
      <div className="flex items-center">
        {/* 左側: 再生速度ボタン */}
        <button
          type="button"
          onClick={() => setIsSpeedModalOpen(true)}
          className="flex items-center gap-1 px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
          data-testid="speed-button-mobile"
          title="再生速度を変更"
        >
          <span>{playbackRate.toFixed(1)}x</span>
        </button>

        {/* 中央: 再生停止ボタン (flex-1で中央を確保) */}
        <div className="flex-1 flex justify-center items-center">
          {/* Prev - Play - Next (center aligned) */}
          {playlistState.isPlaylistMode && (
            <button
              type="button"
              onClick={() => {
                if (isPlaylistContextReady && canMovePrevious) {
                  navigateToPlaylistItem(wrapIndex(currentPlaylistIndex - 1));
                }
              }}
              disabled={!isPlaylistContextReady || !canMovePrevious}
              className="mr-2 p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
            className="px-6 py-3 bg-primary text-primary-foreground rounded-full hover:bg-primary/90 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2 text-lg"
            data-testid={
              isPlaybackLoading
                ? "playback-loading"
                : isPlaying
                  ? "pause-button"
                  : "play-button"
            }
            title={
              isPlaybackLoading ? "処理中..." : isPlaying ? "一時停止" : "再生"
            }
          >
            {isPlaying ? (
              <Pause className="size-6" />
            ) : (
              <Play className="size-6" />
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
              className="ml-2 p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="次の記事"
              aria-label="次の記事"
            >
              <SkipForward className="size-5" />
            </button>
          )}
        </div>

        {/* 右側: プレイリスト追加ボタンとモバイルメニュー */}
        <div className="flex items-center gap-2">
          {articleId && (
            <button
              type="button"
              onClick={() => setIsPlaylistModalOpen(true)}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              data-testid="playlist-add-button"
              title="プレイリストに追加"
            >
              <Plus className="size-5 text-gray-600 dark:text-gray-400" />
            </button>
          )}

          {url && (
            <MobileArticleMenu
              articleUrl={url}
              onDownload={startDownload}
              isDownloading={downloadStatus === "downloading"}
            />
          )}
        </div>
      </div>
    </div>
  );
}
