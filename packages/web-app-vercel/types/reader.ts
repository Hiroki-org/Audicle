import { PlaylistPlaybackState } from "@/contexts/PlaylistPlaybackContext";
import { Chunk } from "@/types/api";

export interface ReaderControlsProps {
  chunks: Chunk[];
  playbackRate: number;
  setIsSpeedModalOpen: (open: boolean) => void;
  playlistState: PlaylistPlaybackState;
  isPlaylistContextReady: boolean;
  canMovePrevious: boolean;
  canMoveNext: boolean;
  navigateToPlaylistItem: (index: number) => void;
  wrapIndex: (index: number) => number;
  currentPlaylistIndex: number;
  isPlaying: boolean;
  isPlaybackLoading: boolean;
  pause: () => void;
  play: () => void;
  articleId: string | null;
  setIsPlaylistModalOpen: (open: boolean) => void;
  url: string;
  downloadStatus: string;
  startDownload: () => void;
}
