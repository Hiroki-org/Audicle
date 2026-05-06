"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Chunk } from "@/types/api";
import { audioCache } from "@/lib/audioCache";
import { getAudioChunk } from "@/lib/indexedDB";

import { synthesizeSpeech } from "@/lib/api";
import { logger } from "@/lib/logger";
import { needsPauseBefore, needsPauseAfter, getPauseDuration } from "@/lib/paragraphParser";
import { useMediaSession } from "./useMediaSession";

interface UsePlaybackProps {
  chunks: Chunk[];
  articleUrl?: string;
  voiceModel?: string;       // 音声モデル（例: 'ja-JP-Standard-B'）
  playbackSpeed?: number;    // 再生速度（例: 1.0, 1.5, 2.0）
  onChunkChange?: (chunkId: string) => void;
  onArticleEnd?: () => void; // 記事の再生終了時のコールバック
  articleTitle?: string;     // 記事タイトル（Media Session用）
  articleAuthor?: string;    // 記事著者またはサイト名（Media Session用）
}

const PREFETCH_AHEAD = 3; // 3つ先まで先読み

// localStorage のキー定数
const PLAYBACK_RATE_STORAGE_KEY = "audicle-playback-rate";
const DEFAULT_PLAYBACK_RATE = 1.0;
const DEFAULT_SEEK_OFFSET_SECONDS = 10;

