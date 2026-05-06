"use client";

import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { Chunk } from "@/types/api";
import { usePlayback } from "@/hooks/usePlayback";

export type AudioPlaybackSource = {
  chunks: Chunk[];
  articleUrl: string;
  voiceModel?: string;
  title?: string;
  author?: string;
  playbackSpeed?: number;
  onArticleEnd?: () => void;
};

export type AudioPlaybackContextType = {
  source: AudioPlaybackSource | null;
  setSource: (_next: AudioPlaybackSource | null) => void;
  isPlaying: boolean;
  isLoading: boolean;
  error: string;
  currentChunkId?: string;
  currentIndex: number;
  play: () => Promise<void>;
  pause: () => void;
  stop: () => void;
  next: () => Promise<void>;
  previous: () => Promise<void>;
  seekToChunk: (_chunkId: string) => Promise<void>;
  playbackRate: number;
  setPlaybackRate: (_rate: number) => void;
};

const AudioPlaybackContext = createContext<AudioPlaybackContextType | undefined>(
  undefined
);

export function AudioPlaybackProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [source, setSource] = useState<AudioPlaybackSource | null>(null);

  const playback = usePlayback({
    chunks: source?.chunks ?? [],
    articleUrl: source?.articleUrl,
    voiceModel: source?.voiceModel,
    playbackSpeed: source?.playbackSpeed,
    articleTitle: source?.title,
    articleAuthor: source?.author,
    onArticleEnd: source?.onArticleEnd,
  });
  const stopPlayback = playback.stop;

  const setPlaybackSource = useCallback(
    (next: AudioPlaybackSource | null) => {
      if (source && (!next || source.articleUrl !== next.articleUrl)) {
        stopPlayback();
      }
      setSource(next);
    },
    [source, stopPlayback]
  );

  const value: AudioPlaybackContextType = useMemo(
    () => ({
      source,
      setSource: setPlaybackSource,
      isPlaying: playback.isPlaying,
      isLoading: playback.isLoading,
      error: playback.error,
      currentChunkId: playback.currentChunkId,
      currentIndex: playback.currentIndex,
      play: playback.play,
      pause: playback.pause,
      stop: playback.stop,
      next: playback.next,
      previous: playback.previous,
      seekToChunk: playback.seekToChunk,
      playbackRate: playback.playbackRate,
      setPlaybackRate: playback.setPlaybackRate,
    }),
    [
      source,
      setPlaybackSource,
      playback.isPlaying,
      playback.isLoading,
      playback.error,
      playback.currentChunkId,
      playback.currentIndex,
      playback.play,
      playback.pause,
      playback.stop,
      playback.next,
      playback.previous,
      playback.seekToChunk,
      playback.playbackRate,
      playback.setPlaybackRate,
    ]
  );

  return (
    <AudioPlaybackContext.Provider value={value}>
      {children}
    </AudioPlaybackContext.Provider>
  );
}

export function useAudioPlayback(): AudioPlaybackContextType {
  const ctx = useContext(AudioPlaybackContext);
  if (!ctx) {
    throw new Error("useAudioPlayback must be used within AudioPlaybackProvider");
  }
  return ctx;
}
