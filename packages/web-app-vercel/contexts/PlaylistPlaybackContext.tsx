"use client";

import React, { createContext, useContext } from "react";
import {
  usePlaylistPlaybackState,
  type RepeatMode,
  type PlaylistPlaybackState,
  type PlaylistPlaybackContextType,
  generateShuffledIndices,
} from "@/hooks/usePlaylistPlaybackState";

export type { RepeatMode, PlaylistPlaybackState, PlaylistPlaybackContextType };
export { generateShuffledIndices };

const PlaylistPlaybackContext = createContext<
  PlaylistPlaybackContextType | undefined
>(undefined);

export function PlaylistPlaybackProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const value = usePlaylistPlaybackState();

  return (
    <PlaylistPlaybackContext.Provider value={value}>
      {children}
    </PlaylistPlaybackContext.Provider>
  );
}

export function usePlaylistPlayback(): PlaylistPlaybackContextType {
  const context = useContext(PlaylistPlaybackContext);
  if (!context) {
    throw new Error(
      "usePlaylistPlayback must be used within PlaylistPlaybackProvider"
    );
  }
  return context;
}
