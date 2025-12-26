import { PlaylistPlaybackState } from "@/contexts/PlaylistPlaybackContext";
import { Chunk } from "@/types/api";
import { Playlist } from "@/types/playlist";
import { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { ExternalLink, ListPlus } from "lucide-react";
import { zIndex } from "@/lib/zIndex";

interface ReaderHeaderProps {
  isPlaylistMode: boolean;
  playlistState: PlaylistPlaybackState;
  router: AppRouterInstance;
  stop: () => void;
  title: string;
  chunks: Chunk[];
  url: string;
  setUrl: (url: string) => void;
  isLoading: boolean;
  handleSubmit: (e: React.FormEvent) => void;
  selectedPlaylistId: string;
  setSelectedPlaylistId: (id: string) => void;
  playlists: Playlist[];
  error: string;
  playbackError: string;
  isClient: boolean;
}

export function ReaderHeader({
  isPlaylistMode,
  playlistState,
  router,
  stop,
  title,
  chunks,
  url,
  setUrl,
  isLoading,
  handleSubmit,
  selectedPlaylistId,
  setSelectedPlaylistId,
  playlists,
  error,
  playbackError,
  isClient,
}: ReaderHeaderProps) {
  return (
    <header className="sticky top-0 z-10 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
      <div className="max-w-4xl mx-auto p-3 sm:p-6">
        {/* トップバー: ナビゲーションとタイトル */}
        <div className="relative flex items-center justify-center gap-2 mb-2">
          <button
            type="button"
            onClick={() => {
              stop(); // ページ遷移前に再生を停止
              if (isPlaylistMode && playlistState.playlistId) {
                router.push(`/playlists/${playlistState.playlistId}`);
              } else {
                router.push("/");
              }
            }}
            className="absolute left-0 px-2 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors shrink-0"
          >
            ← {isPlaylistMode ? "プレイリストに戻る" : "記事一覧"}
          </button>
          <h1 className="text-lg sm:text-2xl font-bold">Audicle</h1>
        </div>

        {/* 記事タイトル: ellipsisで1行に省略 */}
        {title && (
          <h2
            className="text-sm sm:text-lg text-gray-600 dark:text-gray-400 mb-2 truncate"
            title={title}
            data-testid="article-title"
          >
            {title}
          </h2>
        )}

        {/* URL入力フォーム: チャンクがない場合のみ表示 */}
        {chunks.length === 0 && (
          <form onSubmit={handleSubmit} className="flex flex-col gap-2">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="記事のURLを入力してください"
              className="flex-1 px-3 sm:px-4 py-1.5 sm:py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isLoading}
              required
              data-testid="url-input"
            />

            <div className="flex gap-2 items-center">
              <label
                htmlFor="playlist-select"
                className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap"
              >
                追加先:
              </label>
              <select
                id="playlist-select"
                value={selectedPlaylistId}
                onChange={(e) => setSelectedPlaylistId(e.target.value)}
                className="flex-1 px-2 sm:px-4 py-1.5 sm:py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isLoading || playlists.length === 0}
              >
                {playlists.map((playlist) => (
                  <option key={playlist.id} value={playlist.id}>
                    {playlist.is_default ? "📌 " : ""}
                    {playlist.name}
                  </option>
                ))}
              </select>

              <button
                type="submit"
                disabled={isLoading}
                className="px-4 sm:px-6 py-1.5 sm:py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors shrink-0"
                data-testid="extract-button"
              >
                {isLoading ? "読込中" : "読込"}
              </button>
            </div>
          </form>
        )}

        {error && (
          <div className="mt-2 text-red-600 dark:text-red-400 text-xs sm:text-sm">
            {error}
          </div>
        )}
        {playbackError && (
          <div className="mt-2 text-red-600 dark:text-red-400 text-xs sm:text-sm">
            {playbackError}
          </div>
        )}
        {/* プレイリスト再生情報: コンパクト化 */}
        {playlistState.isPlaylistMode && isClient && (
          <div className="mt-2 bg-primary/10 p-2 sm:p-3 rounded-lg border border-primary/50">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-xs text-zinc-400 truncate">
                  {playlistState.playlistName}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
