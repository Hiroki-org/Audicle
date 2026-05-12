// packages/web-app-vercel/app/layout.tsx

import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import ClientLayout from "./client-layout";
import { DEFAULT_SETTINGS, COLOR_THEMES } from "@/types/settings";
import { STORAGE_KEYS } from "@/lib/constants";
import "./globals.css";
import { Analytics } from "@vercel/analytics/next";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <head>
        <script
          data-storage-key={STORAGE_KEYS.COLOR_THEME}
          data-default-theme={DEFAULT_SETTINGS.color_theme}
          data-valid-themes={COLOR_THEMES.map((t) => t.value).join(",")}
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  const script = document.currentScript;
                  const storageKey = script.getAttribute('data-storage-key');
                  const defaultTheme = script.getAttribute('data-default-theme');
                  const validThemes = script.getAttribute('data-valid-themes').split(',');

                  let theme = localStorage.getItem(storageKey) || defaultTheme;

                  if (!validThemes.includes(theme)) {
                    theme = defaultTheme;
                  }

                  document.documentElement.setAttribute('data-theme', theme);
                  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
                    document.documentElement.classList.add('dark');
                  }
                } catch (e) { console.warn('Failed to initialize theme from localStorage:', e); }
              })();
            `,
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning
      >
        <Analytics />
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}

// NOTE: `metadata` and `viewport` are essential for SEO, PWA features,
// and theme color support across platforms. They were removed in a previous
// change and should be persisted at module scope so Next.js can pick them up.
export const metadata: Metadata = {
  title: "Audicle - Web Reader with TTS",
  description:
    "音楽アプリの歌詞表示のような体験で、Webページの本文を読み上げます",
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.png",
    apple: "/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Audicle",
  },
};

// `viewport.themeColor` is used by Next to set color for mobile browser
// UI elements; keep it at module scope so it is included in the app HTML.
export const viewport = {
  themeColor: "#0ea5e9",
};
