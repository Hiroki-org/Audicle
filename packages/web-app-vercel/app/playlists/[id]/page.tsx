"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { Play, ArrowUpDown } from "lucide-react";
import { createReaderUrl } from "@/lib/urlBuilder";
import { logger } from "@/lib/logger";
import { STORAGE_KEYS } from "@/lib/constants";
import { setPlaylistSortKey } from "@/lib/playlist-utils";
import { useConfirmDialog } from "@/components/ConfirmDialog";
import { usePlaylistPlayback } from "@/contexts/PlaylistPlaybackContext";
import {
  usePlaylistDetail,
  useUpdatePlaylistMutation,
  useRemoveFromPlaylistMutation,
} from "@/lib/hooks/usePlaylists";
import { ArticleCard } from "@/components/ArticleCard";
import { PlaylistSelectorModal } from "@/components/PlaylistSelectorModal";
import Sidebar from "@/components/Sidebar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PlaylistItemWithArticle } from "@/types/playlist";

const SORT_OPTIONS = {
  position: "位置順",
  title: "タイトル順 (A-Z)",
  "title-desc": "タイトル順 (Z-A)",
  added_at: "追加日時順 (古い順)",
  "added_at-desc": "追加日時順 (新しい順)",
} as const;

type SortOption = keyof typeof SORT_OPTIONS;

// 型ガード関数
function isSortOption(value: string): value is SortOption {
  return value in SORT_OPTIONS;
}

