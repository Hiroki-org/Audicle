"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import ReaderView from "@/components/ReaderView";
import { DesktopPlayerControls } from "@/components/DesktopPlayerControls";
import { MobilePlayerControls } from "@/components/MobilePlayerControls";
import { PlaylistSelectorModal } from "@/components/PlaylistSelectorModal";
import { PlaylistCompletionScreen } from "@/components/PlaylistCompletionScreen";
import { usePlaylistPlayback } from "@/contexts/PlaylistPlaybackContext";
import {
  useAudioPlayback,
  type AudioPlaybackSource,
} from "@/contexts/AudioPlaybackContext";
import { Chunk } from "@/types/api";
import { Playlist } from "@/types/playlist";
import { extractContent, parseApiErrorMessage } from "@/lib/api";
import { articleStorage } from "@/lib/articleStorage";
import { logger } from "@/lib/logger";
import { useDownload } from "@/hooks/useDownload";
import { PlaybackSpeedDial } from "@/components/PlaybackSpeedDial";
import { recordArticleStats } from "@/lib/articleStats";
import { parseHTMLToParagraphs } from "@/lib/paragraphParser";
import { type DetectedLanguage } from "@/lib/languageDetector";
import { UserSettings, DEFAULT_SETTINGS } from "@/types/settings";
import { createReaderUrl } from "@/lib/urlBuilder";
import { getPlaylistSortKey } from "@/lib/playlist-utils";
import { useArticleLoader, convertParagraphsToChunks } from "./hooks/useArticleLoader";
import { selectVoiceModel } from "@/lib/voiceSelector";
import { useReaderSettings } from "./hooks/useReaderSettings";
import { useReaderState } from "./hooks/useReaderState";


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
    toggleRepeatMode,
    toggleShuffle,
  } = usePlaylistPlayback();

  const {
    currentPlaylistIndex,
    setCurrentPlaylistIndex,
    activePlaylistIndex,
    isPlaylistMode,
    showCompletionScreen,
    setShowCompletionScreen,
    isPlaylistContextReady,
    isPlaylistModalOpen,
    setIsPlaylistModalOpen,
    isSpeedModalOpen,
    setIsSpeedModalOpen,
    hasLoadedFromQuery,
    setHasLoadedFromQuery,
    isClient,
    hasInitiatedAutoplayRef,
    prevArticleUrlRef,
    navigateToPlaylistItem
  } = useReaderState(playlistIdFromQuery, indexFromQuery, playlistState);

  const {
    settings,
    setSettings,
    effectiveVoiceModel,
    setEffectiveVoiceModel,
    playlists,
    setPlaylists,
    selectedPlaylistId,
    setSelectedPlaylistId,
    arePlaylistsLoaded,
  } = useReaderSettings();

  const {
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
  } = useArticleLoader(
    userEmail,
    playlists,
    selectedPlaylistId,
    playlistIdFromQuery,
    indexFromQuery,
    autoplayFromQuery,
    hasInitiatedAutoplayRef
  );


  useEffect(() => {
    setEffectiveVoiceModel(
      selectVoiceModel(settings.voice_model, detectedLanguage),
    );
  }, [settings.voice_model, detectedLanguage, setEffectiveVoiceModel]);

  const stopRef = useRef<() => void>(() => {});
  const setPlaybackSourceRef = useRef<((_next: AudioPlaybackSource | null) => void) | null>(null);
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

  // グローバル再生制御
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

  useEffect(() => {
    stopRef.current = stop;
    setPlaybackSourceRef.current = setPlaybackSource;
  }, [stop, setPlaybackSource]);

  const handleArticleEnd = useCallback(() => {
    logger.info("handleArticleEnd 呼び出し", {
      isPlaylistMode: playlistState.isPlaylistMode,
      repeatMode: playlistState.repeatMode,
      shuffle: playlistState.shuffle,
      currentIndex: currentPlaylistIndex,
      totalCount: playlistState.totalCount,
      shuffledIndicesLength: playlistState.shuffledIndices.length,
      playlistId: playlistState.playlistId,
    });

    // プレイリストモード時の処理
    if (playlistState.isPlaylistMode) {
      // リピートoff時の完了判定
      if (playlistState.repeatMode === "off") {
        let isAtEnd = false;
        if (playlistState.shuffle) {
          // シャッフルモード: シャッフルキューの最後かどうか確認
          const shuffledIndices = playlistState.shuffledIndices;
          const currentShufflePos =
            shuffledIndices.indexOf(currentPlaylistIndex);
          isAtEnd = currentShufflePos >= shuffledIndices.length - 1;
        } else {
          isAtEnd = currentPlaylistIndex >= playlistState.totalCount - 1;
        }

        if (isAtEnd) {
          setShowCompletionScreen(true);
          logger.info("プレイリスト完了", {
            playlistId: playlistState.playlistId,
            totalCount: playlistState.totalCount,
            shuffle: playlistState.shuffle,
          });
          return;
        }
      }

      // onArticleEndがrepeatMode/shuffleに応じて適切に処理する
      logger.info("次の記事へ進む", {
        currentIndex: currentPlaylistIndex,
        totalCount: playlistState.totalCount,
        repeatMode: playlistState.repeatMode,
        shuffle: playlistState.shuffle,
      });
      onArticleEnd();
      return;
    }

    // プレイリストモードでない未分類再生時は何もしない
    logger.info("handleArticleEnd: プレイリストモードではないためスキップ");
  }, [
    playlistState.isPlaylistMode,
    playlistState.totalCount,
    playlistState.playlistId,
    playlistState.repeatMode,
    playlistState.shuffle,
    playlistState.shuffledIndices,
    currentPlaylistIndex,
    onArticleEnd,
  ]);

  // 記事データが揃ったらグローバルプレーヤーのsourceを更新
  // 記事URLが切り替わった場合は先に再生を停止してから新しいソースをセットする
  useEffect(() => {
    if (!isClient) return;
    if (!url || chunks.length === 0) return;

    let author: string | undefined;
    try {
      author = new URL(url).hostname;
    } catch {
      author = undefined;
    }

    // 再生速度・音声モデル変更など同一記事内の設定変更では停止しない
    if (prevArticleUrlRef.current && prevArticleUrlRef.current !== url) {
      stop();
    }
    prevArticleUrlRef.current = url;

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
    stop,
  ]);

  // コンポーネントのアンマウント時（リーダー画面から離れるとき）に再生を停止する
  useEffect(() => {
    return () => {
      stopRef.current();
      setPlaybackSourceRef.current?.(null);
    };
  }, []);

  // ダウンロード機能（モバイルメニュー用）はReaderViewに集約されています
  const { status: downloadStatus, startDownload } = useDownload({
    articleUrl: url,
    chunks,
    voiceModel: effectiveVoiceModel,
    speed: playbackRate,
  });

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
          },
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
            },
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
        logger.error("Failed to initialize playlist from query", err),
      );
    }
  }, [
    playlistIdFromQuery,
    isPlaylistContextReady,
    initializeFromPlaylist,
    indexFromQuery,
    session,
  ]);

  const getPlaylistItemHref = useCallback(
    (index: number) => {
      if (
        playlistIdFromQuery &&
        playlistState.playlistId !== playlistIdFromQuery
      ) {
        return undefined;
      }

      const item = playlistState.items[index];
      const targetPlaylistId = playlistIdFromQuery || playlistState.playlistId;
      if (!item?.article?.url || !targetPlaylistId) {
        return undefined;
      }

      return createReaderUrl({
        articleUrl: item.article.url,
        playlistId: targetPlaylistId,
        playlistIndex: index,
        autoplay: false,
      });
    },
    [playlistIdFromQuery, playlistState.items, playlistState.playlistId],
  );

  // プレイリストのインデックスを循環させるユーティリティ
  const wrapIndex = useCallback(
    (index: number) => {
      const len = playlistState.items.length;
      if (len === 0) return 0;
      return ((index % len) + len) % len;
    },
    [playlistState.items.length],
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
                  disabled={isLoading || !arePlaylistsLoaded}
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
            <DesktopPlayerControls
              playbackRate={playbackRate}
              setIsSpeedModalOpen={setIsSpeedModalOpen}
              playlistState={playlistState}
              toggleShuffle={toggleShuffle}
              isPlaylistContextReady={isPlaylistContextReady}
              canMovePrevious={canMovePrevious}
              canMoveNext={canMoveNext}
              getPlaylistItemHref={getPlaylistItemHref}
              wrapIndex={wrapIndex}
              currentPlaylistIndex={activePlaylistIndex}
              isPlaying={isPlaying}
              play={play}
              pause={pause}
              isPlaybackLoading={isPlaybackLoading}
              toggleRepeatMode={toggleRepeatMode}
              articleId={articleId}
              setIsPlaylistModalOpen={setIsPlaylistModalOpen}
              url={url}
              startDownload={startDownload}
              downloadStatus={downloadStatus}
            />
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
        <MobilePlayerControls
          playbackRate={playbackRate}
          setIsSpeedModalOpen={setIsSpeedModalOpen}
          playlistState={playlistState}
          toggleShuffle={toggleShuffle}
          isPlaylistContextReady={isPlaylistContextReady}
          canMovePrevious={canMovePrevious}
          canMoveNext={canMoveNext}
          getPlaylistItemHref={getPlaylistItemHref}
          wrapIndex={wrapIndex}
          currentPlaylistIndex={activePlaylistIndex}
          isPlaying={isPlaying}
          play={play}
          pause={pause}
          isPlaybackLoading={isPlaybackLoading}
          toggleRepeatMode={toggleRepeatMode}
          articleId={articleId}
          setIsPlaylistModalOpen={setIsPlaylistModalOpen}
          url={url}
          startDownload={startDownload}
          downloadStatus={downloadStatus}
        />
      )}
    </div>
  );
}
