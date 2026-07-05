"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { PeriodFilter } from "@/components/PeriodFilter";
import { PopularArticleCard } from "@/components/PopularArticleCard";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/Spinner";
import type {
  Period,
  PopularArticlesResponse,
  PopularArticle,
} from "@/types/stats";
import { RotateCcw } from "lucide-react";
import { PlaylistSelectorModal } from "@/components/PlaylistSelectorModal";
import toast from "react-hot-toast";

const POPULAR_CACHE_KEY = "audicle_popular_articles_v2";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // limit fetches to once per day

type CachedPopularEntry = {
  articles: PopularArticle[];
  fetchedAt: number;
};

const getCacheKey = (period: Period) => `${POPULAR_CACHE_KEY}_${period}`;

const getCachedEntry = (period: Period): CachedPopularEntry | null => {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(getCacheKey(period));
  if (!raw) return null;

  try {
    return JSON.parse(raw) as CachedPopularEntry;
  } catch (error) {
    console.error(
      `Failed to parse popular articles cache for ${period}`,
      error
    );
    return null;
  }
};

const setCachedEntry = (period: Period, entry: CachedPopularEntry) => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(getCacheKey(period), JSON.stringify(entry));
  } catch (error) {
    console.error(
      `Failed to write popular articles cache for ${period}`,
      error
    );
  }
};

const isFresh = (timestamp: number | null) => {
  if (!timestamp) return false;
  return Date.now() - timestamp < CACHE_TTL_MS;
};

