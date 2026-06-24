"use client";

import { useRouter } from "next/navigation";
import { RotateCcw, ChevronLeft } from "lucide-react";

interface PlaylistCompletionScreenProps {
  playlistId: string;
  playlistName: string;
  totalCount: number;
  onReplay: () => void;
}

export function PlaylistCompletionScreen({
  playlistId,
  playlistName,
  totalCount,
  onReplay,
}: PlaylistCompletionScreenProps) {
  const router = useRouter();

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-primary/40 to-zinc-950">
      <div className="text-center py-12 max-w-md">
        <div className="text-6xl mb-6 animate-bounce">🎉</div>
        <h2 className="text-3xl font-bold text-white mb-3">
          プレイリストの再生が完了しました
        </h2>
        <p className="text-zinc-400 mb-8">
          「
          <span className="text-primary/80 font-semibold">{playlistName}</span>
          」({totalCount}記事)を聴き終えました
        </p>
        <div className="flex flex-col gap-3 justify-center">
          <button
            onClick={onReplay}
            className="px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 font-semibold"
          >
            <RotateCcw className="size-5" />
            もう一度聴く
          </button>
          <button
            onClick={() => router.push(`/playlists/${playlistId}`)}
            className="px-6 py-3 bg-zinc-700 text-white rounded-lg hover:bg-zinc-600 transition-colors flex items-center justify-center gap-2 font-semibold"
          >
            <ChevronLeft className="size-5" />
            プレイリストに戻る
          </button>
        </div>
      </div>
    </div>
  );
}
