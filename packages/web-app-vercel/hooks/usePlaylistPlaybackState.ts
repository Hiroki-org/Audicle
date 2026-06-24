"use client";

import React, {


  useState,
  useCallback,
  useEffect,
} from "react";
import { useRouter } from "next/navigation";
import { createReaderUrl } from "@/lib/urlBuilder";
import { STORAGE_KEYS } from "@/lib/constants";
import { logger } from "@/lib/logger";
import type { PlaylistItemWithArticle } from "@/types/playlist";

/**
 * リピートモード:
 * - "off"  : リピートなし（プレイリスト末尾で停止）
 * - "one"  : 1記事リピート（同じ記事を繰り返し再生）
 * - "all"  : プレイリストリピート（末尾到達後、先頭に戻る）
 */
export type RepeatMode = "off" | "one" | "all";

// デバッグログ用の定数
const DEBUG_QUEUE_PREVIEW_COUNT = 5; // キュー順序ログに出力するアイテム数
const DEBUG_TITLE_MAX_LENGTH = 30; // タイトルの最大文字数

/**
 * デバッグ用: キュー順序を表すオブジェクト配列を生成
 */
function createQueueOrderLog(items: PlaylistItemWithArticle[], count: number = DEBUG_QUEUE_PREVIEW_COUNT) {
  return items.slice(0, count).map((item, idx) => ({
    index: idx,
    articleId: item.article_id,
    title: item.article?.title?.substring(0, DEBUG_TITLE_MAX_LENGTH),
    position: item.position,
  }));
}

/**
 * デバッグ用: 記事タイトルを安全に切り詰める
 */
function truncateTitle(title: string | undefined): string | undefined {
  return title?.substring(0, DEBUG_TITLE_MAX_LENGTH);
}

export interface PlaylistPlaybackState {
  playlistId: string | null;
  playlistName: string | null;
  currentIndex: number;
  items: PlaylistItemWithArticle[];
  totalCount: number;
  isPlaylistMode: boolean;
  sortField: string | null;
  sortOrder: "asc" | "desc" | null;
  sortKey: string | null; // "position", "title", "title-desc", "added_at", "added_at-desc" など
  repeatMode: RepeatMode;
  shuffle: boolean;
  shuffledIndices: number[]; // シャッフル時のインデックス順序
}

export interface PlaylistPlaybackContextType {
  state: PlaylistPlaybackState;
  startPlaylistPlayback: (
    playlistId: string,
    playlistName: string,
    items: PlaylistItemWithArticle[],
    startIndex?: number,
    sortKey?: string
  ) => void;
  playNext: () => void;
  playPrevious: () => void;
  stopPlaylistPlayback: () => void;
  onArticleEnd: () => void;
  initializeFromArticle: (articleUrl: string) => Promise<void>;
  initializeFromPlaylist: (
    playlistId: string,
    startIndex?: number
  ) => Promise<void>;
  canMovePrevious: boolean;
  canMoveNext: boolean;
  toggleRepeatMode: () => void;
  toggleShuffle: () => void;
}


const STORAGE_KEY = STORAGE_KEYS.PLAYLIST_PLAYBACK;

function isPlayablePlaylistItem(item: PlaylistItemWithArticle | undefined): boolean {
  return Boolean(item?.article?.url);
}

/**
 * SortOptionをfieldとorderにパース
 */
function parseSortOption(sortOption: string | null): {
  field: string | null;
  order: "asc" | "desc" | null;
} {
  if (!sortOption) {
    return { field: "position", order: "asc" };
  }

  const [field, orderSuffix] = sortOption.split("-");
  const order: "asc" | "desc" = orderSuffix === "desc" ? "desc" : "asc";

  const validFields = ["position", "title", "added_at"];
  if (validFields.includes(field)) {
    return { field, order };
  }

  logger.warn(`Unsupported sort option found in localStorage: ${sortOption}`);
  return { field: "position", order: "asc" };
}

/**
 * Fisher-Yates シャッフルアルゴリズムでインデックス配列を生成
 */