export default function PopularPage() {
  const router = useRouter();
  const [period, setPeriod] = useState<Period>("week");
  const [articles, setArticles] = useState<PopularArticle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetchedAt, setLastFetchedAt] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isPlaylistModalOpen, setIsPlaylistModalOpen] = useState(false);
  const [selectedArticle, setSelectedArticle] = useState<PopularArticle | null>(
    null
  );

  const fetchPopularArticles = useCallback(async (selectedPeriod: Period) => {
    setIsLoading(true);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch(
        `/api/stats/popular?period=${selectedPeriod}&limit=20`
      );
      if (!response.ok) {
        throw new Error("人気記事の取得に失敗しました");
      }

      const data: PopularArticlesResponse = await response.json();
      console.log("[DEBUG] API response data:", data);
      console.log("[DEBUG] articles count:", data.articles?.length ?? 0);
      const fetchedAt = Date.now();
      setArticles(data.articles);
      console.log("[DEBUG] setArticles called with:", data.articles);
      setLastFetchedAt(fetchedAt);
      setCachedEntry(selectedPeriod, {
        articles: data.articles,
        fetchedAt,
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "予期しないエラーが発生しました"
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const cached = getCachedEntry(period);
    console.log("[DEBUG] useEffect: period=", period, "cached=", cached);
    if (cached && isFresh(cached.fetchedAt)) {
      // 新鮮なキャッシュがあれば表示
      console.log(
        "[DEBUG] Using fresh cache, articles count:",
        cached.articles?.length
      );
      setArticles(cached.articles);
      setLastFetchedAt(cached.fetchedAt);
      setIsLoading(false);
      setError(null);
      setNotice(null);
    } else {
      // キャッシュがないか古い場合は取得
      console.log("[DEBUG] Cache miss or stale, will fetch from API");
      if (cached) {
        // 古いデータがあれば、取得中にそれを表示
        setArticles(cached.articles);
        setLastFetchedAt(cached.fetchedAt);
      } else {
        // キャッシュがない場合は、前の期間のデータが表示されるのを防ぐためにリストをクリア
        setArticles([]);
        setLastFetchedAt(null);
      }
      fetchPopularArticles(period);
    }
  }, [period, fetchPopularArticles]);

  const handleRead = useCallback(
    (url: string) => {
      router.push(`/reader?url=${encodeURIComponent(url)}`);
    },
    [router]
  );

  const handleRefresh = useCallback(() => {
    if (isFresh(lastFetchedAt)) {
      setNotice("人気記事は期間ごとに1日1回まで取得できます。");
      return;
    }
    fetchPopularArticles(period);
  }, [lastFetchedAt, period, fetchPopularArticles]);

  const handlePlaylistAdd = useCallback((article: PopularArticle) => {
    setSelectedArticle(article);
    setIsPlaylistModalOpen(true);
  }, []);

  const formattedLastFetchedAt =
    lastFetchedAt !== null ? new Date(lastFetchedAt).toLocaleString() : null;

  const isRateLimited = isFresh(lastFetchedAt);

  return (
    <div className="h-screen bg-black text-white flex flex-col lg:flex-row">
      <Sidebar />

      <main className="flex-1 overflow-x-hidden overflow-y-auto bg-linear-to-b from-zinc-900 to-black">
        <div className="p-4 sm:p-6 lg:p-8">
          {/* Page Header */}
          <div className="mb-6 lg:mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl lg:text-3xl font-bold">人気記事</h2>
              <Button
                onClick={handleRefresh}
                variant="ghost"
                size="icon"
                title={isRateLimited ? "本日は取得済みです" : "手動更新"}
                className="text-zinc-400 hover:text-white hover:bg-zinc-800"
                disabled={isLoading || isRateLimited}
              >
                {isLoading && articles.length > 0 ? (
                  <Spinner size="sm" className="border-zinc-400" />
                ) : (
                  <RotateCcw className="h-5 w-5" />
                )}
              </Button>
            </div>
            <p className="text-sm lg:text-base text-zinc-400 mb-4">
              期間別に人気の記事をランキング表示します
            </p>

            {/* Period Filter */}
            <PeriodFilter activePeriod={period} onPeriodChange={setPeriod} />

            {(formattedLastFetchedAt || notice) && (
              <div className="mt-3 text-sm text-zinc-400">
                {formattedLastFetchedAt && (
                  <p>最終更新: {formattedLastFetchedAt}</p>
                )}
                {notice && <p className="text-amber-400 mt-1">{notice}</p>}
              </div>
            )}
          </div>

          {/* Content */}
          {isLoading && articles.length === 0 ? (
            <div className="text-center py-12 text-zinc-500">
              <Spinner size="md" className="border-primary mb-4" />
              <p className="text-lg">読み込み中...</p>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">⚠️</div>
              <h3 className="text-xl font-semibold text-white mb-2">
                エラーが発生しました
              </h3>
              <p className="text-zinc-400 mb-6">{error}</p>
              <Button
                onClick={handleRefresh}
                disabled={isLoading || isRateLimited}
              >
                <RotateCcw className="size-4 mr-2" />
                再試行
              </Button>
            </div>
          ) : articles.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">📊</div>
              <h3 className="text-xl font-semibold text-white mb-2">
                データがありません
              </h3>
              <p className="text-zinc-400 mb-6">
                この期間の人気記事データはまだありません
              </p>
              <Button
                onClick={handleRefresh}
                disabled={isLoading || isRateLimited}
              >
                <RotateCcw className="size-4 mr-2" />
                人気記事を読み込む
              </Button>
            </div>
          ) : (
            <div
              className="grid grid-cols-1 gap-4 sm:gap-6 lg:gap-8"
              data-testid="popular-articles-list"
            >
              {articles.map((article) => (
                <PopularArticleCard
                  key={article.articleHash}
                  article={article}
                  onRead={handleRead}
                  onPlaylistAdd={handlePlaylistAdd}
                />
              ))}
            </div>
          )}

          {/* Results Summary */}
          {articles.length > 0 && (
            <div className="mt-8 p-4 bg-zinc-900/50 border border-zinc-800 rounded-lg text-center text-zinc-400">
              <p>TOP {articles.length} の記事を表示しています</p>
            </div>
          )}
        </div>
      </main>

      {selectedArticle && (
        <PlaylistSelectorModal
          isOpen={isPlaylistModalOpen}
          onClose={() => {
            setIsPlaylistModalOpen(false);
            setSelectedArticle(null);
          }}
          articleId={selectedArticle.articleId}
          articleTitle={selectedArticle.title}
          onPlaylistsUpdated={async () => {
            toast.success("プレイリストが更新されました");
          }}
        />
      )}
    </div>
  );
}
