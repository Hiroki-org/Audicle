import React from "react";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Plus,
  Repeat,
  Repeat1,
  Shuffle,
} from "lucide-react";
import type { RepeatMode } from "@/contexts/PlaylistPlaybackContext";
import { zIndex } from "@/lib/zIndex";
import { MobileArticleMenu } from "@/components/MobileArticleMenu";

const repeatModeLabels: Record<RepeatMode, string> = {
  off: "リピート: オフ",
  one: "リピート: 1曲",
  all: "リピート: 全曲",
};

export interface MobilePlayerControlsProps {
  playbackRate: number;
  setIsSpeedModalOpen: (_open: boolean) => void;
  playlistState: {
    isPlaylistMode: boolean;
    shuffle: boolean;
    repeatMode: RepeatMode;
  };
  toggleShuffle: () => void;
  isPlaylistContextReady: boolean;
  canMovePrevious: boolean;
  canMoveNext: boolean;
  getPlaylistItemHref: (_index: number) => string | undefined;
  wrapIndex: (_index: number) => number;
  currentPlaylistIndex: number;
  isPlaying: boolean;
  play: () => void;
  pause: () => void;
  isPlaybackLoading: boolean;
  toggleRepeatMode: () => void;
  articleId: string | null;
  setIsPlaylistModalOpen: (_open: boolean) => void;
  url: string;
  startDownload: () => void;
  downloadStatus: string;
}

export function MobilePlayerControls({
  playbackRate,
  setIsSpeedModalOpen,
  playlistState,
  toggleShuffle,
  isPlaylistContextReady,
  canMovePrevious,
  canMoveNext,
  getPlaylistItemHref,
  wrapIndex,
  currentPlaylistIndex,
  isPlaying,
  play,
  pause,
  isPlaybackLoading,
  toggleRepeatMode,
  articleId,
  setIsPlaylistModalOpen,
  url,
  startDownload,
  downloadStatus,
}: MobilePlayerControlsProps) {
  const previousIndex = wrapIndex(currentPlaylistIndex - 1);
  const nextIndex = wrapIndex(currentPlaylistIndex + 1);
  const previousHref = getPlaylistItemHref(previousIndex);
  const nextHref = getPlaylistItemHref(nextIndex);
  const isPreviousDisabled =
    !isPlaylistContextReady || !canMovePrevious || !previousHref;
  const isNextDisabled = !isPlaylistContextReady || !canMoveNext || !nextHref;

  return (
    <div
      className={`sm:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 p-4 shadow-lg z-[${zIndex.mobileControls}]`}
      data-testid="audio-player"
    >
      <div className="flex items-center">
        {/* 左側: 再生速度ボタン */}
        <button
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
              onClick={toggleShuffle}
              className={`p-2 rounded-full transition-colors ${
                playlistState.shuffle
                  ? "text-green-500 hover:bg-green-500/10"
                  : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
              }`}
              data-testid="mobile-shuffle-button"
              title={
                playlistState.shuffle ? "シャッフル: オン" : "シャッフル: オフ"
              }
              aria-label={
                playlistState.shuffle ? "シャッフル: オン" : "シャッフル: オフ"
              }
            >
              <Shuffle className="size-4" />
            </button>
          )}

          {playlistState.isPlaylistMode && (
            <a
              href={previousHref || "#"}
              onClick={(event) => {
                if (isPreviousDisabled) event.preventDefault();
              }}
              aria-disabled={isPreviousDisabled}
              tabIndex={isPreviousDisabled ? -1 : undefined}
              className={`mr-2 p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors ${
                isPreviousDisabled ? "opacity-50 cursor-not-allowed" : ""
              }`}
              title="前の記事"
              aria-label="前の記事"
            >
              <SkipBack className="size-5" />
            </a>
          )}

          <button
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
            <a
              href={nextHref || "#"}
              onClick={(event) => {
                if (isNextDisabled) event.preventDefault();
              }}
              aria-disabled={isNextDisabled}
              tabIndex={isNextDisabled ? -1 : undefined}
              className={`ml-2 p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors ${
                isNextDisabled ? "opacity-50 cursor-not-allowed" : ""
              }`}
              title="次の記事"
              aria-label="次の記事"
            >
              <SkipForward className="size-5" />
            </a>
          )}

          {playlistState.isPlaylistMode && (
            <button
              onClick={toggleRepeatMode}
              className={`p-2 rounded-full transition-colors ${
                playlistState.repeatMode !== "off"
                  ? "text-green-500 hover:bg-green-500/10"
                  : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
              }`}
              data-testid="mobile-repeat-button"
              title={repeatModeLabels[playlistState.repeatMode]}
              aria-label={repeatModeLabels[playlistState.repeatMode]}
            >
              {playlistState.repeatMode === "one" ? (
                <Repeat1 className="size-4" />
              ) : (
                <Repeat className="size-4" />
              )}
            </button>
          )}
        </div>

        {/* 右側: プレイリスト追加ボタンとモバイルメニュー */}
        <div className="flex items-center gap-2">
          {articleId && (
            <button
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
