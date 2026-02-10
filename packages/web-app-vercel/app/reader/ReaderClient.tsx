"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import ReaderView from "@/components/ReaderView";
import { PlaylistSelectorModal } from "@/components/PlaylistSelectorModal";
import { PlaylistCompletionScreen } from "@/components/PlaylistCompletionScreen";
import { usePlaylistPlayback } from "@/contexts/PlaylistPlaybackContext";
import { useAudioPlayback } from "@/contexts/AudioPlaybackContext";
import { Chunk } from "@/types/api";
import { Playlist } from "@/types/playlist";
import { extractContent, parseApiErrorMessage } from "@/lib/api";
import { articleStorage } from "@/lib/articleStorage";
import { logger } from "@/lib/logger";
import { useDownload } from "@/hooks/useDownload";
import { MobileArticleMenu } from "@/components/MobileArticleMenu";
import { PlaybackSpeedDial } from "@/components/PlaybackSpeedDial";
import { recordArticleStats } from "@/lib/articleStats";
import { parseHTMLToParagraphs } from "@/lib/paragraphParser";
import { type DetectedLanguage } from "@/lib/languageDetector";
import { selectVoiceModel } from "@/lib/voiceSelector";
import { UserSettings, DEFAULT_SETTINGS } from "@/types/settings";
import { createReaderUrl } from "@/lib/urlBuilder";
import { zIndex } from "@/lib/zIndex";
import { getPlaylistSortKey } from "@/lib/playlist-utils";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Plus,
  ListPlus,
  ExternalLink,
  Download,
} from "lucide-react";

function convertParagraphsToChunks(htmlContent: string): {
  chunks: Chunk[];
  detectedLanguage: DetectedLanguage;
} {
  // HTML構造を保持して段落を抽出
  const { paragraphs, detectedLanguage } = parseHTMLToParagraphs(htmlContent);

  // Chunk形式に変換
  const chunks = paragraphs.map((para) => ({
    id: para.id,
    text: para.originalText,
    cleanedText: para.cleanedText,
    type: para.type,
  }));

  return { chunks, detectedLanguage };
}

