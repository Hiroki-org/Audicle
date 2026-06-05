// packages/web-app-vercel/app/page.tsx

"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useQueryClient } from "@tanstack/react-query";
import { logger } from "@/lib/logger";
import { useConfirmDialog } from "@/components/ConfirmDialog";
import { useDefaultPlaylistItems } from "@/lib/hooks/useDefaultPlaylistItems";
import { useRemoveFromPlaylistMutation } from "@/lib/hooks/usePlaylists";
import { PlaylistSelectorModal } from "@/components/PlaylistSelectorModal";
import { ArticleCard } from "@/components/ArticleCard";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, RotateCcw } from "lucide-react";
import Sidebar from "@/components/Sidebar";
import { STORAGE_KEYS } from "@/lib/constants";
import type { PlaylistItemWithArticle } from "@/types/playlist";
import { getArticlesCache } from "@/lib/local-cache";
import { ArticleListSkeleton } from "@/components/ArticleListSkeleton";

const ARTICLE_SORT_BY_OPTIONS = [
  "newest",
  "oldest",
  "title",
  "title-desc",
] as const;
type ArticleSortBy = (typeof ARTICLE_SORT_BY_OPTIONS)[number];

// 追加: localStorage key定義
const HOME_SORT_KEY = STORAGE_KEYS.HOME_SORT;

export default function Home() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const userId = session?.user?.email;
  const cachedPlaylist = useMemo(() => {
    if (!userId) return null;
    return getArticlesCache(userId);
  }, [userId]);
  const { data: fetchedPlaylistData, isLoading, error } = useDefaultPlaylistItems();
  const playlistData = fetchedPlaylistData || cachedPlaylist;
  const removeFromPlaylistMutation = useRemoveFromPlaylistMutation();

  const [sortBy, setSortBy] = useState<ArticleSortBy>(() => {
    if (typeof window === "undefined") return "newest";
    const saved = localStorage.getItem(HOME_SORT_KEY);
    return saved &&
      (ARTICLE_SORT_BY_OPTIONS as readonly string[]).includes(saved)
      ? (saved as ArticleSortBy)
      : "newest";
  });
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [isPlaylistModalOpen, setIsPlaylistModalOpen] = useState(false);

  const { items = [], playlistId, playlistName } = playlistData ?? {};

  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => {
      switch (sortBy) {
        case "newest":
          return (
            new Date(b.added_at).getTime() - new Date(a.added_at).getTime()
          );
        case "oldest":
          return (
            new Date(a.added_at).getTime() - new Date(b.added_at).getTime()
          );
        case "title":
          return (a.article?.title || "").localeCompare(b.article?.title || "");
        case "title-desc":
          return (b.article?.title || "").localeCompare(a.article?.title || "");
        default:
          return 0;
      }
    });
  }, [items, sortBy]);

  // 追加: sortBy変更時にlocalStorageに保存
  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(HOME_SORT_KEY, sortBy);
  }, [sortBy]);

  const selectedItem = useMemo(
    () => items.find((item) => item.article_id === selectedItemId),
    [items, selectedItemId]
  );

  const { showConfirm, confirmDialog } = useConfirmDialog();

  const handleRefresh = useCallback(() => {
    queryClient.invalidateQueries({
      queryKey: ["defaultPlaylist", "items"],
    });
  }, [queryClient]);

  const handleRemoveFromHome = useCallback(
    async (itemId: string) => {
      const item = items.find((i) => i.id === itemId);
      if (!item || !playlistId) return;

      const confirmed = await showConfirm({
        title: "ホームから除く",
        message: `「${item.article?.title}」をホームから除きますか?\n\n他のプレイリストには残ります。`,
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
          logger.success("アイテムを削除", {
            itemId,
            title: item.article?.title || "",
          });
        } catch (error) {
          logger.error("アイテムの削除に失敗", error);
        }
      }
    },
    [items, playlistId, showConfirm, removeFromPlaylistMutation]
  );

  const handleArticleClick = useCallback(
    (item: PlaylistItemWithArticle) => {
      if (item.article?.url) {
        router.push(`/reader?url=${encodeURIComponent(item.article.url)}`);
      }
    },
    [router]
  );

  const handlePlaylistAdd = useCallback((id: string) => {
    setSelectedItemId(id);
    setIsPlaylistModalOpen(true);
  }, []);

  const handleModalClose = useCallback(() => {
    setIsPlaylistModalOpen(false);
    setSelectedItemId(null);
  }, []);

  const handlePlaylistsUpdated = useCallback(async () => {
    handleRefresh();
  }, [handleRefresh]);

  return (
    <div className="h-screen bg-black text-white flex flex-col lg:flex-row">
      <Sidebar />

      <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gradient-to-b from-zinc-900 to-black">
        <div className="p-4 sm:p-6 lg:p-8">
          {confirmDialog}

          {selectedItem && selectedItemId && (
            <PlaylistSelectorModal
              isOpen={isPlaylistModalOpen}
              onClose={handleModalClose}
              itemId={undefined}
              articleId={selectedItem.article_id}
              articleTitle={selectedItem.article?.title || ""}
              onPlaylistsUpdated={handlePlaylistsUpdated}
            />
          )}

          {/* Page Header */}
          <div className="mb-6 lg:mb-8">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-4">
                <h2 className="text-2xl lg:text-3xl font-bold">記事一覧</h2>
                <Select
                  value={sortBy}
                  onValueChange={(value) => setSortBy(value as ArticleSortBy)}
                >
                  <SelectTrigger
                    data-testid="home-sort-select"
                    className="w-[140px]"
                  >
                    <SelectValue placeholder="ソート" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">新しい順</SelectItem>
                    <SelectItem value="oldest">古い順</SelectItem>
                    <SelectItem value="title">タイトル順 (A-Z)</SelectItem>
                    <SelectItem value="title-desc">タイトル順 (Z-A)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={handleRefresh}
                variant="ghost"
                size="icon"
                title="手動更新"
                className="text-zinc-400 hover:text-white hover:bg-zinc-800"
              >
                <RotateCcw className="h-5 w-5" />
              </Button>
            </div>
            <p className="text-sm lg:text-base text-zinc-400">
              {playlistName
                ? `${playlistName}内の記事の一覧です`
                : "読み込んだ記事の一覧です"}
            </p>
          </div>

          {/* Content */}
          {isLoading && !playlistData ? (
            <ArticleListSkeleton />
          ) : error && !playlistData ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">⚠️</div>
              <h3 className="text-xl font-semibold text-white mb-2">
                エラーが発生しました
              </h3>
              <p className="text-zinc-400 mb-6">
                {error instanceof Error
                  ? error.message
                  : "記事の読み込みに失敗しました"}
              </p>
              <Button onClick={handleRefresh}>
                <RotateCcw className="size-4 mr-2" />
                再試行
              </Button>
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">📚</div>
              <h3 className="text-xl font-semibold text-white mb-2">
                記事がありません
              </h3>
              <p className="text-zinc-400 mb-6">
                新しい記事を読み込んでみましょう
              </p>
              <Button onClick={() => router.push("/reader")}>
                <Plus className="size-4 mr-2" />
                新しい記事を読む
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:gap-8">
              {sortedItems.map((item) => (
                <ArticleCard
                  key={item.id}
                  item={item}
                  onArticleClick={handleArticleClick}
                  onPlaylistAdd={handlePlaylistAdd}
                  onRemove={handleRemoveFromHome}
                />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
