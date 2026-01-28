"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { articleStorage, type Article } from "@/lib/storage";
import { logger } from "@/lib/logger";

export default function Home() {
  const router = useRouter();
  const [articles, setArticles] = useState<Article[]>([]);

  // 記事一覧を読み込み
  useEffect(() => {
    const loadArticles = () => {
      const allArticles = articleStorage.getAll();
      logger.info("記事一覧を読み込み", { count: allArticles.length });
      setArticles(allArticles);
    };

    loadArticles();

    // storageイベントをリッスン (他のタブでの変更を検知)
    window.addEventListener("storage", loadArticles);
    return () => window.removeEventListener("storage", loadArticles);
  }, []);

  const handleDelete = (id: string) => {
    const article = articles.find((a) => a.id === id);
    if (article && confirm(`「${article.title}」を削除しますか?`)) {
      articleStorage.remove(id);
      setArticles((prev) => prev.filter((a) => a.id !== id));
      logger.success("記事を削除", { id, title: article.title });
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* ヘッダー */}
      <header className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <div className="max-w-4xl mx-auto p-4">
          <h1 className="text-2xl font-bold mb-4">Audicle - 記事一覧</h1>
          <button
            onClick={() => router.push("/reader")}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            + 新しい記事を読む
          </button>
        </div>
      </header>

      {/* メインコンテンツ: 記事一覧 */}
      <main className="max-w-4xl mx-auto p-4">
        {articles.length === 0 ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            <p>まだ記事がありません</p>
            <p className="text-sm mt-2">
              「+ 新しい記事を読む」から記事を追加してください
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {articles.map((article) => (
              <div
                key={article.id}
                className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between gap-4">
                  <div
                    className="flex-1 cursor-pointer"
                    onClick={() =>
                      router.push(
                        `/reader?url=${encodeURIComponent(article.url)}`
                      )
                    }
                  >
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                      {article.title}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      {article.url}
                    </p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-400 dark:text-gray-500">
                      <span>{formatDate(article.createdAt)}</span>
                      <span>
                        {article.chunkCount ?? article.chunks?.length ?? 0}{" "}
                        チャンク
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(article.id)}
                    className="px-3 py-1 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950 rounded transition-colors"
                    title="削除"
                  >
                    削除
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
