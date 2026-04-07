"use client";

import { PlaylistWithItems } from "@/types/playlist";

interface PlaylistItemRowProps {
  playlist: PlaylistWithItems;
  isSelected: boolean;
  isSaving: boolean;
  onToggle: (_playlistId: string) => void;
}

export function PlaylistItemRow({
  playlist,
  isSelected,
  isSaving,
  onToggle,
}: PlaylistItemRowProps) {
  const checkboxId = `playlist-checkbox-${playlist.id}`;
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
      <input
        id={checkboxId}
        type="checkbox"
        checked={isSelected}
        onChange={() => onToggle(playlist.id)}
        className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 cursor-pointer"
        disabled={isSaving}
      />
      <label htmlFor={checkboxId} className="flex-1 min-w-0 cursor-pointer">
        <span className="block font-medium text-gray-900 dark:text-gray-100 truncate">
          {playlist.name}
        </span>
        {playlist.description && (
          <span className="block text-xs text-gray-600 dark:text-gray-400 truncate">
            {playlist.description}
          </span>
        )}
        {playlist.is_default && (
          <span className="block text-xs text-blue-600 dark:text-blue-400 font-medium">
            デフォルト
          </span>
        )}
      </label>
    </div>
  );
}
