import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { usePlaylistPlayback } from "@/contexts/PlaylistPlaybackContext";
import { getPlaylistSortKey } from "@/lib/playlist-utils";
import { createReaderUrl } from "@/lib/urlBuilder";
import { logger } from "@/lib/logger";

export function useReaderState(
  playlistIdFromQuery: string | null,
  indexFromQuery: string | null,
  playlistState: ReturnType<typeof usePlaylistPlayback>["state"]
) {
  const router = useRouter();

  const [currentPlaylistIndex, setCurrentPlaylistIndex] = useState<number>(
    indexFromQuery ? parseInt(indexFromQuery, 10) : 0,
  );

  const playlistIndexFromUrl =
    indexFromQuery !== null ? parseInt(indexFromQuery, 10) : null;

  const activePlaylistIndex =
    playlistIndexFromUrl !== null && !Number.isNaN(playlistIndexFromUrl)
      ? playlistIndexFromUrl
      : currentPlaylistIndex;

  const [isPlaylistMode] = useState<boolean>(!!playlistIdFromQuery);
  const [showCompletionScreen, setShowCompletionScreen] = useState(false);

  const currentSortKey = playlistIdFromQuery
    ? getPlaylistSortKey(playlistIdFromQuery)
    : null;

  const isPlaylistContextReady =
    !!playlistIdFromQuery &&
    playlistState.isPlaylistMode &&
    playlistState.playlistId === playlistIdFromQuery &&
    playlistState.items.length > 0 &&
    playlistState.sortKey === currentSortKey;

  const [isPlaylistModalOpen, setIsPlaylistModalOpen] = useState(false);
  const [isSpeedModalOpen, setIsSpeedModalOpen] = useState(false);
  const [hasLoadedFromQuery, setHasLoadedFromQuery] = useState(false);

  const [isClient, setIsClient] = useState(false);
  useEffect(() => {
    setIsClient(true);
  }, []);

  const hasInitiatedAutoplayRef = useRef(false);
  const prevArticleUrlRef = useRef<string>("");

  const navigateToPlaylistItem = useCallback(
    (index: number) => {
      logger.info("Prev/Next navigation requested", {
        playlistIdFromQuery,
        playlistStatePlaylistId: playlistState.playlistId,
        currentPlaylistIndex,
        activePlaylistIndex,
        playlistStateCurrentIndex: playlistState.currentIndex,
        targetIndex: index,
        itemsLength: playlistState.items.length,
      });

      if (index === activePlaylistIndex) {
        logger.info("Skip navigation: same index", {
          index,
          activePlaylistIndex,
        });
        return;
      }

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
        setCurrentPlaylistIndex(index);
        router.push(readerUrl);
      }
    },
    [playlistIdFromQuery, playlistState, router, activePlaylistIndex, currentPlaylistIndex],
  );

  return {
    currentPlaylistIndex, setCurrentPlaylistIndex,
    activePlaylistIndex,
    isPlaylistMode,
    showCompletionScreen, setShowCompletionScreen,
    isPlaylistContextReady,
    isPlaylistModalOpen, setIsPlaylistModalOpen,
    isSpeedModalOpen, setIsSpeedModalOpen,
    hasLoadedFromQuery, setHasLoadedFromQuery,
    isClient,
    hasInitiatedAutoplayRef,
    prevArticleUrlRef,
    navigateToPlaylistItem
  };
}