/**
 * 指定時間待機する
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shouldRespectInterChunkDelay(): boolean {
  // iOS PWA(standalone)やロック画面/バックグラウンドではタイマーが強く制限され、
  // onended後の遅延が次チャンク開始を妨げることがある。
  if (typeof document === "undefined") return true;
  return document.visibilityState === "visible";
}

export function usePlayback({ chunks, articleUrl, voiceModel, playbackSpeed, onChunkChange, onArticleEnd, articleTitle, articleAuthor }: UsePlaybackProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentIndex, setCurrentIndex] = useState<number>(-1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [playbackRate, setPlaybackRate] = useState<number>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(PLAYBACK_RATE_STORAGE_KEY);
        return saved ? parseFloat(saved) : DEFAULT_PLAYBACK_RATE;
      } catch (error) {
        logger.warn("Failed to load playback rate from localStorage", error);
        return DEFAULT_PLAYBACK_RATE;
      }
    }
    return DEFAULT_PLAYBACK_RATE;
  });

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentAudioUrlRef = useRef<string | null>(null);
  const onArticleEndRef = useRef<(() => void) | undefined>(onArticleEnd);
  // 再生処理が進行中かどうかを追跡するフラグ
  const isPlayingRequestInProgressRef = useRef<boolean>(false);
  // `playFromIndex` と `handleAudioEnded` の間の循環参照を解決するためのRef。
  // `handleAudioEnded` は `useCallback` でメモ化されていますが、内部で `playFromIndex` を呼び出す必要があります。
  // `playFromIndex` も `handleAudioEnded` に依存しているため、単純に依存配列に加えると循環参照が発生します。
  // このRefを通じて呼び出すことで、常に最新の `playFromIndex` を参照できるようにし、循環参照を回避します。
  const playFromIndexRef = useRef<(index: number) => Promise<void>>(async () => { });
  const positionStateCleanupRef = useRef<(() => void) | null>(null);

  // 現在のチャンクID
  const currentChunkId =
    currentIndex >= 0 && currentIndex < chunks.length
      ? chunks[currentIndex].id
      : undefined;

  // onArticleEndRefを同期
  useEffect(() => {
    onArticleEndRef.current = onArticleEnd;
  }, [onArticleEnd]);

  // playbackRateの変更をlocalStorageに保存
  useEffect(() => {
    try {
      localStorage.setItem(PLAYBACK_RATE_STORAGE_KEY, playbackRate.toString());
    } catch (error) {
      logger.warn("Failed to save playback rate to localStorage", error);
    }
  }, [playbackRate]);

  // playbackSpeedプロパティの変更をplaybackRateに反映
  useEffect(() => {
    if (playbackSpeed !== undefined) {
      setPlaybackRate(playbackSpeed);
    }
  }, [playbackSpeed]);

  // playbackRateを設定する関数
  const updatePlaybackRate = useCallback((rate: number) => {
    setPlaybackRate(rate);
    // localStorage を同期的に更新して競合状態を回避
    try {
      localStorage.setItem(PLAYBACK_RATE_STORAGE_KEY, rate.toString());
    } catch (error) {
      logger.warn("Failed to save playback rate to localStorage", error);
    }
    if (audioRef.current) {
      audioRef.current.playbackRate = rate;
    }
  }, []);

  // onended ハンドラを共通化
  const handleAudioEnded = useCallback(async (currentIndex: number) => {
    if (currentIndex < 0 || currentIndex >= chunks.length) {
      logger.warn("handleAudioEnded called with invalid index", {
        currentIndex,
        chunksLength: chunks.length,
      });
      return;
    }
    const chunk = chunks[currentIndex];
    // 見出しの後、または段落間にポーズ
    if (shouldRespectInterChunkDelay()) {
      if (needsPauseAfter(chunk.type)) {
        await sleep(getPauseDuration('heading'));
      } else {
        await sleep(getPauseDuration('paragraph'));
      }
    }

    // 次のチャンクがあれば自動的に再生
    if (currentIndex + 1 < chunks.length) {
      // onended からの連続再生は await せず非同期で開始
      void playFromIndexRef
        .current(currentIndex + 1)
        .catch((error) => {
          logger.error("Failed to auto-play next chunk", error);
        });
    } else {
      // 最後のチャンク終了時も URL を解放
      if (currentAudioUrlRef.current?.startsWith('blob:')) {
        URL.revokeObjectURL(currentAudioUrlRef.current);
      }
      setIsPlaying(false);
      setCurrentIndex(-1);

      // 記事の再生が終了したときにSupabaseインデックスを更新
      if (articleUrl && voiceModel) {
        fetch('/api/cache/update-completed', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            articleUrl,
            voice: voiceModel,
            completed: true
          })
        }).catch((err) => {
          logger.error('[Cache Update] Failed to update completed playback:', err);
        });


      }

      // 記事の再生が終了したときのコールバック
      onArticleEndRef.current?.();
    }
  }, [chunks, setIsPlaying, setCurrentIndex, articleUrl, voiceModel]);

  const updateMediaSessionPositionState = useCallback(() => {
    if (!("mediaSession" in navigator)) return;
    const mediaSession = navigator.mediaSession;
    const setPositionState = (mediaSession as unknown as {
      setPositionState?: (state: {
        duration: number;
        position?: number;
        playbackRate?: number;
      }) => void;
    }).setPositionState;

    if (!setPositionState || typeof setPositionState !== "function") return;
    const audio = audioRef.current;
    if (!audio) return;

    const duration = audio.duration;
    if (typeof duration !== "number" || !Number.isFinite(duration) || duration <= 0) {
      return;
    }
    const position =
      typeof audio.currentTime === "number" && Number.isFinite(audio.currentTime)
        ? Math.min(Math.max(audio.currentTime, 0), duration)
        : undefined;

    const playbackRate =
      typeof audio.playbackRate === "number" && Number.isFinite(audio.playbackRate)
        ? audio.playbackRate
        : undefined;

    try {
      setPositionState.call(mediaSession, { duration, position, playbackRate });
    } catch (error) {
      // Safari/PWA など実装差分があり得るため、握りつぶさずログだけ残す
      logger.warn('Failed to set Media Session position state', error);
    }
  }, []);

  const installPositionStateUpdater = useCallback((audio: HTMLAudioElement) => {
    if (typeof (audio as any).addEventListener !== "function") {
      return;
    }

    positionStateCleanupRef.current?.();

    const handler = () => updateMediaSessionPositionState();
    audio.addEventListener("timeupdate", handler);
    audio.addEventListener("durationchange", handler);
    audio.addEventListener("ratechange", handler);
    audio.addEventListener("loadedmetadata", handler);

    // 初回反映
    handler();

    positionStateCleanupRef.current = () => {
      audio.removeEventListener("timeupdate", handler);
      audio.removeEventListener("durationchange", handler);
      audio.removeEventListener("ratechange", handler);
      audio.removeEventListener("loadedmetadata", handler);
    };
  }, [updateMediaSessionPositionState]);

  const seekToSeconds = useCallback((positionSeconds: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    const duration = audio.duration;
    // durationが不明でもとりあえず設定（ブラウザ側がクランプする）
    const next =
      typeof duration === "number" && Number.isFinite(duration) && duration > 0
        ? Math.min(Math.max(positionSeconds, 0), duration)
        : Math.max(positionSeconds, 0);
    audio.currentTime = next;
    updateMediaSessionPositionState();
  }, [updateMediaSessionPositionState]);

  const seekBySeconds = useCallback((deltaSeconds: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    const base =
      typeof audio.currentTime === "number" && Number.isFinite(audio.currentTime)
        ? audio.currentTime
        : 0;
    seekToSeconds(base + deltaSeconds);
  }, [seekToSeconds]);


  // 音声URLを取得するヘルパー（IndexedDB → APIの順で試みる）
  const fetchAudioUrl = useCallback(
    async (index: number, forceRegenerate: boolean = false): Promise<string> => {
      const chunk = chunks[index];
      if (articleUrl && !forceRegenerate) {
        const cachedChunk = await getAudioChunk(articleUrl, index, voiceModel);
        if (cachedChunk) {
          return URL.createObjectURL(cachedChunk.audioData);
        }
      }
      return audioCache.get(chunk.cleanedText, voiceModel, articleUrl, forceRegenerate);
    },
    [chunks, articleUrl, voiceModel]
  );

  // 先読み処理（クリーンアップ済みテキストを使用）
  const prefetchAudio = useCallback(
    async (startIndex: number) => {
      const endIndex = Math.min(startIndex + PREFETCH_AHEAD, chunks.length);
      const textsToFetch = chunks
        .slice(startIndex, endIndex)
        .map((chunk) => chunk.cleanedText);

      if (textsToFetch.length > 0) {
        await audioCache.prefetch(textsToFetch, voiceModel, articleUrl);
      }
    },
    [chunks, voiceModel, articleUrl]
  );



  // 特定のインデックスから再生
  const playFromIndex = useCallback(
    async (index: number) => {
      if (index < 0 || index >= chunks.length) {
        logger.warn("無効なチャンクインデックス", {
          index,
          chunksLength: chunks.length,
        });
        return;
      }

      // 既に再生処理が進行中の場合は新しいリクエストを無視
      // フラグのチェックと設定を即座に行うことで競合状態を最小化
      if (isPlayingRequestInProgressRef.current) {
        logger.warn("再生リクエストが既に進行中のため、新しいリクエストをスキップします", {
          index,
        });
        return;
      }
      isPlayingRequestInProgressRef.current = true;

      setIsLoading(true);
      setError("");

      // 既存のオーディオをクリーンアップ
      if (audioRef.current) {
        if (currentAudioUrlRef.current?.startsWith("blob:")) {
          URL.revokeObjectURL(currentAudioUrlRef.current);
        }
        audioRef.current.pause();
      }

      try {
        // --- まず非同期処理で音声データを取得 ---
        const chunk = chunks[index];
        logger.info(
          `▶️ 再生開始: チャンク ${index + 1}/${chunks.length} (${chunk.type})`
        );

        if (shouldRespectInterChunkDelay() && needsPauseBefore(chunk.type)) {
          await sleep(getPauseDuration("heading"));
        }

        logger.info(`💾 音声取得: チャンク ${index + 1}/${chunks.length}`);
        const audioUrl = await fetchAudioUrl(index);

        // 先読み
        prefetchAudio(index + 1);

        // Audio要素を再利用し、音声データをセット
        const audio = audioRef.current ?? new Audio();
        audioRef.current = audio;
        try {
          audio.preload = "auto";
          audio.setAttribute("playsinline", "");
          audio.setAttribute("webkit-playsinline", "");
        } catch {
          // noop
        }

        // 古いハンドラをクリアしてから src をセット（旧ハンドラが誤発火するのを防ぐ）
        audio.onended = null;
        audio.onerror = null;
        audio.src = audioUrl;
        currentAudioUrlRef.current = audioUrl;

        installPositionStateUpdater(audio);

        // 再生速度を設定
        const rate = parseFloat(
          localStorage.getItem(PLAYBACK_RATE_STORAGE_KEY) || ""
        );
        audio.playbackRate = isNaN(rate) ? DEFAULT_PLAYBACK_RATE : rate;

        // play()を一度だけ呼び出す
        await audio.play();
        setIsPlaying(true); // 再生状態を更新

        // イベントハンドラを設定
        audio.onended = () => handleAudioEnded(index);
        audio.onerror = async (e) => {
          const mediaError = audio.error;

          if (mediaError?.code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED) {
            logger.warn("⚠️ Audio 404 detected (LRU deletion), attempting to re-fetch audio.", {
              chunkIndex: index,
              text: chunk.cleanedText.substring(0, 50),
              errorCode: mediaError.code,
              errorMessage: mediaError.message,
              audioUrl: audioUrl.substring(0, 50),
            });

            // Supabaseインデックスから削除（非同期で実行、エラーは無視）
            if (articleUrl && voiceModel) {
              fetch("/api/cache/remove", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  articleUrl,
                  voice: voiceModel,
                  text: chunk.cleanedText,
                  index,
                }),
              }).catch((fetchErr) => {
                logger.error(
                  "[Cache Remove] Failed to remove from Supabase index:",
                  fetchErr
                );
              });
            }

            // ハンドラを一旦クリアして再取得を試みる
            audio.onended = null;
            audio.onerror = null;
            if (currentAudioUrlRef.current?.startsWith("blob:")) {
              URL.revokeObjectURL(currentAudioUrlRef.current);
            }
            audio.src = "";
            currentAudioUrlRef.current = null;

            try {
              logger.info(`🔄 音声を強制再取得中: チャンク ${index + 1}`);
              const newUrl = await fetchAudioUrl(index, true);
              audio.src = newUrl;
              currentAudioUrlRef.current = newUrl;
              audio.playbackRate = isNaN(rate) ? DEFAULT_PLAYBACK_RATE : rate;
              await audio.play();
              // 再取得成功：ハンドラを再登録
              audio.onended = () => handleAudioEnded(index);
              audio.onerror = async (e2) => {
                const err2 = audio.error;
                const errorMessage2 = `音声の再生に失敗しました (Code: ${err2?.code})`;
                logger.error("音声再生エラー（再取得後）", { error: err2, event: e2, chunkIndex: index });
                setError(errorMessage2);
                setIsPlaying(false);
              };
              logger.info(`✅ 再取得成功: チャンク ${index + 1}`);
            } catch (refetchErr) {
              logger.warn(`⚠️ 再取得失敗: チャンク ${index + 1}、次のチャンクへスキップします。`, refetchErr);
              setError("一部の音声が再生できませんでした。次の部分から再開します。");
              // 次のチャンクへ進む
              void playFromIndexRef.current(index + 1).catch((skipErr) => {
                logger.error("次チャンクへのスキップ中にエラー", skipErr);
              });
            }
            return;
          }

          // その他のエラー
          const errorMessage = `音声の再生に失敗しました (URL: ${audioUrl}, Code: ${mediaError?.code})`;
          logger.error("音声再生エラー", {
            error: mediaError,
            event: e,
            audioUrl,
            chunkIndex: index,
            audioUrlType: audioUrl.startsWith("blob:") ? "blob" : "other",
          });
          setError(errorMessage);
          setIsPlaying(false);
        };

        setCurrentIndex(index);
        onChunkChange?.(chunk.id);
      } catch (err) {
        const error = err as Error;

        // AbortErrorは通常の操作で発生する可能性があるため、警告レベルで記録
        // (例: ユーザーが素早くクリック、ページ遷移、コンポーネントのアンマウント等)
        // これらはエラーではなく通常の動作なので、ユーザーにエラーを表示しない
        if (error.name === "AbortError") {
          logger.warn("再生が中断されました", {
            errorName: error.name,
            errorMessage: error.message,
            chunkIndex: index,
          });
          setError("");
          setIsPlaying(false);
        } else if (error.name === "NotAllowedError") {
          setError(
            "音声の再生がブラウザにブロックされました。ページをクリックしてから再度お試しください。"
          );
          logger.error("再生処理全体でエラー (NotAllowedError)", err);
          setIsPlaying(false);
        } else if (error.name === "NotSupportedError") {
          // play() が NotSupportedError をスローした場合（src が無効）、強制再取得を試みる
          logger.warn("⚠️ NotSupportedError が発生しました。音声を強制再取得します。", {
            chunkIndex: index,
            errorMessage: error.message,
          });
          const audio = audioRef.current;
          if (audio) {
            audio.onended = null;
            audio.onerror = null;
            if (currentAudioUrlRef.current?.startsWith("blob:")) {
              URL.revokeObjectURL(currentAudioUrlRef.current);
            }
            audio.src = "";
            currentAudioUrlRef.current = null;
          }
          try {
            const chunk = chunks[index];
            const newUrl = await fetchAudioUrl(index, true);
            if (audio) {
              audio.src = newUrl;
              currentAudioUrlRef.current = newUrl;
              const rate2 = parseFloat(localStorage.getItem(PLAYBACK_RATE_STORAGE_KEY) || "");
              audio.playbackRate = isNaN(rate2) ? DEFAULT_PLAYBACK_RATE : rate2;
              await audio.play();
              setIsPlaying(true);
              audio.onended = () => handleAudioEnded(index);
              audio.onerror = async (e3) => {
                const err3 = audio.error;
                logger.error("音声再生エラー（NotSupportedError後の再取得後）", { error: err3, event: e3, chunkIndex: index });
                setError(`音声の再生に失敗しました (Code: ${err3?.code})`);
                setIsPlaying(false);
              };
              setCurrentIndex(index);
              onChunkChange?.(chunk.id);
              logger.info(`✅ NotSupportedError後の再取得成功: チャンク ${index + 1}`);
              // 再取得・再生成功のため setIsPlaying(false) は呼ばない
            } else {
              setIsPlaying(false);
            }
          } catch (refetchErr2) {
            logger.warn(`⚠️ NotSupportedError後の再取得失敗: チャンク ${index + 1}、次のチャンクへスキップします。`, refetchErr2);
            setError("一部の音声が再生できませんでした。次の部分から再開します。");
            setIsPlaying(false);
            // isPlayingRequestInProgressRef をリセットしてから次チャンクへ
            isPlayingRequestInProgressRef.current = false;
            void playFromIndexRef.current(index + 1).catch((skipErr) => {
              logger.error("次チャンクへのスキップ中にエラー", skipErr);
            });
          }
        } else {
          setError(
            err instanceof Error ? err.message : "不明なエラーが発生しました"
          );
          logger.error("再生処理全体でエラー", err);
          setIsPlaying(false);
        }
      } finally {
        setIsLoading(false);
        isPlayingRequestInProgressRef.current = false;
      }
    },
    [
      chunks,
      articleUrl,
      voiceModel,
      onChunkChange,
      prefetchAudio,
      fetchAudioUrl,
      handleAudioEnded,
      installPositionStateUpdater,
    ]
  );

  useEffect(() => {
    playFromIndexRef.current = playFromIndex;
  }, [playFromIndex]);

  // 再生開始
  const play = useCallback(async () => {
    const startIndex = currentIndex >= 0 ? currentIndex : 0;
    await playFromIndex(startIndex);
  }, [currentIndex, playFromIndex]);

  // 一時停止
  const pause = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  }, []);

  // 停止
  const stop = useCallback(() => {
    if (audioRef.current) {
      if (currentAudioUrlRef.current?.startsWith('blob:')) {
        URL.revokeObjectURL(currentAudioUrlRef.current);
      }
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setIsPlaying(false);
    setCurrentIndex(-1);
  }, []);

  // 次のチャンクへ移動
  const next = useCallback(async () => {
    if (currentIndex < chunks.length - 1) {
      await playFromIndex(currentIndex + 1);
    }
  }, [currentIndex, chunks.length, playFromIndex]);

  // 前のチャンクへ移動
  const previous = useCallback(async () => {
    if (currentIndex > 0) {
      await playFromIndex(currentIndex - 1);
    } else if (currentIndex === 0) {
      // 最初のチャンクの場合は最初から再生
      await playFromIndex(0);
    }
  }, [currentIndex, playFromIndex]);

  // 特定のチャンクから再生（Seek機能）
  const seekToChunk = useCallback(
    async (chunkId: string) => {
      const index = chunks.findIndex((chunk) => chunk.id === chunkId);
      if (index >= 0) {
        await playFromIndex(index);
      }
    },
    [chunks, playFromIndex]
  );

  // Media Session APIの設定（バックグラウンド再生対応）
  useMediaSession({
    title: articleTitle || "記事を読み上げ中",
    artist: articleAuthor,
    isPlaying,
    onPlay: play,
    onPause: pause,
    onNextTrack: next,
    onPreviousTrack: previous,
    onStop: stop,
    onSeekTo: seekToSeconds,
    onSeekForward: (offsetSeconds?: number) =>
      seekBySeconds(
        typeof offsetSeconds === "number" ? offsetSeconds : DEFAULT_SEEK_OFFSET_SECONDS
      ),
    onSeekBackward: (offsetSeconds?: number) =>
      seekBySeconds(
        -1 *
        (typeof offsetSeconds === "number"
          ? offsetSeconds
          : DEFAULT_SEEK_OFFSET_SECONDS)
      ),
    getPositionState: () => {
      const audio = audioRef.current;
      if (!audio) return {};
      return {
        duration: audio.duration,
        position: audio.currentTime,
        playbackRate: audio.playbackRate,
      };
    },
  });

  // クリーンアップ
  useEffect(() => {
    return () => {
      positionStateCleanupRef.current?.();
      if (audioRef.current) {
        audioRef.current.pause();
      }
      if (currentAudioUrlRef.current?.startsWith('blob:')) {
        URL.revokeObjectURL(currentAudioUrlRef.current);
      }
    };
  }, []);

  return {
    isPlaying,
    isLoading,
    error,
    currentChunkId,
    currentIndex,
    play,
    pause,
    stop,
    next,
    previous,
    seekToChunk,
    playbackRate,
    setPlaybackRate: updatePlaybackRate,
  };
}
