"use client";

import { useState, useEffect } from "react";
import {
  getDownloadedArticles,
  getStorageUsage,
  deleteArticle,
  clearAll,
  type DownloadedArticle,
} from "@/lib/indexedDB";
import { logger } from "@/lib/logger";
import { useConfirmDialog } from "@/components/ConfirmDialog";
import { formatBytes, formatDate } from "@/lib/formatters";

export default function StorageManager() {
  const [articles, setArticles] = useState<DownloadedArticle[]>([]);
  const [storageUsage, setStorageUsage] = useState({ used: 0, available: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const { showConfirm, confirmDialog } = useConfirmDialog();

  // データを読み込み
  const loadData = async () => {
    setIsLoading(true);
    try {
      const [articlesData, usage] = await Promise.all([
        getDownloadedArticles(),
        getStorageUsage(),
      ]);

      setArticles(articlesData);
      setStorageUsage(usage);
      logger.info("ストレージ情報を読み込み", {
        articleCount: articlesData.length,
        used: formatBytes(usage.used),
      });
    } catch (err) {
      logger.error("ストレージ情報の読み込みに失敗", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // 記事を削除
  const handleDeleteArticle = async (url: string) => {
    const article = articles.find((a) => a.url === url);
    if (!article) return;

    const confirmed = await showConfirm({
      title: "音声データを削除",
      message: `「${url}」の音声データを削除しますか?`,
      confirmText: "削除",
      cancelText: "キャンセル",
      isDangerous: true,
    });

    if (!confirmed) return;

    try {
      await deleteArticle(url);
      logger.success("記事を削除", { url });
      await loadData();
    } catch (err) {
      logger.error("記事の削除に失敗", err);
      setError("削除に失敗しました");
    }
  };

  // 全て削除
  const handleClearAll = async () => {
    const confirmed = await showConfirm({
      title: "全ての音声データを削除",
      message: "全ての音声データを削除しますか? この操作は取り消せません。",
      confirmText: "全て削除",
      cancelText: "キャンセル",
      isDangerous: true,
    });

    if (!confirmed) return;

    try {
      await clearAll();
      logger.success("全データを削除");
      await loadData();
    } catch (err) {
      logger.error("全削除に失敗", err);
      setError("削除に失敗しました");
    }
  };

  if (isLoading) {
    return <div className="p-4 text-center text-zinc-400">読み込み中...</div>;
  }

  return (
    <div className="space-y-4">
      {confirmDialog}
      {error && (
        <div className="bg-red-950 border border-red-800 rounded-lg p-3">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}
      {/* ストレージ使用量 */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
        <h3 className="text-lg font-semibold mb-3">ストレージ使用量</h3>
        <span className="text-sm text-zinc-400">
          {formatBytes(storageUsage.used)}
        </span>
      </div>

      {/* ダウンロード済み記事一覧 */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold">ダウンロード済み記事</h3>
          {articles.length > 0 && (
            <button
              onClick={handleClearAll}
              className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
            >
              全て削除
            </button>
          )}
        </div>

        {articles.length === 0 ? (
          <p className="text-sm text-zinc-400 text-center py-4">
            ダウンロード済みの記事がありません
          </p>
        ) : (
          <div className="space-y-3">
            {articles.map((article) => (
              <div
                key={article.url}
                className="border border-zinc-700 rounded-lg p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {article.url}
                    </p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-zinc-400">
                      <span>
                        {article.downloadedChunks} / {article.totalChunks}{" "}
                        チャンク
                      </span>
                      <span>{formatBytes(article.totalSize)}</span>
                      <span>{formatDate(article.timestamp)}</span>
                    </div>
                    {article.downloadedChunks === article.totalChunks ? (
                      <span className="inline-block mt-1 px-2 py-0.5 text-xs bg-green-900 text-green-300 rounded">
                        ✓ 完全
                      </span>
                    ) : (
                      <span className="inline-block mt-1 px-2 py-0.5 text-xs bg-yellow-900 text-yellow-300 rounded">
                        ⚠ 部分的
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => handleDeleteArticle(article.url)}
                    className="px-2 py-1 text-xs text-red-400 hover:bg-red-950 rounded transition-colors"
                  >
                    削除
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
