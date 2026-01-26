// packages/web-app-vercel/app/client-layout.tsx
"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode, useMemo, useEffect } from "react";
import { Toaster } from "react-hot-toast";
import { PlaylistPlaybackProvider } from "@/contexts/PlaylistPlaybackContext";
import { AudioPlaybackProvider } from "@/contexts/AudioPlaybackContext";
import { useSession } from "next-auth/react";
import { useUserSettings } from "@/lib/hooks/useUserSettings";
import SessionProviderWrapper from "./session-provider-wrapper";
import { applyTheme, getCurrentTheme } from "@/lib/theme";
import { DEFAULT_SETTINGS, ColorTheme } from "@/types/settings";

export default function ClientLayout({ children }: { children: ReactNode }) {
  const queryClient = useMemo(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000, // 5分間は新鮮（クロスタブ同期のため）
            gcTime: 5 * 60 * 1000, // 5分間（デフォルト）でガベージコレクション
            refetchOnWindowFocus: true, // ウィンドウフォーカス時に再フェッチ
            refetchOnMount: true, // マウント時に再フェッチ
            refetchOnReconnect: true, // ネット再接続時に再フェッチ
          },
        },
      }),
    []
  );

  // The `Content` component is defined at module scope to avoid re-creating
  // it every time `ClientLayout` rerenders. That helps avoid remounts and
  // preserves component state and subscriptions.

  return (
    <QueryClientProvider client={queryClient}>
      <SessionProviderWrapper>
        <Content>{children}</Content>
      </SessionProviderWrapper>
    </QueryClientProvider>
  );
}

function Content({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession();
  const { data: userSettings } = useUserSettings();

  // Initialize theme on mount
  useEffect(() => {
    if (status === "loading") {
      return; // セッション状態が確定するまで待機
    }

    if (status === "authenticated" && userSettings) {
      // Logged in user: if DB theme differs from current DOM theme, apply DB setting
      const current = getCurrentTheme();
      if (current !== userSettings.color_theme) {
        applyTheme(userSettings.color_theme);
      }
    } else {
      // For guest users, the theme is pre-applied by the blocking inline script
      // No-op here to avoid FOUC by reapplying theme after hydration
    }
  }, [status, userSettings]);

  return (
    <PlaylistPlaybackProvider>
      <AudioPlaybackProvider>
        <Toaster position="top-right" />
        {children}
      </AudioPlaybackProvider>
    </PlaylistPlaybackProvider>
  );
}
