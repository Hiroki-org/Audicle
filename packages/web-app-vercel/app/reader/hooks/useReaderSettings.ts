import { useState, useEffect } from "react";
import { UserSettings, DEFAULT_SETTINGS } from "@/types/settings";
import { Playlist } from "@/types/playlist";

import { logger } from "@/lib/logger";

export function useReaderSettings() {
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [effectiveVoiceModel, setEffectiveVoiceModel] = useState<string>(
    DEFAULT_SETTINGS.voice_model,
  );
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string>("");
  const [arePlaylistsLoaded, setArePlaylistsLoaded] = useState(false);

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
    const fetchPlaylists = async () => {
      try {
        const response = await fetch("/api/playlists");
        if (response.ok) {
          const data: Playlist[] = await response.json();
          setPlaylists(data);

          if (data.length > 0) {
            setSelectedPlaylistId(data[0].id);
          }
        }
      } catch (error) {
        logger.error("プレイリストの読み込みに失敗", error);
      } finally {
        setArePlaylistsLoaded(true);
      }
    };

    fetchPlaylists();
  }, []);

  return {
    settings,
    setSettings,
    effectiveVoiceModel,
    setEffectiveVoiceModel,
    playlists,
    setPlaylists,
    selectedPlaylistId,
    setSelectedPlaylistId,
    arePlaylistsLoaded,
  };
}
