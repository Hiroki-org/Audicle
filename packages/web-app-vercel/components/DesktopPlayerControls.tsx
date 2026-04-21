import React from "react";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  ListPlus,
  ExternalLink,
  Download,
  Repeat,
  Repeat1,
  Shuffle,
} from "lucide-react";
import type { RepeatMode } from "@/contexts/PlaylistPlaybackContext";
import { zIndex } from "@/lib/zIndex";

const repeatModeLabels: Record<RepeatMode, string> = {
  off: "リピート: オフ",
  one: "リピート: 1曲",
  all: "リピート: 全曲",
};

export interface DesktopPlayerControlsProps {
  playbackRate: number;
  setIsSpeedModalOpen: (open: boolean) => void;
  playlistState: {
    isPlaylistMode: boolean;
    shuffle: boolean;
    repeatMode: RepeatMode;
  };
  toggleShuffle: () => void;
  isPlaylistContextReady: boolean;
  canMovePrevious: boolean;
  canMoveNext: boolean;
  navigateToPlaylistItem: (index: number) => void;
  wrapIndex: (index: number) => number;
  currentPlaylistIndex: number;
  isPlaying: boolean;
  play: () => void;
  pause: () => void;
  isPlaybackLoading: boolean;
  toggleRepeatMode: () => void;
  articleId: string | null;
  setIsPlaylistModalOpen: (open: boolean) => void;
  url: string;
  startDownload: () => void;
  downloadStatus: string;
}

export function DesktopPlayerControls({
  playbackRate,
  setIsSpeedModalOpen,
  playlistState,
  toggleShuffle,
  isPlaylistContextReady,
  canMovePrevious,
  canMoveNext,
  navigateToPlaylistItem,
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
}: DesktopPlayerControlsProps) {
  return (
    <div
      className={`hidden sm:flex sm:fixed sm:bottom-0 sm:left-0 sm:right-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 p-4 shadow-lg z-[${zIndex.desktopControls}]`}
      data-testid="audio-player-desktop"
    >
      <div className="max-w-4xl mx-auto flex items-center gap-4 px-2 sm:px-6">
        {/* 左側: 再生速度ダイアル */}
        <button
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
                onClick={toggleShuffle}
                className={`p-2 rounded-full transition-colors ${
                  playlistState.shuffle
                    ? "text-green-500 hover:bg-green-500/10"
                    : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                }`}
                data-testid="desktop-shuffle-button"
                title={
                  playlistState.shuffle
                    ? "シャッフル: オン"
                    : "シャッフル: オフ"
                }
                aria-label={
                  playlistState.shuffle
                    ? "シャッフル: オン"
                    : "シャッフル: オフ"
                }
              >
                <Shuffle className="size-5" />
              </button>
            )}

            {playlistState.isPlaylistMode && (
              <button
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

            {playlistState.isPlaylistMode && (
              <button
                onClick={toggleRepeatMode}
                className={`p-2 rounded-full transition-colors ${
                  playlistState.repeatMode !== "off"
                    ? "text-green-500 hover:bg-green-500/10"
                    : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                }`}
                data-testid="desktop-repeat-button"
                title={repeatModeLabels[playlistState.repeatMode]}
                aria-label={repeatModeLabels[playlistState.repeatMode]}
              >
                {playlistState.repeatMode === "one" ? (
                  <Repeat1 className="size-5" />
                ) : (
                  <Repeat className="size-5" />
                )}
              </button>
            )}
          </div>
        </div>

        {/* 右側: プレイリスト追加 + 元記事リンク・ダウンロード（アイコン化） */}
        <div className="flex items-center gap-1 sm:gap-2">
          {articleId && (
            <button
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