export function generateShuffledIndices(length: number, currentIndex?: number): number[] {
  const indices = Array.from({ length }, (_, i) => i);
  // Fisher-Yates shuffle
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  // 現在再生中のインデックスを先頭に持ってくる
  if (currentIndex !== undefined && currentIndex >= 0 && currentIndex < length) {
    const pos = indices.indexOf(currentIndex);
    if (pos > 0) {
      [indices[0], indices[pos]] = [indices[pos], indices[0]];
    }
  }
  return indices;
}

function savePlaybackState(state: PlaylistPlaybackState): void {
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          playlistId: state.playlistId,
          playlistName: state.playlistName,
          currentIndex: state.currentIndex,
          items: state.items,
          totalCount: state.totalCount,
          isPlaylistMode: state.isPlaylistMode,
          sortField: state.sortField,
          sortOrder: state.sortOrder,
          sortKey: state.sortKey,
          repeatMode: state.repeatMode,
          shuffle: state.shuffle,
          shuffledIndices: state.shuffledIndices,
        })
      );
    } catch (error) {
      console.error("Failed to save playlist playback state:", error);
    }
  }
}

/**
 * localStorageからプレイリスト再生状態を読み込む
 */
function loadPlaybackState(): Partial<PlaylistPlaybackState> | null {
  if (typeof window !== "undefined") {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch (error) {
      console.error("Failed to load playlist playback state:", error);
      return null;
    }
  }
  return null;
}

