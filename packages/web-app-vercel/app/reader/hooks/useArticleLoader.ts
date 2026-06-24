import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Chunk } from "@/types/api";
import { extractContent, parseApiErrorMessage } from "@/lib/api";
import { articleStorage } from "@/lib/articleStorage";
import { logger } from "@/lib/logger";
import { type DetectedLanguage } from "@/lib/languageDetector";
import { parseHTMLToParagraphs } from "@/lib/paragraphParser";
import { createReaderUrl } from "@/lib/urlBuilder";
import { Playlist } from "@/types/playlist";

export function convertParagraphsToChunks(htmlContent: string): {
  chunks: Chunk[];
  detectedLanguage: DetectedLanguage;
} {
  const { paragraphs, detectedLanguage } = parseHTMLToParagraphs(htmlContent);

  const chunks = paragraphs.map((para) => ({
    id: para.id,
    text: para.originalText,
    cleanedText: para.cleanedText,
    type: para.type,
  }));

  return { chunks, detectedLanguage };
}

export function useArticleLoader(
  userEmail: string | null | undefined,
  playlists: Playlist[],
  selectedPlaylistId: string,
  playlistIdFromQuery: string | null,
  indexFromQuery: string | null,
  autoplayFromQuery: boolean,
  hasInitiatedAutoplayRef: React.MutableRefObject<boolean>
) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [url, setUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [chunks, setChunks] = useState<Chunk[]>([]);
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");
  const [detectedLanguage, setDetectedLanguage] = useState<DetectedLanguage>("unknown");
  const [articleId, setArticleId] = useState<string | null>(null);
  const [itemId, setItemId] = useState<string | null>(null);

  const loadAndSaveArticle = useCallback(
    async (articleUrl: string) => {
      setIsLoading(true);
      setError("");
      try {
        const response = await extractContent(articleUrl);
        const { chunks: chunksWithId, detectedLanguage } = convertParagraphsToChunks(response.content);
        setChunks(chunksWithId);
        setDetectedLanguage(detectedLanguage);
        setUrl(articleUrl);
        setTitle(response.title);

        let newArticleId: string | null = null;
        try {
          if (!selectedPlaylistId) {
            throw new Error("追加先のプレイリストが選択されていません。");
          }
          const targetPlaylistId = selectedPlaylistId;

          const itemResponse = await fetch(
            `/api/playlists/${targetPlaylistId}/items`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                article_url: articleUrl,
                article_title: response.title,
                thumbnail_url: null,
                last_read_position: 0,
              }),
            },
          );

          if (itemResponse.ok) {
            const itemData = await itemResponse.json();
            newArticleId = itemData.article.id;
            setArticleId(newArticleId);
            setItemId(itemData.item.id);
            logger.success("記事をプレイリストに追加", {
              id: newArticleId,
              url: articleUrl,
              title: response.title,
              playlistId: targetPlaylistId,
            });
          } else {
            logger.error("記事の追加に失敗", await itemResponse.text());
          }
        } catch (itemError) {
          logger.error("記事の追加に失敗", itemError);
        }

        const newArticle = articleStorage.add({
          id: newArticleId || undefined,
          url: articleUrl,
          title: response.title,
          chunks: chunksWithId,
        });

        logger.success("記事を保存", {
          id: newArticle.id,
          title: newArticle.title,
          chunkCount: chunksWithId.length,
        });

        const modifiedPlaylist = playlists.find(
          (p) => p.id === selectedPlaylistId,
        );

        if (userEmail && modifiedPlaylist?.is_default) {
          queryClient.invalidateQueries({
            queryKey: ["defaultPlaylist"],
          });
          logger.success("ホームのキャッシュを無効化しました");
        }

        const redirectUrl = createReaderUrl({
          articleUrl: articleUrl,
          playlistId: playlistIdFromQuery || selectedPlaylistId || undefined,
          playlistIndex: indexFromQuery
            ? parseInt(indexFromQuery, 10)
            : undefined,
          autoplay: autoplayFromQuery,
        });
        router.push(redirectUrl);
      } catch (err) {
        setError(err instanceof Error ? err.message : "エラーが発生しました");
        logger.error("記事の抽出に失敗", err);
      } finally {
        setIsLoading(false);
      }
    },
    [router, selectedPlaylistId, queryClient, userEmail, playlists, playlistIdFromQuery, indexFromQuery, autoplayFromQuery],
  );

  const fetchArticleAndSetState = useCallback(
    async ({
      id,
      url: maybeUrl,
      titleFallback,
      isPlaylistMode = false,
    }: {
      id?: string;
      url?: string;
      titleFallback?: string;
      isPlaylistMode?: boolean;
    }) => {
      setIsLoading(true);
      setError("");
      try {
        let resolvedUrl = maybeUrl;
        let resolvedTitle = titleFallback || "";
        const resolvedId = id || null;

        if (!resolvedUrl && id) {
          const res = await fetch(`/api/articles/${id}`);
          if (!res.ok) {
            logger.warn("記事取得APIに失敗しました", { status: res.status });
            setError("記事が見つかりませんでした");
            return;
          }
          const articleData = await res.json();
          if (!articleData || !articleData.url) {
            setError("記事情報が不完全です");
            return;
          }
          resolvedUrl = articleData.url;
          resolvedTitle = articleData.title || resolvedTitle;
        }

        if (!resolvedUrl) {
          setError("記事のURLが不明です");
          return;
        }

        const extractRes = await fetch("/api/extract", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: resolvedUrl }),
        });
        if (!extractRes.ok) {
          const errorText = await extractRes.text();
          const errorMessage = parseApiErrorMessage(
            errorText,
            "記事の読み込みに失敗しました",
          );
          logger.error("抽出APIに失敗しました", { status: extractRes.status });
          setError(errorMessage);
          return;
        }
        const data = await extractRes.json();
        const { chunks: chunksWithId, detectedLanguage } = convertParagraphsToChunks(data.content);

        setTitle(
          isPlaylistMode ? resolvedTitle : data.title || resolvedTitle || "",
        );
        setChunks(chunksWithId);
        setDetectedLanguage(detectedLanguage);
        setUrl(resolvedUrl);
        setArticleId(resolvedId);
        hasInitiatedAutoplayRef.current = false;

        try {
          articleStorage.upsert({
            id: resolvedId ? resolvedId : undefined,
            url: resolvedUrl,
            title: data.title || resolvedTitle || "",
            chunks: chunksWithId,
          });
        } catch (e) {
          logger.error("localStorageへの保存に失敗しました", e);
        }
      } catch (err) {
        logger.error("サーバーから記事取得に失敗", err);
        setError("記事が見つかりませんでした");
        setTitle("");
        setChunks([]);
        setUrl("");
        setArticleId(null);
      } finally {
        setIsLoading(false);
      }
    },
    [hasInitiatedAutoplayRef],
  );

  return {
    url, setUrl,
    isLoading, setIsLoading,
    chunks, setChunks,
    title, setTitle,
    error, setError,
    detectedLanguage, setDetectedLanguage,
    articleId, setArticleId,
    itemId, setItemId,
    loadAndSaveArticle,
    fetchArticleAndSetState
  };
}
