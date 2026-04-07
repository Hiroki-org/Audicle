"use client";

import { useState, useEffect, useMemo } from "react";
import { logger } from "@/lib/logger";
import { usePlaylists } from "@/lib/hooks/usePlaylists";
import {
  usePlaylistItemPlaylists,
  useUpdateArticlePlaylistsMutation,
  useArticlePlaylists,
} from "@/lib/hooks/usePlaylistSelection";

interface PlaylistSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  itemId?: string;
  articleId: string;
  articleTitle: string;
  onPlaylistsUpdated?: () => Promise<void>;
}

export function PlaylistSelectorModal({
  isOpen,
  onClose,
  itemId,
  articleId,
  articleTitle,
  onPlaylistsUpdated,
}: PlaylistSelectorModalProps) {
  const { data: allPlaylists = [], isLoading: isLoadingPlaylists } =
    usePlaylists();

  // 両方のHooksを常に呼び出す（React Hooksルール）が、enabled オプションで制御
  const {
    data: playlistsByItemId,
    isLoading: isLoadingItemId,
    error: errorItemId,
  } = usePlaylistItemPlaylists(itemId || "", { enabled: !!itemId });

  const {
    data: playlistsByArticleId,
    isLoading: isLoadingArticleId,
    error: errorArticleId,
  } = useArticlePlaylists(articleId, { enabled: !itemId && !!articleId });

  // 結果を安全に選択（デフォルト値付き）
  const currentPlaylists = useMemo(
    () => (itemId ? playlistsByItemId || [] : playlistsByArticleId || []),
    [itemId, playlistsByItemId, playlistsByArticleId]
  );

  const isLoadingCurrent = itemId ? isLoadingItemId : isLoadingArticleId;
  const currentError = itemId ? errorItemId : errorArticleId;
  const updateMutation = useUpdateArticlePlaylistsMutation();

  const [selectedPlaylistIds, setSelectedPlaylistIds] = useState<Set<string>>(
    new Set()
  );
  const [initialSelectedIds, setInitialSelectedIds] = useState<Set<string>>(
    new Set()
  );
  const [error, setError] = useState<string | null>(null);
  const [overlayClickable, setOverlayClickable] = useState(false);

  // モーダルが開いたときに選択状態を同期
  useEffect(() => {
    if (isOpen && !isLoadingCurrent && currentPlaylists) {
      const currentIds = new Set(currentPlaylists.map((p) => p.id));
      setSelectedPlaylistIds(currentIds);
      setInitialSelectedIds(currentIds);
      logger.info("プレイリストを読み込み", {
        totalCount: allPlaylists.length,
        selectedCount: currentIds.size,
        currentPlaylistsLength: currentPlaylists.length,
        articleId,
        itemId,
      });
    }
  }, [isOpen, isLoadingCurrent, currentPlaylists, allPlaylists.length]);

  // エラー状態を管理
  useEffect(() => {
    if (currentError) {
      const errorMessage =
        currentError instanceof Error
          ? currentError.message
          : "エラーが発生しました";
      setError(errorMessage);
      logger.error("プレイリストの読み込みに失敗", currentError);
    } else {
      setError(null);
    }
  }, [currentError]);

  // モーダルが閉じられたときに状態をリセット
  useEffect(() => {
    if (!isOpen) {
      setSelectedPlaylistIds(new Set());
      setInitialSelectedIds(new Set());
      setError(null);
    }
    // When the modal opens, disable overlay clicks briefly so a lingering
    // click from the button which opened the modal cannot immediately close it.
    if (isOpen) {
      setOverlayClickable(false);
      const t = setTimeout(() => setOverlayClickable(true), 100);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  // Handle Escape key to close modal for accessibility
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" || event.key === "Esc") {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  const handleTogglePlaylist = (playlistId: string) => {
    const newSelected = new Set(selectedPlaylistIds);
    if (newSelected.has(playlistId)) {
      newSelected.delete(playlistId);
    } else {
      newSelected.add(playlistId);
    }
    setSelectedPlaylistIds(newSelected);
  };

  const handleSave = async () => {
    try {
      setError(null);

      const addToPlaylistIds = Array.from(selectedPlaylistIds).filter(
        (id) => !initialSelectedIds.has(id)
      );
      const removeFromPlaylistIds = Array.from(initialSelectedIds).filter(
        (id) => !selectedPlaylistIds.has(id)
      );

      if (addToPlaylistIds.length > 0 || removeFromPlaylistIds.length > 0) {
        await updateMutation.mutateAsync({
          articleId,
          addToPlaylistIds,
          removeFromPlaylistIds,
        });
      }

      logger.success("プレイリストを更新", {
        articleId,
        addCount: addToPlaylistIds.length,
        removeCount: removeFromPlaylistIds.length,
      });

      // 保存成功後、コールバックを呼び出す
      if (onPlaylistsUpdated) {
        await onPlaylistsUpdated();
      }

      onClose();
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "エラーが発生しました";
      setError(errorMessage);
      logger.error("プレイリストの更新に失敗", err);
    }
  };

  const isLoading = isLoadingPlaylists || isLoadingCurrent;
  const isSaving = updateMutation.isPending;

  if (!isOpen) return null;

  return (
    <>
      {/* オーバーレイ */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity"
        onClick={(e) => {
          // Guard against overlay being clicked immediately after opening the modal
          // (close race condition coming from underlying click propagation)
          if (!overlayClickable) return;
          onClose();
        }}
        role="presentation"
      />

      {/* モーダル */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-hidden flex flex-col"
          role="dialog"
          aria-modal="true"
          aria-labelledby="playlist-selector-modal-title"
        >
          {/* ヘッダー */}
          <div className="border-b border-gray-200 dark:border-gray-800 p-6">
            <h2
              id="playlist-selector-modal-title"
              className="text-xl font-bold text-gray-900 dark:text-gray-100"
            >
              プレイリストに追加
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 truncate">
              {articleTitle}
            </p>
          </div>

          {/* コンテンツ */}
          <div className="flex-1 overflow-y-auto p-6">
            {error && (
              <div className="mb-4 p-4 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded text-red-700 dark:text-red-400 text-sm">
                {error}
              </div>
            )}

            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border border-blue-300 border-t-blue-600" />
              </div>
            ) : allPlaylists.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <p>プレイリストがありません</p>
              </div>
            ) : (
              <div className="space-y-2">
                {allPlaylists.map((playlist) => {
                  const checkboxId = `playlist-checkbox-${playlist.id}`;
                  return (
                    <div
                      key={playlist.id}
                      className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    >
                      <input
                        id={checkboxId}
                        type="checkbox"
                        checked={selectedPlaylistIds.has(playlist.id)}
                        onChange={() =>
                          !isSaving && handleTogglePlaylist(playlist.id)
                        }
                        className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 cursor-pointer"
                        disabled={isSaving}
                      />
                      <label
                        htmlFor={checkboxId}
                        className="flex-1 min-w-0 cursor-pointer"
                      >
                        <p className="font-medium text-gray-900 dark:text-gray-100 truncate">
                          {playlist.name}
                        </p>
                        {playlist.description && (
                          <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
                            {playlist.description}
                          </p>
                        )}
                        {playlist.is_default && (
                          <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                            デフォルト
                          </p>
                        )}
                      </label>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* フッター */}
          <div className="border-t border-gray-200 dark:border-gray-800 p-6 flex gap-3 justify-end">
            <button
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              キャンセル
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || isLoading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              {isSaving && (
                <div className="animate-spin rounded-full h-4 w-4 border border-white border-t-transparent" />
              )}
              {isSaving ? "保存中..." : "保存"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
