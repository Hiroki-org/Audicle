"use client";

import { useState, useEffect, useRef } from "react";
import toast from "react-hot-toast";
import { useSession } from "next-auth/react";
import { useDebounce } from "use-debounce";
import {
  useUserSettings,
  useUpdateUserSettingsMutation,
} from "@/lib/hooks/useUserSettings";
import {
  VOICE_MODELS,
  Language,
  VoiceModel,
  DEFAULT_SETTINGS,
  COLOR_THEMES,
  ColorTheme,
} from "@/types/settings";
import { applyTheme } from "@/lib/theme";
import { logger } from "@/lib/logger";

export default function UserSettingsPanel() {
  const { data: session } = useSession();
  const { data: originalSettings, isLoading, error } = useUserSettings();
  const updateSettingsMutation = useUpdateUserSettingsMutation();

  const [settings, setSettings] = useState(
    originalSettings || DEFAULT_SETTINGS
  );
  const [previewTheme, setPreviewTheme] = useState<ColorTheme>(
    originalSettings?.color_theme || DEFAULT_SETTINGS.color_theme
  );
  const [hasChanged, setHasChanged] = useState(false);

  // Debounce the theme for saving (1000ms delay)
  const [debouncedTheme] = useDebounce(previewTheme, 1000);

  // Keep refs to the latest values for unmount flush
  const latestPreviewRef = useRef(previewTheme);
  const latestSettingsRef = useRef(settings);
  useEffect(() => {
    latestPreviewRef.current = previewTheme;
  }, [previewTheme]);
  useEffect(() => {
    latestSettingsRef.current = settings;
  }, [settings]);

  // originalSettingsが変わったら、ローカル変更がない場合は同期
  useEffect(() => {
    if (originalSettings && !hasChanged) {
      setSettings(originalSettings);
      setPreviewTheme(originalSettings.color_theme);
    }
  }, [originalSettings, hasChanged]);

  // Load local settings for guest users
  useEffect(() => {
    if (!session?.user?.email) {
      const storedSettings = localStorage.getItem("audicle-user-settings");
      if (storedSettings) {
        try {
          const parsed = JSON.parse(storedSettings);
          setSettings({ ...DEFAULT_SETTINGS, ...parsed });
        } catch (e) {
          logger.error("Failed to parse local settings:", e);
        }
      }
    }
  }, [session]);

  const handlePlaybackSpeedChange = (value: number) => {
    setSettings((prev) => ({ ...prev, playback_speed: value }));
    setHasChanged(true);
  };

  const handleVoiceModelChange = (value: string) => {
    setSettings((prev) => ({
      ...prev,
      voice_model: value as VoiceModel,
    }));
    setHasChanged(true);
  };

  const handleLanguageChange = (value: string) => {
    setSettings((prev) => ({
      ...prev,
      language: value as Language,
    }));
    setHasChanged(true);
  };

  const handleColorThemeChange = (value: string) => {
    const theme = value as ColorTheme;
    // Update preview immediately
    setPreviewTheme(theme);
    applyTheme(theme); // Apply immediately to CSS
    setHasChanged(true);
  };

  // Auto-save theme to DB when debounced theme changes
  useEffect(() => {
    if (!hasChanged) return;

    const saveTheme = async () => {
      try {
        if (session?.user?.email) {
          // Logged in user: save to DB
          const newSettings = { ...settings, color_theme: debouncedTheme };
          await updateSettingsMutation.mutateAsync(newSettings);
          setSettings(newSettings);
        } else {
          // Guest user: save to localStorage
          const newSettings = { ...settings, color_theme: debouncedTheme };
          localStorage.setItem(
            "audicle-user-settings",
            JSON.stringify(newSettings)
          );
          localStorage.setItem("audicle-color-theme", debouncedTheme);
          setSettings(newSettings);
        }
        // Don't show toast for auto-save to avoid notification spam
      } catch (error) {
        logger.error("Error saving theme:", error);
        toast.error(
          error instanceof Error ? error.message : "テーマの保存に失敗しました"
        );
      }
    };

    saveTheme();
  }, [debouncedTheme, session, hasChanged]);

  // On unmount: flush any unsaved theme changes immediately
  useEffect(() => {
    return () => {
      if (!hasChanged) return;
      const finalPreview = latestPreviewRef.current;
      const finalSettings = latestSettingsRef.current;
      if (finalPreview !== finalSettings.color_theme) {
        // Fire and forget; it's fine to call async from cleanup
        (async () => {
          try {
            if (session?.user?.email) {
              await updateSettingsMutation.mutateAsync({
                ...finalSettings,
                color_theme: finalPreview,
              });
            } else {
              localStorage.setItem(
                "audicle-user-settings",
                JSON.stringify({ ...finalSettings, color_theme: finalPreview })
              );
              localStorage.setItem("audicle-color-theme", finalPreview);
            }
          } catch (e) {
            console.error("Failed to flush theme on unmount:", e);
          }
        })();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSave = async () => {
    try {
      if (session?.user?.email) {
        // Logged in user: save to DB
        await updateSettingsMutation.mutateAsync(settings);
      } else {
        // Guest user: save to localStorage
        localStorage.setItem("audicle-user-settings", JSON.stringify(settings));
        localStorage.setItem("audicle-color-theme", settings.color_theme);
      }
      setHasChanged(false);
      toast.success("設定を保存しました");
    } catch (error) {
      console.error("Error saving settings:", error);
      toast.error(
        error instanceof Error ? error.message : "設定の保存に失敗しました"
      );
    }
  };

  const handleCancel = () => {
    if (originalSettings) {
      setSettings(originalSettings);
      setPreviewTheme(originalSettings.color_theme);
      setHasChanged(false);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-zinc-800 rounded w-1/4"></div>
          <div className="h-4 bg-zinc-800 rounded"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
        <p className="text-red-400">
          {error instanceof Error
            ? error.message
            : "設定の読み込みに失敗しました"}
        </p>
      </div>
    );
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
      <h2 className="text-xl font-bold mb-6">再生設定</h2>

      <div className="space-y-6">
        {/* Color Theme Section */}
        <div>
          <label className="block text-sm font-medium mb-2">カラーテーマ</label>
          <div className="flex gap-3 flex-wrap">
            {COLOR_THEMES.map((theme) => (
              <button
                key={theme.value}
                onClick={() => handleColorThemeChange(theme.value)}
                className={`w-12 h-12 rounded-full border-2 transition-all ${
                  previewTheme === theme.value
                    ? "border-white scale-110"
                    : "border-zinc-600 hover:border-zinc-400"
                }`}
                style={{ backgroundColor: theme.color }}
                title={theme.label}
              />
            ))}
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            クリックしてテーマを切り替え（リアルタイムプレビュー、1秒後に自動保存）
          </p>
        </div>

        {/* Playback Speed Slider */}
        <div>
          <label className="block text-sm font-medium mb-2">再生速度</label>
          <div className="flex items-center gap-4">
            <input
              type="range"
              min="0.5"
              max="3.0"
              step="0.1"
              value={settings.playback_speed}
              onChange={(e) =>
                handlePlaybackSpeedChange(parseFloat(e.target.value))
              }
              className="flex-1 h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-primary"
            />
            <span className="w-12 text-right font-semibold">
              {settings.playback_speed.toFixed(1)}x
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            0.5x～3.0x（デフォルト: 1.0x）
          </p>
        </div>

        {/* Language Dropdown */}
        <div>
          <label className="block text-sm font-medium mb-2">言語</label>
          <select
            value={settings.language}
            onChange={(e) => handleLanguageChange(e.target.value)}
            className="w-full px-3 py-2 border border-zinc-700 rounded-lg bg-zinc-800 focus:ring-2 focus:ring-primary focus:border-transparent"
          >
            <option value="ja-JP">日本語</option>
            <option value="en-US">English</option>
          </select>
        </div>

        {/* Voice Model Dropdown */}
        <div>
          <label className="block text-sm font-medium mb-2">音声モデル</label>
          <select
            value={settings.voice_model}
            onChange={(e) => handleVoiceModelChange(e.target.value)}
            className="w-full px-3 py-2 border border-zinc-700 rounded-lg bg-zinc-800 focus:ring-2 focus:ring-primary focus:border-transparent"
          >
            {VOICE_MODELS.map((model) => (
              <option key={model.value} value={model.value}>
                {model.label}
              </option>
            ))}
          </select>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4">
          <button
            onClick={handleSave}
            disabled={!hasChanged || updateSettingsMutation.isPending}
            className="px-4 py-2 bg-primary hover:bg-primary/90 disabled:bg-zinc-700 disabled:text-zinc-500 text-white rounded-lg transition-colors font-medium"
          >
            {updateSettingsMutation.isPending ? "保存中..." : "保存"}
          </button>
          {hasChanged && (
            <button
              onClick={handleCancel}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors font-medium"
            >
              キャンセル
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