export function usePlaylistPlaybackState(): PlaylistPlaybackContextType {
  const router = useRouter();
  const [state, setState] = useState<PlaylistPlaybackState>(() => {
    const saved = loadPlaybackState();
    // バリデーション付きでrepeatMode/shuffle/shuffledIndicesを復元
    const validRepeatModes: RepeatMode[] = ["off", "one", "all"];
    const rawRepeatMode = (saved as PlaylistPlaybackState | null)?.repeatMode;
    const repeatMode: RepeatMode = rawRepeatMode && validRepeatModes.includes(rawRepeatMode)
      ? rawRepeatMode
      : "off";
    const rawShuffle = (saved as PlaylistPlaybackState | null)?.shuffle;
    const shuffle = typeof rawShuffle === "boolean" ? rawShuffle : false;
    const rawShuffledIndices = (saved as PlaylistPlaybackState | null)?.shuffledIndices;
    const shuffledIndices = Array.isArray(rawShuffledIndices)
      ? rawShuffledIndices.filter((v): v is number => typeof v === "number")
      : [];

    return {
      playlistId: saved?.playlistId || null,
      playlistName: saved?.playlistName || null,
      currentIndex: saved?.currentIndex || 0,
      items: saved?.items || [],
      totalCount: saved?.totalCount || 0,
      isPlaylistMode: saved?.isPlaylistMode || false,
      sortField: saved?.sortField || null,
      sortOrder: saved?.sortOrder || null,
      sortKey: saved?.sortKey || null,
      repeatMode,
      shuffle,
      shuffledIndices,
    };
  });

  // 状態が変わったらlocalStorageに保存
  useEffect(() => {
    savePlaybackState(state);
    logger.info("プレイリスト状態を保存", {
      playlistId: state.playlistId,
      currentIndex: state.currentIndex,
      totalCount: state.totalCount,
      itemsCount: state.items.length,
    });
  }, [state]);

  const startPlaylistPlayback = useCallback(
    (
      playlistId: string,
      playlistName: string,
      items: PlaylistItemWithArticle[],
      startIndex: number = 0,
      sortKey?: string
    ) => {
      const startItem = items[startIndex];
      if (!playlistId || startIndex < 0 || startIndex >= items.length || !isPlayablePlaylistItem(startItem)) {
        logger.warn("プレイリスト再生開始をスキップ: 再生可能な記事URLがありません", {
          playlistId,
          startIndex,
          itemsLength: items.length,
          articleId: startItem?.article_id,
          articleUrl: startItem?.article?.url,
        });
        return;
      }

      // デバッグ: 再生開始時のキュー順序を出力
      logger.info("プレイリスト再生開始", {
        playlistId,
        playlistName,
        startIndex,
        totalCount: items.length,
        sortKey: sortKey || "position",
        queueOrder: createQueueOrderLog(items),
      });

      // sortKeyからsortFieldとsortOrderをパース
      const { field: sortField, order: sortOrder } = parseSortOption(sortKey || null);

      setState((prev) => {
        const shuffle = prev.shuffle;
        const shuffledIndices = shuffle
          ? generateShuffledIndices(items.length, startIndex)
          : [];
        return {
          playlistId,
          playlistName,
          currentIndex: startIndex,
          items,
          totalCount: items.length,
          isPlaylistMode: true,
          sortField,
          sortOrder,
          sortKey: sortKey || "position",
          repeatMode: prev.repeatMode,
          shuffle,
          shuffledIndices,
        };
      });

      // 最初の記事に遷移（自動再生フラグ付き）
      if (items.length > startIndex) {
        const firstItem = items[startIndex];
        if (firstItem.article?.url) {
          const readerUrl = createReaderUrl({
            articleUrl: firstItem.article.url,
            playlistId,
            playlistIndex: startIndex,
            autoplay: true,
          });
          router.push(readerUrl);
        }
      }
    },
    [router]
  );

  /**
   * シャッフルモードで次のインデックスを取得するヘルパー
   */
  const getNextShuffleIndex = useCallback((prevState: PlaylistPlaybackState): number | null => {
    const { shuffledIndices, currentIndex } = prevState;
    if (shuffledIndices.length === 0) return null;
    const currentShufflePos = shuffledIndices.indexOf(currentIndex);
    if (currentShufflePos === -1) {
      // currentIndexがシャッフル配列にない場合は先頭から
      return shuffledIndices[0];
    }
    const nextShufflePos = currentShufflePos + 1;
    if (nextShufflePos >= shuffledIndices.length) {
      // シャッフルリストの終端
      if (prevState.repeatMode === "all") {
        // リピートall: 新しいシャッフル順を生成して先頭から
        return null; // 呼び出し側で再シャッフル
      }
      return null; // 終端
    }
    return shuffledIndices[nextShufflePos];
  }, []);

  /**
   * シャッフルモードで前のインデックスを取得するヘルパー
   */
  const getPrevShuffleIndex = useCallback((prevState: PlaylistPlaybackState): number | null => {
    const { shuffledIndices, currentIndex } = prevState;
    if (shuffledIndices.length === 0) return null;
    const currentShufflePos = shuffledIndices.indexOf(currentIndex);
    if (currentShufflePos <= 0) {
      // 先頭 → リピートallなら末尾、そうでなければnull
      if (prevState.repeatMode === "all") {
        return shuffledIndices[shuffledIndices.length - 1];
      }
      return null;
    }
    return shuffledIndices[currentShufflePos - 1];
  }, []);

  const playNext = useCallback(() => {
    setState((prevState) => {
      // デバッグ: 次曲決定ロジックの入力値を出力
      logger.info("playNext: 次曲決定ロジック開始", {
        playlistId: prevState.playlistId,
        currentIndex: prevState.currentIndex,
        itemsLength: prevState.items.length,
        isPlaylistMode: prevState.isPlaylistMode,
        sortKey: prevState.sortKey,
        repeatMode: prevState.repeatMode,
        shuffle: prevState.shuffle,
        currentArticleId: prevState.items[prevState.currentIndex]?.article_id,
        currentArticleTitle: truncateTitle(prevState.items[prevState.currentIndex]?.article?.title),
      });

      if (!prevState.isPlaylistMode || prevState.items.length === 0) {
        logger.warn(
          "playNext: プレイリストの最後またはプレイリストモードではない",
          {
            isPlaylistMode: prevState.isPlaylistMode,
            currentIndex: prevState.currentIndex,
            itemsCount: prevState.items.length,
          }
        );
        return prevState;
      }

      let nextIndex: number;

      if (prevState.shuffle) {
        // シャッフルモード
        const next = getNextShuffleIndex(prevState);
        if (next === null) {
          if (prevState.repeatMode === "all") {
            // 再シャッフルして先頭から
            const newShuffled = generateShuffledIndices(prevState.items.length);
            nextIndex = newShuffled[0];
            const nextItem = prevState.items[nextIndex];
            if (nextItem?.article?.url && prevState.playlistId) {
              router.push(createReaderUrl({
                articleUrl: nextItem.article.url,
                playlistId: prevState.playlistId,
                playlistIndex: nextIndex,
                autoplay: true,
              }));
              return { ...prevState, currentIndex: nextIndex, shuffledIndices: newShuffled };
            }
            return prevState;
          }
          // シャッフルリスト終端 & repeatモードがoffの場合: wrap-aroundで循環
          nextIndex = prevState.shuffledIndices[0] ?? ((prevState.currentIndex + 1) % prevState.items.length);
        } else {
          nextIndex = next;
        }
      } else {
        // 通常モード: wrap-around
        nextIndex = (prevState.currentIndex + 1) % prevState.items.length;
      }

      const nextItem = prevState.items[nextIndex];

      logger.info("次の記事へ移動", {
        currentIndex: prevState.currentIndex,
        nextIndex,
        totalCount: prevState.items.length,
        nextArticleId: nextItem?.article_id,
        nextArticleTitle: truncateTitle(nextItem?.article?.title),
        articleUrl: nextItem?.article?.url,
      });

      if (nextItem && nextItem.article?.url && prevState.playlistId) {
        const nextUrl = createReaderUrl({
          articleUrl: nextItem.article.url,
          playlistId: prevState.playlistId,
          playlistIndex: nextIndex,
          autoplay: true,
        });
        router.push(nextUrl);

        return {
          ...prevState,
          currentIndex: nextIndex,
        };
      }

      // デバッグ: 失敗時の状態を出力
      logger.error("playNext: 次の記事への移動に失敗", {
        nextItemExists: !!nextItem,
        nextArticleUrl: nextItem?.article?.url,
        playlistId: prevState.playlistId,
      });

      return prevState;
    });
  }, [router, getNextShuffleIndex]);

  const playPrevious = useCallback(() => {
    setState((prevState) => {
      // デバッグ: 前曲決定ロジックの入力値を出力
      logger.info("playPrevious: 前曲決定ロジック開始", {
        playlistId: prevState.playlistId,
        currentIndex: prevState.currentIndex,
        itemsLength: prevState.items.length,
        isPlaylistMode: prevState.isPlaylistMode,
        sortKey: prevState.sortKey,
        repeatMode: prevState.repeatMode,
        shuffle: prevState.shuffle,
        currentArticleId: prevState.items[prevState.currentIndex]?.article_id,
        currentArticleTitle: truncateTitle(prevState.items[prevState.currentIndex]?.article?.title),
      });

      if (!prevState.isPlaylistMode || prevState.items.length === 0) {
        logger.warn(
          "playPrevious: プレイリストの最初またはプレイリストモードではない",
          {
            isPlaylistMode: prevState.isPlaylistMode,
            currentIndex: prevState.currentIndex,
          }
        );
        return prevState;
      }

      let prevIndex: number;

      if (prevState.shuffle) {
        // シャッフルモード
        const prev = getPrevShuffleIndex(prevState);
        if (prev === null) {
          // 先頭: シャッフルキューの最後へ wrap-around
          if (prevState.shuffledIndices.length > 0) {
            prevIndex = prevState.shuffledIndices[prevState.shuffledIndices.length - 1];
          } else {
            prevIndex = (prevState.currentIndex - 1 + prevState.items.length) % prevState.items.length;
          }
        } else {
          prevIndex = prev;
        }
      } else {
        // 通常モード: wrap-around
        prevIndex =
          (prevState.currentIndex - 1 + prevState.items.length) %
          prevState.items.length;
      }

      const prevItem = prevState.items[prevIndex];

      logger.info("前の記事へ移動", {
        currentIndex: prevState.currentIndex,
        prevIndex,
        totalCount: prevState.items.length,
        prevArticleId: prevItem?.article_id,
        prevArticleTitle: truncateTitle(prevItem?.article?.title),
        articleUrl: prevItem?.article?.url,
      });

      if (prevItem && prevItem.article?.url && prevState.playlistId) {
        const prevUrl = createReaderUrl({
          articleUrl: prevItem.article.url,
          playlistId: prevState.playlistId,
          playlistIndex: prevIndex,
          autoplay: true,
        });
        router.push(prevUrl);

        return {
          ...prevState,
          currentIndex: prevIndex,
        };
      }

      // デバッグ: 失敗時の状態を出力
      logger.error("playPrevious: 前の記事への移動に失敗", {
        prevItemExists: !!prevItem,
        prevArticleUrl: prevItem?.article?.url,
        playlistId: prevState.playlistId,
      });

      return prevState;
    });
  }, [router, getPrevShuffleIndex]);

  const stopPlaylistPlayback = useCallback(() => {
    setState({
      playlistId: null,
      playlistName: null,
      currentIndex: 0,
      items: [],
      totalCount: 0,
      isPlaylistMode: false,
      sortField: null,
      sortOrder: null,
      sortKey: null,
      repeatMode: "off",
      shuffle: false,
      shuffledIndices: [],
    });
  }, []);

  const onArticleEnd = useCallback(() => {
    setState((prevState) => {
      // デバッグ: 記事終了時の状態を出力
      logger.info("onArticleEnd: 記事再生終了", {
        playlistId: prevState.playlistId,
        currentIndex: prevState.currentIndex,
        itemsLength: prevState.items.length,
        isPlaylistMode: prevState.isPlaylistMode,
        sortKey: prevState.sortKey,
        repeatMode: prevState.repeatMode,
        shuffle: prevState.shuffle,
        currentArticleId: prevState.items[prevState.currentIndex]?.article_id,
        currentArticleTitle: truncateTitle(prevState.items[prevState.currentIndex]?.article?.title),
      });

      if (!prevState.isPlaylistMode) {
        logger.info("onArticleEnd: プレイリストモードではない");
        return prevState;
      }

      // リピート1: 同じ記事を再生
      if (prevState.repeatMode === "one") {
        logger.info("onArticleEnd: リピート1モード - 同じ記事を再生", {
          currentIndex: prevState.currentIndex,
        });
        const currentItem = prevState.items[prevState.currentIndex];
        if (currentItem?.article?.url && prevState.playlistId) {
          router.push(createReaderUrl({
            articleUrl: currentItem.article.url,
            playlistId: prevState.playlistId,
            playlistIndex: prevState.currentIndex,
            autoplay: true,
          }));
        }
        return prevState;
      }

      logger.info("記事終了", {
        currentIndex: prevState.currentIndex,
        totalCount: prevState.items.length,
        itemsCount: prevState.items.length,
      });

      if (prevState.items.length > 0) {
        let nextIndex: number;
        let newShuffledIndices = prevState.shuffledIndices;

        if (prevState.shuffle) {
          // シャッフルモード
          const next = getNextShuffleIndex(prevState);
          if (next === null) {
            if (prevState.repeatMode === "all") {
              // リピートall + シャッフル: 新シャッフル順で先頭から
              newShuffledIndices = generateShuffledIndices(prevState.items.length);
              nextIndex = newShuffledIndices[0];
            } else {
              // リピートoff + シャッフル: プレイリスト終了
              logger.info("onArticleEnd: シャッフルリスト終了（リピートoff）");
              return prevState;
            }
          } else {
            nextIndex = next;
          }
        } else {
          // 通常モード
          const isLastItem = prevState.currentIndex >= prevState.items.length - 1;
          if (isLastItem && prevState.repeatMode === "off") {
            // リピートoff: プレイリスト終了
            logger.info("onArticleEnd: プレイリスト最後（リピートoff）");
            return prevState;
          }
          // リピートall or 途中: 循環
          nextIndex = (prevState.currentIndex + 1) % prevState.items.length;
        }

        const nextItem = prevState.items[nextIndex];

        logger.info("自動的に次の記事へ遷移", {
          nextIndex,
          totalCount: prevState.items.length,
          nextArticleId: nextItem?.article_id,
          nextArticleTitle: truncateTitle(nextItem?.article?.title),
          articleUrl: nextItem?.article?.url,
        });

        if (nextItem && nextItem.article?.url && prevState.playlistId) {
          const nextUrl = createReaderUrl({
            articleUrl: nextItem.article.url,
            playlistId: prevState.playlistId,
            playlistIndex: nextIndex,
            autoplay: true,
          });
          router.push(nextUrl);
        } else {
          // デバッグ: 失敗時の状態を出力
          logger.error("onArticleEnd: 次の記事への遷移に失敗", {
            nextItemExists: !!nextItem,
            nextArticleUrl: nextItem?.article?.url,
            playlistId: prevState.playlistId,
          });
        }

        return { ...prevState, currentIndex: nextIndex, shuffledIndices: newShuffledIndices };
      }

      // プレイリストの最後に到達
      logger.info("プレイリストの最後に到達", {
        totalCount: prevState.items.length,
      });
      return prevState;
    });
  }, [router, getNextShuffleIndex]);

  /**
   * 記事URLからプレイリストを自動検出して初期化
   */
  const initializeFromArticle = useCallback(async (articleUrl: string) => {
    try {
      logger.info("記事からプレイリストを検出", { articleUrl });

      // 記事が属するプレイリスト一覧を取得
      const response = await fetch(
        `/api/articles-by-url/${encodeURIComponent(articleUrl)}/playlists`
      );

      if (!response.ok) {
        logger.warn("プレイリストの取得に失敗", { status: response.status });
        return;
      }

      const playlists = await response.json();

      if (!Array.isArray(playlists) || playlists.length === 0) {
        logger.info("記事が属するプレイリストなし");
        return;
      }

      // デフォルトプレイリストを優先、なければ最初のプレイリスト
      const targetPlaylist =
        playlists.find((p) => p.is_default) || playlists[0];

      logger.info("プレイリストを選択", {
        playlistId: targetPlaylist.id,
        playlistName: targetPlaylist.name,
        isDefault: targetPlaylist.is_default,
      });

      // localStorageからsortオプションを読み込み
      const sortKey = `${STORAGE_KEYS.PLAYLIST_SORT_PREFIX}${targetPlaylist.id}`;
      const savedSortOption =
        typeof window !== "undefined" ? localStorage.getItem(sortKey) : null;
      const { field: sortField, order: sortOrder } =
        parseSortOption(savedSortOption);

      // APIにソートパラメータを渡す
      const queryParams = new URLSearchParams();
      if (sortField && sortOrder) {
        queryParams.set("sortField", sortField);
        queryParams.set("sortOrder", sortOrder);
      }
      const apiUrl = `/api/playlists/${targetPlaylist.id}${queryParams.toString() ? `?${queryParams.toString()}` : ""}`;

      // プレイリスト内のアイテムを取得
      const itemsResponse = await fetch(apiUrl);

      if (!itemsResponse.ok) {
        logger.warn("プレイリストアイテムの取得に失敗", {
          status: itemsResponse.status,
        });
        return;
      }

      const playlistData = await itemsResponse.json();
      const items: PlaylistItemWithArticle[] = playlistData.items || [];

      // 現在の記事のインデックスを特定
      const currentIndex = items.findIndex(
        (item) => item.article?.url === articleUrl
      );

      if (currentIndex === -1) {
        logger.warn("プレイリスト内に記事が見つからない", { articleUrl });
        return;
      }

      logger.success("プレイリストコンテキストを初期化", {
        playlistId: targetPlaylist.id,
        currentIndex,
        totalCount: items.length,
      });

      // プレイリストコンテキストを初期化（ページ遷移なし）
      setState((prev) => ({
        playlistId: targetPlaylist.id,
        playlistName: targetPlaylist.name,
        currentIndex,
        items,
        totalCount: items.length,
        isPlaylistMode: true,
        sortField,
        sortOrder,
        sortKey: savedSortOption || "position",
        repeatMode: prev.repeatMode,
        shuffle: prev.shuffle,
        shuffledIndices: prev.shuffle
          ? generateShuffledIndices(items.length, currentIndex)
          : [],
      }));
    } catch (error) {
      logger.error("プレイリスト初期化エラー", error);
    }
  }, []);

  const initializeFromPlaylist = useCallback(
    async (playlistId: string, startIndex: number = 0) => {
      try {
        logger.info("プレイリストをIDから初期化", { playlistId, startIndex });

        // localStorageからsortオプションを読み込み
        const sortKey = `${STORAGE_KEYS.PLAYLIST_SORT_PREFIX}${playlistId}`;
        const savedSortOption =
          typeof window !== "undefined" ? localStorage.getItem(sortKey) : null;
        const { field: sortField, order: sortOrder } =
          parseSortOption(savedSortOption);

        logger.info("プレイリストソート設定を読み込み", {
          playlistId,
          sortKey,
          savedSortOption,
          sortField,
          sortOrder,
        });

        // APIにソートパラメータを渡す
        const queryParams = new URLSearchParams();
        if (sortField && sortOrder) {
          queryParams.set("sortField", sortField);
          queryParams.set("sortOrder", sortOrder);
        }
        const apiUrl = `/api/playlists/${playlistId}${queryParams.toString() ? `?${queryParams.toString()}` : ""}`;

        const res = await fetch(apiUrl);
        if (!res.ok) {
          logger.warn("プレイリスト取得失敗", {
            playlistId,
            status: res.status,
          });

          // API失敗時: localStorageの状態がこのプレイリストの有効なデータを持っているか確認
          // 持っていれば、プレイリストモードを維持（古いアイテムでフォールバック）
          setState((prev) => {
            if (
              prev.isPlaylistMode &&
              prev.playlistId === playlistId &&
              prev.items.length > 0
            ) {
              logger.info(
                "API失敗: localStorageのキャッシュデータでプレイリストモードを維持",
                {
                  playlistId,
                  cachedItemsCount: prev.items.length,
                  currentIndex: startIndex,
                }
              );
              const index = Math.max(
                0,
                Math.min(startIndex, prev.items.length - 1)
              );
              return {
                ...prev,
                currentIndex: index,
                sortField,
                sortOrder,
                sortKey: savedSortOption || "position",
                shuffledIndices: prev.shuffle
                  ? generateShuffledIndices(prev.items.length, index)
                  : prev.shuffledIndices,
              };
            }
            return prev;
          });
          return;
        }

        const playlistData = await res.json();
        const items: PlaylistItemWithArticle[] = playlistData.items || [];

        if (!Array.isArray(items) || items.length === 0) {
          logger.info("プレイリストにアイテムがないため初期化しない", {
            playlistId,
          });
          return;
        }

        const index = Math.max(0, Math.min(startIndex, items.length - 1));

        // デバッグ: 初期化時のキュー順序を出力
        logger.info("プレイリストコンテキストを初期化", {
          playlistId: playlistData.id,
          playlistName: playlistData.name,
          currentIndex: index,
          totalCount: items.length,
          sortKey: savedSortOption || "position",
          queueOrder: createQueueOrderLog(items),
        });

        setState((prev) => ({
          playlistId: playlistData.id,
          playlistName: playlistData.name,
          currentIndex: index,
          items,
          totalCount: items.length,
          isPlaylistMode: true,
          sortField,
          sortOrder,
          sortKey: savedSortOption || "position",
          repeatMode: prev.repeatMode,
          shuffle: prev.shuffle,
          shuffledIndices: prev.shuffle
            ? generateShuffledIndices(items.length, index)
            : [],
        }));
      } catch (error) {
        logger.error("initializeFromPlaylist error", error);
      }
    },
    []
  );

  // With circular navigation enabled, Prev/Next are available as long as items exist
  const canMovePrevious = state.items.length > 0;
  const canMoveNext = state.items.length > 0;

  /**
   * リピートモードをトグル: off → all → one → off
   */
  const toggleRepeatMode = useCallback(() => {
    setState((prev) => {
      const nextMode: RepeatMode =
        prev.repeatMode === "off" ? "all" : prev.repeatMode === "all" ? "one" : "off";
      logger.info("リピートモード変更", {
        from: prev.repeatMode,
        to: nextMode,
      });
      return { ...prev, repeatMode: nextMode };
    });
  }, []);

  /**
   * シャッフルモードをトグル
   */
  const toggleShuffle = useCallback(() => {
    setState((prev) => {
      const newShuffle = !prev.shuffle;
      logger.info("シャッフルモード変更", {
        shuffle: newShuffle,
      });
      return {
        ...prev,
        shuffle: newShuffle,
        shuffledIndices: newShuffle
          ? generateShuffledIndices(prev.items.length, prev.currentIndex)
          : [],
      };
    });
  }, []);

  const value: PlaylistPlaybackContextType = {
    state,
    startPlaylistPlayback,
    playNext,
    playPrevious,
    stopPlaylistPlayback,
    onArticleEnd,
    initializeFromArticle,
    initializeFromPlaylist,
    canMovePrevious,
    canMoveNext,
    toggleRepeatMode,
    toggleShuffle,
  };

  return value;
}