export default function PlaylistDetailPage() {
  const router = useRouter();
  const params = useParams();
  const playlistId = params.id as string;
  const { startPlaylistPlayback } = usePlaylistPlayback();

  const { data: playlist, isLoading, error } = usePlaylistDetail(playlistId);
  const updatePlaylistMutation = useUpdatePlaylistMutation();
  const removeFromPlaylistMutation = useRemoveFromPlaylistMutation();

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [isPlaylistModalOpen, setIsPlaylistModalOpen] = useState(false);
  const [selectedArticleId, setSelectedArticleId] = useState<string>("");
  const [selectedArticleTitle, setSelectedArticleTitle] = useState<string>("");
  // 追加: 初期値をlocalStorageから復元
  const [sortOption, setSortOption] = useState<SortOption>(() => {
    if (typeof window === "undefined") return "position";
    const saved = localStorage.getItem(
      `${STORAGE_KEYS.PLAYLIST_SORT_PREFIX}${playlistId}`
    );
    return saved && isSortOption(saved) ? saved : "position";
  });
  const { showConfirm, confirmDialog } = useConfirmDialog();

  const sortedItems = useMemo(() => {
    if (!playlist?.items) return [];

    return [...playlist.items].sort((a, b) => {
      switch (sortOption) {
        case "position":
          return (a.position ?? 0) - (b.position ?? 0);
        case "title":
          return (a.article?.title || "").localeCompare(b.article?.title || "");
        case "title-desc":
          return (b.article?.title || "").localeCompare(a.article?.title || "");
        case "added_at":
          return a.added_at.localeCompare(b.added_at);
        case "added_at-desc":
          return b.added_at.localeCompare(a.added_at);
        default:
          return 0;
      }
    });
  }, [playlist?.items, sortOption]);

  // playlistが読み込まれたら編集フィールドを初期化
  useEffect(() => {
    if (playlist && !isEditing) {
      setEditName(playlist.name);
      setEditDescription(playlist.description || "");
    }
  }, [playlist, isEditing]);

  // 追加: sortOption変更時にlocalStorageに保存
  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(
      `${STORAGE_KEYS.PLAYLIST_SORT_PREFIX}${playlistId}`,
      sortOption
    );
  }, [sortOption, playlistId]);

  const handleSave = async () => {
    if (!playlist) return;

    try {
      await updatePlaylistMutation.mutateAsync({
        playlistId: playlist.id,
        name: editName,
        description: editDescription,
      });
      logger.success("プレイリストを更新", {
        id: playlist.id,
        name: editName,
      });
      setIsEditing(false);
    } catch (error) {
      logger.error("プレイリストの更新に失敗", error);
    }
  };

  const handleRemoveFromPlaylist = useCallback(
    async (itemId: string) => {
      const item = playlist?.items?.find((i) => i.id === itemId);
      const title = item?.article?.title || "";

      const confirmed = await showConfirm({
        title: "プレイリストから除く",
        message: `「${title}」を「${playlist?.name}」から除きますか?\n\n他のプレイリストには残ります。`,
        confirmText: "除く",
        cancelText: "キャンセル",
        isDangerous: false,
      });

      if (confirmed) {
        try {
          await removeFromPlaylistMutation.mutateAsync({
            playlistId,
            itemId,
          });
          logger.success("アイテムをプレイリストから削除", { itemId, title });
        } catch (error) {
          logger.error("アイテムの削除に失敗", error);
        }
      }
    },
    [
      playlist?.items,
      playlist?.name,
      playlistId,
      showConfirm,
      removeFromPlaylistMutation,
    ]
  );

  const handlePlaylistAdd = useCallback(
    (articleId: string) => {
      const item = playlist?.items?.find((item) => item.article_id === articleId);
      if (item) {
        setSelectedArticleId(articleId);
        setSelectedArticleTitle(item.article?.title || "");
        setIsPlaylistModalOpen(true);
      }
    },
    [playlist?.items]
  );

  const handleArticleClick = useCallback(
    (playlistItem: PlaylistItemWithArticle) => {
      if (playlistItem.article?.url && playlist?.id) {
        // Find the index in sortedItems
        const index = sortedItems.findIndex(
          (item) => item.id === playlistItem.id
        );
        router.push(
          createReaderUrl({
            articleUrl: playlistItem.article.url,
            playlistId: playlist.id,
            playlistIndex: index >= 0 ? index : 0,
            autoplay: true,
          })
        );
      }
    },
    [router, playlist?.id, sortedItems]
  );

  if (isLoading) {
    return (
      <div className="h-screen bg-black text-white flex flex-col lg:flex-row">
        <Sidebar />
        <main className="flex-1 flex items-center justify-center overflow-y-auto bg-gradient-to-b from-zinc-900 to-black">
          <p className="text-zinc-400">読み込み中...</p>
        </main>
      </div>
    );
  }

  if (error || !playlist) {
    return (
      <div className="h-screen bg-black text-white flex flex-col lg:flex-row">
        <Sidebar />
        <main className="flex-1 flex items-center justify-center overflow-y-auto bg-gradient-to-b from-zinc-900 to-black">
          <div className="text-center">
            <div className="text-6xl mb-4">⚠️</div>
            <p className="text-zinc-400 mb-6">
              {error instanceof Error
                ? error.message
                : "プレイリストの読み込みに失敗しました"}
            </p>
            <button
              onClick={() => router.back()}
              className="text-primary/70 hover:text-primary/80"
            >
              ← 戻る
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="h-screen bg-black text-white flex flex-col lg:flex-row">
      <Sidebar />

      <main className="flex-1 overflow-y-auto bg-gradient-to-b from-zinc-900 to-black">
        <div className="p-4 sm:p-6 lg:p-8">
          {confirmDialog}

          {/* Page Header */}
          <div className="mb-6 lg:mb-8">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <h2 className="text-2xl lg:text-3xl font-bold">
                  {playlist.name}
                </h2>
                {playlist.is_default && (
                  <span className="px-2 py-1 text-xs bg-primary/20 text-primary/80 rounded">
                    デフォルト
                  </span>
                )}
              </div>
              {!playlist.is_default && !isEditing && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="px-4 py-2 text-sm text-zinc-400 hover:bg-zinc-800 rounded transition-colors"
                >
                  編集
                </button>
              )}
            </div>
            <p className="text-sm lg:text-base text-zinc-400">
              {playlist.description || `${playlist.item_count || 0} 件の記事`}
            </p>
          </div>

          {isEditing && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 space-y-3 mb-6">
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full px-4 py-2 border border-zinc-700 rounded-lg bg-zinc-800 focus:ring-2 focus:ring-primary focus:border-transparent"
                required
              />
              <textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                className="w-full px-4 py-2 border border-zinc-700 rounded-lg bg-zinc-800 focus:ring-2 focus:ring-primary focus:border-transparent"
                rows={3}
                placeholder="説明（省略可）"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleSave}
                  disabled={updatePlaylistMutation.isPending}
                  className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:bg-zinc-700 transition-colors"
                >
                  {updatePlaylistMutation.isPending ? "保存中..." : "保存"}
                </button>
                <button
                  onClick={() => {
                    setIsEditing(false);
                    setEditName(playlist.name);
                    setEditDescription(playlist.description || "");
                  }}
                  className="px-4 py-2 text-zinc-400 hover:bg-zinc-800 rounded-lg transition-colors"
                >
                  キャンセル
                </button>
              </div>
            </div>
          )}

          {/* Controls Row (sort and play) when not editing */}
          {!isEditing && playlist.items && playlist.items.length > 0 && (
            <div className="flex items-center justify-end gap-3 mb-6">
              <div className="flex items-center gap-2">
                <ArrowUpDown className="size-4 text-zinc-400" />
                <Select
                  value={sortOption}
                  onValueChange={(value) => {
                    if (isSortOption(value)) {
                      setSortOption(value);
                      // 即座にlocalStorageに保存（useEffectによる保存より前にナビゲーションが発生する可能性があるため）
                      setPlaylistSortKey(playlistId, value);
                    }
                  }}
                >
                  <SelectTrigger
                    data-testid="playlist-sort-select"
                    className="w-32"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(SORT_OPTIONS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <button
                onClick={() => {
                  const firstArticleUrl =
                    sortedItems && sortedItems.length > 0
                      ? sortedItems[0].article?.url
                      : undefined;

                  router.push(
                    createReaderUrl({
                      articleUrl: firstArticleUrl,
                      playlistId: playlist.id,
                      playlistIndex: 0,
                      autoplay: true,
                    })
                  );
                }}
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-2 whitespace-nowrap"
              >
                <Play className="size-4" />
                再生
              </button>
            </div>
          )}

          {/* Content */}
          {!playlist.items || playlist.items.length === 0 ? (
            <div className="text-center py-12 text-zinc-400">
              <p>まだ記事がありません</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:gap-8">
              {sortedItems.map((item, index) => (
                <ArticleCard
                  key={item.id}
                  item={item}
                  onArticleClick={handleArticleClick}
                  href={
                    item.article?.url
                      ? createReaderUrl({
                          articleUrl: item.article.url,
                          playlistId: playlist.id,
                          playlistIndex: index,
                          autoplay: false,
                        })
                      : undefined
                  }
                  onPlaylistAdd={handlePlaylistAdd}
                  onRemove={handleRemoveFromPlaylist}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      <PlaylistSelectorModal
        isOpen={isPlaylistModalOpen}
        onClose={() => setIsPlaylistModalOpen(false)}
        articleId={selectedArticleId}
        articleTitle={selectedArticleTitle}
        onPlaylistsUpdated={async () => {
          // 必要に応じてプレイリストを再読み込み
        }}
      />
    </div>
  );
}