export default function ReaderPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const articleIdFromQuery = searchParams.get("id");
  const urlFromQuery = searchParams.get("url");
  const playlistIdFromQuery = searchParams.get("playlist");
  const indexFromQuery = searchParams.get("index");
  const autoplayFromQuery = searchParams.get("autoplay") === "true";
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const userEmail = session?.user?.email;

  // プレイリスト再生コンテキスト
  const {
    state: playlistState,
    onArticleEnd,
    initializeFromArticle,
    initializeFromPlaylist,
    canMovePrevious,
    canMoveNext,
  } = usePlaylistPlayback();

  const [url, setUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [chunks, setChunks] = useState<Chunk[]>([]);
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [detectedLanguage, setDetectedLanguage] =
    useState<DetectedLanguage>("unknown");
  const [effectiveVoiceModel, setEffectiveVoiceModel] = useState<string>(
    DEFAULT_SETTINGS.voice_model
  );
  const [articleId, setArticleId] = useState<string | null>(null);
  const [itemId, setItemId] = useState<string | null>(null);
  const [isPlaylistModalOpen, setIsPlaylistModalOpen] = useState(false);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string>("");
  const [arePlaylistsLoaded, setArePlaylistsLoaded] = useState(false);
  // NOTE: Playlist selection should be deterministic via query params or default playlist.
  const [hasLoadedFromQuery, setHasLoadedFromQuery] = useState(false);
  const [isSpeedModalOpen, setIsSpeedModalOpen] = useState(false);

  // Hydrationエラーを防ぐためのクライアントサイド判定
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // プレイリスト再生のための追加状態
  const [currentPlaylistIndex, setCurrentPlaylistIndex] = useState<number>(
    indexFromQuery ? parseInt(indexFromQuery, 10) : 0
  );
  const [isPlaylistMode] = useState<boolean>(!!playlistIdFromQuery);
  const [showCompletionScreen, setShowCompletionScreen] = useState(false);

  // プレイリストコンテキストの準備状態チェック（sortKey一致も確認）
  const currentSortKey = playlistIdFromQuery
    ? getPlaylistSortKey(playlistIdFromQuery)
    : null;
  const isPlaylistContextReady =
    !!playlistIdFromQuery &&
    playlistState.isPlaylistMode &&
    playlistState.playlistId === playlistIdFromQuery &&
    playlistState.items.length > 0 &&
    playlistState.sortKey === currentSortKey; // 追加: sortKey一致チェック

  // 自動再生の参照フラグ（useEffectの無限ループを防ぐため）
  const hasInitiatedAutoplayRef = useRef(false);

  const chunkCount = chunks.length;

  useEffect(() => {
    if (!url) return;
    let safeUrlForLog: string | undefined;
    try {
      const u = new URL(url);
      safeUrlForLog = `${u.origin}${u.pathname}`;
    } catch {
      safeUrlForLog = undefined;
    }
    logger.info("ReaderClient articleUrl ready", {
      articleUrl: safeUrlForLog,
      chunkCount,
    });
  }, [url, chunkCount]);

  // グローバル再生制御（ページ遷移で止めない）
  const {
    setSource: setPlaybackSource,
    isPlaying,
    isLoading: isPlaybackLoading,
    error: playbackError,
    currentChunkId,
    play,
    pause,
    stop,
    seekToChunk,
    playbackRate,
    setPlaybackRate,
  } = useAudioPlayback();

  const handleArticleEnd = useCallback(() => {
    if (isPlaylistMode && playlistState.isPlaylistMode) {
      // プレイリストの最後の記事の場合は完了画面を表示
      if (currentPlaylistIndex >= playlistState.totalCount - 1) {
        setShowCompletionScreen(true);
        logger.info("プレイリスト完了", {
          playlistId: playlistState.playlistId,
          totalCount: playlistState.totalCount,
        });
        return;
      }

      // そうでなければ次の記事へ進む
      logger.info("次の記事へ進む", {
        currentIndex: currentPlaylistIndex,
        totalCount: playlistState.totalCount,
      });
      onArticleEnd();
    }
  }, [
    isPlaylistMode,
    playlistState.isPlaylistMode,
    playlistState.totalCount,
    playlistState.playlistId,
    currentPlaylistIndex,
    onArticleEnd,
  ]);

  // 記事データが揃ったらグローバルプレーヤーのsourceを更新
  useEffect(() => {
    if (!isClient) return;
    if (!url || chunks.length === 0) return;

    let author: string | undefined;
    try {
      author = new URL(url).hostname;
    } catch {
      author = undefined;
    }

    setPlaybackSource({
      chunks,
      articleUrl: url,
      voiceModel: effectiveVoiceModel,
      playbackSpeed: settings.playback_speed,
      title: title || "記事を読み上げ中",
      author,
      onArticleEnd: handleArticleEnd,
    });
  }, [
    isClient,
    url,
    chunks,
    effectiveVoiceModel,
    settings.playback_speed,
    title,
    handleArticleEnd,
    setPlaybackSource,
  ]);

  // ダウンロード機能（モバイルメニュー用）はReaderViewに集約されています
  const { status: downloadStatus, startDownload } = useDownload({
    articleUrl: url,
    chunks,
    voiceModel: effectiveVoiceModel,
    speed: playbackRate,
  });

  // 記事を読み込んで保存する共通ロジック
  const loadAndSaveArticle = useCallback(
    async (articleUrl: string) => {
      setIsLoading(true);
      setError("");
      try {
        const response = await extractContent(articleUrl);
        const { chunks: chunksWithId, detectedLanguage } =
          convertParagraphsToChunks(response.content);
        setChunks(chunksWithId);
        setDetectedLanguage(detectedLanguage);
        setUrl(articleUrl);
        setTitle(response.title);

        // 記事アクセス統計を記録（非同期、エラーは内部で処理される）
        recordArticleStats({
          url: articleUrl,
          title: response.title,
          content: response.content,
          chunks: chunksWithId,
        });

        // プレイリストに記事を追加
        let newArticleId: string | null = null;
        try {
          if (!selectedPlaylistId) {
            throw new Error("追加先のプレイリストが選択されていません。");
          }
          const targetPlaylistId = selectedPlaylistId;

          // プレイリストに直接追加
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
            }
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

        // ローカルストレージに保存（サーバーIDを優先）
        const newArticle = articleStorage.add({
          id: newArticleId || undefined, // サーバーIDがあれば使用

          url: articleUrl,
          title: response.title,
          chunks: chunksWithId,
        });

        logger.success("記事を保存", {
          id: newArticle.id,
          title: newArticle.title,
          chunkCount: chunksWithId.length,
        });

        // デフォルトプレイリストに追加した場合のみキャッシュ無効化
        const modifiedPlaylist = playlists.find(
          (p) => p.id === selectedPlaylistId
        );

        if (userEmail && modifiedPlaylist?.is_default) {
          queryClient.invalidateQueries({
            queryKey: ["defaultPlaylist"],
          });
          logger.success("ホームのキャッシュを無効化しました");
        }

        // URLに記事IDを追加（サーバーIDがあればそれを優先）
        // プレイリスト周りのクエリがある場合は維持しておく
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
    [router, selectedPlaylistId, queryClient, userEmail, playlists]
  );

  // サーバーから記事（IDまたはURLで指定）を取得してステートにセットし、localStorageに保存するヘルパー
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

        // もしURLがなければ、IDからメタ情報を取得
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

        // 抽出APIでチャンクを取得
        const extractRes = await fetch("/api/extract", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: resolvedUrl }),
        });
        if (!extractRes.ok) {
          const errorText = await extractRes.text();
          const errorMessage = parseApiErrorMessage(errorText, "記事の読み込みに失敗しました");
          logger.error("抽出APIに失敗しました", { status: extractRes.status });
          setError(errorMessage);
          return;
        }
        const data = await extractRes.json();
        const { chunks: chunksWithId, detectedLanguage } =
          convertParagraphsToChunks(data.content);

        setTitle(
          isPlaylistMode ? resolvedTitle : data.title || resolvedTitle || ""
        );
        setChunks(chunksWithId);
        setDetectedLanguage(detectedLanguage);
        setUrl(resolvedUrl);
        setArticleId(resolvedId);
        hasInitiatedAutoplayRef.current = false;

        // 保存
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
    []
  );

  // ユーザー設定を読み込む
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const response = await fetch("/api/settings/get");
        if (!response.ok) {
          throw new Error(`設定の読み込みに失敗: ${response.status}`);
        }
        const data = await response.json();
        if (
          data &&
          typeof data.voice_model === "string" &&
          typeof data.playback_speed === "number"
        ) {
          setSettings(data);
        } else {
          throw new Error("Invalid settings format from API");
        }
      } catch (err) {
        logger.error("設定の読み込みに失敗", err);
        setSettings(DEFAULT_SETTINGS);
      }
    };

    loadSettings();
  }, []);

  useEffect(() => {
    setEffectiveVoiceModel(
      selectVoiceModel(settings.voice_model, detectedLanguage)
    );
  }, [settings.voice_model, detectedLanguage]);

  // プレイリスト一覧を取得
  useEffect(() => {
    const fetchPlaylists = async () => {
      try {
        const response = await fetch("/api/playlists");
        if (response.ok) {
          const data: Playlist[] = await response.json();
          setPlaylists(data);

          // APIレスポンスはデフォルトプレイリストが先頭に来るようにソートされているため，
          // 最初のアイテムを選択すればよい
          if (data.length > 0) {
            setSelectedPlaylistId(data[0].id);
          }
        }
      } catch (error) {
        logger.error("プレイリストの読み込みに失敗", error);
      } finally {
        // プレイリスト読み込み完了をマーク
        setArePlaylistsLoaded(true);
      }
    };

    fetchPlaylists();
  }, []);

  // 記事IDが指定されている場合は読み込み
  useEffect(() => {
    if (articleIdFromQuery) {
      const article = articleStorage.getById(articleIdFromQuery);
      if (article) {
        logger.info("記事を読み込み", {
          id: articleIdFromQuery,
          title: article.title,
        });
        setTitle(article.title);
        setChunks(article.chunks);
        setUrl(article.url);
        setArticleId(articleIdFromQuery);
        // 新しい記事が読み込まれたら、自動再生フラグをリセット
        hasInitiatedAutoplayRef.current = false;
      } else {
        logger.warn(
          "localStorageに記事が見つかりません。サーバーから取得を試みます",
          {
            id: articleIdFromQuery,
          }
        );
        // localStorageに記事が見つからない場合、サーバーから取得してstateにセット
        fetchArticleAndSetState({ id: articleIdFromQuery });
      }
    }
  }, [articleIdFromQuery, stop, fetchArticleAndSetState]);

  // インデックスパラメータが変わったときに該当記事を読み込む
  useEffect(() => {
    if (indexFromQuery === null || !playlistIdFromQuery) return;

    const newIndexRaw = parseInt(indexFromQuery, 10);
    if (Number.isNaN(newIndexRaw)) {
      logger.warn("Reader index param is NaN", {
        indexFromQuery,
        playlistIdFromQuery,
      });
      return;
    }

    logger.info("Reader playlist index effect", {
      playlistIdFromQuery,
      playlistStatePlaylistId: playlistState.playlistId,
      playlistStateCurrentIndex: playlistState.currentIndex,
      currentPlaylistIndex,
      newIndex: newIndexRaw,
      itemsLength: playlistState.items.length,
      isPlaylistContextReady,
    });

    // URL由来のindexは常にローカルstateに反映（Prev/Nextの基準を一本化）
    if (newIndexRaw !== currentPlaylistIndex) {
      setCurrentPlaylistIndex(newIndexRaw);
    }

    // playlistId が一致するまで items を参照しない（localStorage復元の誤爆防止）
    if (!isPlaylistContextReady) {
      return;
    }

    // インデックスが変わった場合のみ処理（無限ループを防ぐ）
    if (newIndexRaw !== currentPlaylistIndex || !chunks.length) {
      // プレイリストから該当記事を取得
      const item = playlistState.items[newIndexRaw];
      if (item) {
        logger.info("プレイリストから記事を読み込み", {
          newIndex: newIndexRaw,
          playlistId: playlistIdFromQuery,
          articleId: item.article_id,
          articleUrl: item.article?.url,
        });

        // 正常にロードできる場合は、過去のエラー表示をクリア
        setError("");

        // 記事をlocalStorageから読み込む。なければサーバーからフェッチ（/api/extract経由）
        const article = articleStorage.getById(item.article_id);
        if (article) {
          setTitle(article.title);
          setChunks(article.chunks);
          setUrl(article.url);
          setArticleId(article.id);
          // 新しい記事が読み込まれたら、自動再生フラグをリセット
          hasInitiatedAutoplayRef.current = false;
          logger.success("記事を読み込み完了", {
            id: article.id,
            title: article.title,
            chunkCount: article.chunks.length,
          });
        } else {
          logger.warn(
            "記事がlocalStorageに見つかりません。サーバーからフェッチします",
            {
              articleId: item.article_id,
            }
          );

          // localStorageに記事が見つからない場合、サーバーから取得してstateにセット
          fetchArticleAndSetState({
            id: item.article_id,
            url: item.article?.url,
            titleFallback: item.article?.title,
            isPlaylistMode: true,
          });
        }
      } else {
        logger.error("プレイリストにインデックスが存在しません", {
          newIndex: newIndexRaw,
          itemsLength: playlistState.items.length,
          playlistIdFromQuery,
          playlistStatePlaylistId: playlistState.playlistId,
        });
        setError("無効な記事インデックスです。");
        // 以前の記事情報をクリア
        setTitle("");
        setChunks([]);
        setUrl("");
        setArticleId(null);
      }
    }
  }, [
    indexFromQuery,
    playlistIdFromQuery,
    playlistState.items,
    playlistState.playlistId,
    playlistState.currentIndex,
    currentPlaylistIndex,
    chunks.length,
    stop,
    fetchArticleAndSetState,
    isPlaylistContextReady,
  ]); // URLクエリパラメータが指定されている場合は記事を自動取得
  useEffect(() => {
    // プレイリスト読み込みが完了してから記事を読み込む
    // If a playlist query param is present, prefer initializing from the
    // playlist context instead of loading the article directly, to ensure
    // the `title` displayed is the playlist's item title (not the remote
    // extracted document title).
    if (
      urlFromQuery &&
      arePlaylistsLoaded &&
      !hasLoadedFromQuery &&
      !playlistIdFromQuery
    ) {
      setUrl(urlFromQuery || "");
      // 既にlocalStorageに同じURLの記事が存在するかチェック
      const existingArticle = articleStorage
        .getAll()
        .find((a) => a.url === urlFromQuery);
      if (existingArticle) {
        // 既存の記事がある場合は、そのIDを使ってリダイレクト
        logger.info("既存の記事を読み込み", {
          id: existingArticle.id,
          title: existingArticle.title,
        });
        // 既存の記事情報をステートに設定
        setTitle(existingArticle.title);
        setChunks(existingArticle.chunks);
        setArticleId(existingArticle.id);
        // URLSearchParamsを使用して安全にURLを生成
        const readerUrl = createReaderUrl({
          articleUrl: existingArticle.url,
          playlistId: playlistIdFromQuery || undefined,
          playlistIndex: indexFromQuery
            ? parseInt(indexFromQuery, 10)
            : undefined,
          autoplay: autoplayFromQuery,
        });
        // 新しいURLにリダイレクトするため、参照フラグをリセット
        hasInitiatedAutoplayRef.current = false;
        router.push(readerUrl);
      } else {
        // 新しい記事の場合は取得
        loadAndSaveArticle(urlFromQuery);
      }
      setHasLoadedFromQuery(true);
    }
  }, [
    urlFromQuery,
    arePlaylistsLoaded,
    router,
    loadAndSaveArticle,
    hasLoadedFromQuery,
    autoplayFromQuery,
    playlistIdFromQuery,
    indexFromQuery,
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    loadAndSaveArticle(url);
  };

  // (removed) handleSelectPlaylist - playback initialization is deterministic

  // autoplay パラメータが指定されている場合、チャンクが読み込まれたら自動再生
  useEffect(() => {
    // デバッグ: autoplayの状態をログ出力
    logger.info("自動再生チェック", {
      autoplayFromQuery,
      chunksLength: chunks.length,
      isLoading,
      isPlaying,
      isPlaybackLoading,
      hasInitiatedAutoplay: hasInitiatedAutoplayRef.current,
    });

    if (
      autoplayFromQuery &&
      chunks.length > 0 &&
      !isLoading &&
      !isPlaying &&
      !isPlaybackLoading &&
      !hasInitiatedAutoplayRef.current
    ) {
      // 自動再生フラグを立てて、再生を開始
      // useRefを使用することで、複数回呼び出されるのを防ぐ
      logger.info("自動再生を開始", {
        chunksCount: chunks.length,
        isLoading,
        isPlaying,
        isPlaybackLoading,
      });
      hasInitiatedAutoplayRef.current = true;
      play();
    }
  }, [
    autoplayFromQuery,
    chunks.length,
    isLoading,
    isPlaying,
    isPlaybackLoading,
    play,
  ]);

  // 記事URLが読み込まれた際に、プレイリストコンテキストが無い場合は自動検出
  // ただしAPIは認証を必要とするので、ログイン済みのセッションがある場合のみ検出を行う
  useEffect(() => {
    // プレイリストモードではない かつ 記事URLがある かつ playlistIdFromQueryがない
    // かつ ログイン済み
    if (
      url &&
      !playlistState.isPlaylistMode &&
      !playlistIdFromQuery &&
      session?.user?.email
    ) {
      logger.info("プレイリストコンテキストなし、自動検出を試行（認証済み）", {
        url,
      });
      initializeFromArticle(url);
    }
  }, [
    url,
    playlistState.isPlaylistMode,
    playlistIdFromQuery,
    initializeFromArticle,
    session,
  ]);

  // NOTE: We intentionally do not prompt the user to select a playlist. Instead,
  // prefer `playlist` query param when present, otherwise prefer a default playlist
  // as determined by `initializeFromArticle`. If neither applies, fallback to
  // the first available playlist returned by the API.

  // If the reader was opened with a `playlist` param, ensure the playback context
  // is seeded from that playlist so the Prev/Next UI works deterministically.
  useEffect(() => {
    // Initialize playlist from query if either:
    //  - playlistState is not already in playlist mode
    //  - OR we are in playlist mode but the playlistId does not match the query
    //  - OR sortKey does not match (sort order has changed)
    if (
      playlistIdFromQuery &&
      !isPlaylistContextReady &&
      session?.user?.email
    ) {
      logger.info("Reader opened with playlist query, initializing playlist", {
        playlistId: playlistIdFromQuery,
        index: indexFromQuery,
      });

      const startIndex = indexFromQuery ? parseInt(indexFromQuery, 10) : 0;
      initializeFromPlaylist(playlistIdFromQuery, startIndex).catch((err) =>
        logger.error("Failed to initialize playlist from query", err)
      );
    }
  }, [
    playlistIdFromQuery,
    isPlaylistContextReady,
    initializeFromPlaylist,
    indexFromQuery,
    session,
  ]);

  // プレイリスト内の特定の記事に遷移するヘルパー関数
  const navigateToPlaylistItem = useCallback(
    (index: number) => {
      logger.info("Prev/Next navigation requested", {
        playlistIdFromQuery,
        playlistStatePlaylistId: playlistState.playlistId,
        currentPlaylistIndex,
        playlistStateCurrentIndex: playlistState.currentIndex,
        targetIndex: index,
        itemsLength: playlistState.items.length,
      });

      // 同一URLへのpushを避ける（無反応に見えるのを防ぐ）
      if (index === currentPlaylistIndex) {
        logger.info("Skip navigation: same index", {
          index,
          currentPlaylistIndex,
        });
        return;
      }

      // クエリのplaylistIdと一致するまで items を参照しない
      if (
        playlistIdFromQuery &&
        playlistState.playlistId !== playlistIdFromQuery
      ) {
        logger.info("Skip navigation: playlist context not ready", {
          playlistIdFromQuery,
          playlistStatePlaylistId: playlistState.playlistId,
        });
        return;
      }

      const item = playlistState.items[index];
      const targetPlaylistId = playlistIdFromQuery || playlistState.playlistId;
      if (item && item.article?.url && targetPlaylistId) {
        const readerUrl = createReaderUrl({
          articleUrl: item.article.url,
          playlistId: targetPlaylistId,
          playlistIndex: index,
          autoplay: false,
        });
        router.push(readerUrl);
      }
    },
    [playlistIdFromQuery, playlistState, router, currentPlaylistIndex]
  );

  // プレイリストのインデックスを循環させるユーティリティ
  const wrapIndex = useCallback(
    (index: number) => {
      const len = playlistState.items.length;
      if (len === 0) return 0;
      return ((index % len) + len) % len;
    },
    [playlistState.items.length]
  );

  // 再生速度変更ハンドラー（デスクトップ版とモバイル版で共通）
  const handlePlaybackRateChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setPlaybackRate(parseFloat(e.target.value));
    },
    [setPlaybackRate]
  );

  return (
    <div className="h-screen overflow-hidden flex flex-col">
      {/* ヘッダー: コンパクト化されたナビゲーションとコントロール */}
      <header className="sticky top-0 z-10 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <div className="max-w-4xl mx-auto p-3 sm:p-6">
          {/* トップバー: ナビゲーションとタイトル */}
          <div className="relative flex items-center justify-center gap-2 mb-2">
            <button
              onClick={() => {
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
                <label className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">
                  追加先:
                </label>
                <select
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

          {/* 再生コントロール: デスクトップ用の下部固定バー (SM以上) */}
          {chunks.length > 0 && (
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
                  <span className="hidden sm:inline">
                    {playbackRate.toFixed(1)}x
                  </span>
                </button>

                {/* 中央: 再生/一時停止 (flex-1で中央) */}
                <div className="flex-1 flex items-center justify-center">
                  <div className="flex items-center gap-3 sm:gap-4">
                    {playlistState.isPlaylistMode && (
                      <button
                        onClick={() => {
                          if (isPlaylistContextReady && canMovePrevious) {
                            navigateToPlaylistItem(
                              wrapIndex(currentPlaylistIndex - 1)
                            );
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
                            navigateToPlaylistItem(
                              wrapIndex(currentPlaylistIndex + 1)
                            );
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
          )}
        </div>
      </header>

      {/* メインコンテンツ: リーダービューまたは完了画面 */}
      <main className="flex-1 overflow-hidden pb-24 sm:pb-24">
        {showCompletionScreen && isPlaylistMode ? (
          <PlaylistCompletionScreen
            playlistId={playlistState.playlistId || ""}
            playlistName={playlistState.playlistName || "プレイリスト"}
            totalCount={playlistState.totalCount}
            onReplay={() => {
              setShowCompletionScreen(false);
              navigateToPlaylistItem(0);
            }}
          />
        ) : (
          <ReaderView
            chunks={chunks}
            currentChunkId={currentChunkId}
            articleUrl={url}
            voiceModel={effectiveVoiceModel}
            speed={playbackRate}
            onChunkClick={seekToChunk}
          />
        )}
      </main>

      {/* プレイリストセレクターモーダル */}
      {articleId && (
        <PlaylistSelectorModal
          isOpen={isPlaylistModalOpen}
          onClose={() => setIsPlaylistModalOpen(false)}
          itemId={itemId || undefined}
          articleId={articleId}
          articleTitle={title}
          onPlaylistsUpdated={async () => {}}
        />
      )}

      {/* プレイリスト選択モーダル（記事が複数プレイリストに含まれる場合） */}
      {/* PlaylistChoiceModal removed: playlist selection should be deterministic */}

      {/* 再生速度調整モーダル */}
      <PlaybackSpeedDial
        open={isSpeedModalOpen}
        value={playbackRate}
        onValueChange={setPlaybackRate}
        onOpenChange={setIsSpeedModalOpen}
      />

      {/* モバイル版再生コントロール: 画面下部 - 1行レイアウト */}
      {chunks.length > 0 && (
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
                  onClick={() => {
                    if (isPlaylistContextReady && canMovePrevious) {
                      navigateToPlaylistItem(
                        wrapIndex(currentPlaylistIndex - 1)
                      );
                    }
                  }}
                  disabled={!isPlaylistContextReady || !canMovePrevious}
                  className="mr-2 p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  title="前の記事"
                  aria-label="前の記事"
                >
                  <SkipBack className="size-5" />
                </button>
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
                  isPlaybackLoading
                    ? "処理中..."
                    : isPlaying
                      ? "一時停止"
                      : "再生"
                }
              >
                {isPlaying ? (
                  <Pause className="size-6" />
                ) : (
                  <Play className="size-6" />
                )}
              </button>

              {playlistState.isPlaylistMode && (
                <button
                  onClick={() => {
                    if (isPlaylistContextReady && canMoveNext) {
                      navigateToPlaylistItem(
                        wrapIndex(currentPlaylistIndex + 1)
                      );
                    }
                  }}
                  disabled={!isPlaylistContextReady || !canMoveNext}
                  className="ml-2 p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  title="次の記事"
                  aria-label="次の記事"
                >
                  <SkipForward className="size-5" />
                </button>
              )}
            </div>

            {/* Mobile controls: Prev/Next are placed with Play center; duplicates removed */}

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
      )}
    </div>
  );
}
