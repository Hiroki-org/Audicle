"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type SessionInfo = Record<string, unknown> | null;
type EnvInfo = Record<string, unknown> | null;
type BrowserInfo = {
  userAgent: string;
  platform: string;
  language: string;
  timeZone: string;
  currentTime: string;
} | null;

export default function DebugPage() {
  const [sessionInfo, setSessionInfo] = useState<SessionInfo>(null);
  const [envInfo, setEnvInfo] = useState<EnvInfo>(null);
  const [browserInfo, setBrowserInfo] = useState<BrowserInfo>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // ブラウザ情報を取得（クライアントサイドのみ）
    if (typeof window !== "undefined") {
      setBrowserInfo({
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        currentTime: new Date().toLocaleString("ja-JP"),
      });
    }

    // セッション情報を取得
    const fetchSessionInfo = async () => {
      try {
        const response = await fetch("/api/auth/session");
        if (response.ok) {
          const session = await response.json();
          setSessionInfo(session);
        } else {
          setSessionInfo({
            error: `HTTP ${response.status}: ${response.statusText}`,
          });
        }
      } catch (error) {
        setSessionInfo({ error: (error as Error).message });
      }

      // 環境変数情報を取得
      setEnvInfo({
        debug_mode: process.env.NEXT_PUBLIC_DEBUG_MODE,
        allowed_users_preview:
          process.env.NEXT_PUBLIC_ALLOWED_USERS_PREVIEW || "Not configured",
        node_env: process.env.NODE_ENV,
        next_public_api_url: process.env.NEXT_PUBLIC_API_URL || "Not set",
      });

      setLoading(false);
    };

    fetchSessionInfo();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-8">🔍 デバッグ情報</h1>

        {/* セッション情報 */}
        <div className="mb-8 p-6 bg-white rounded-lg shadow">
          <h2 className="text-2xl font-bold mb-4 text-blue-600">
            セッション情報
          </h2>
          {loading ? (
            <p className="text-gray-600">読み込み中...</p>
          ) : (
            <pre className="bg-gray-100 p-4 rounded text-xs overflow-auto max-h-96">
              {JSON.stringify(sessionInfo, null, 2)}
            </pre>
          )}
        </div>

        {/* 環境変数情報 */}
        <div className="mb-8 p-6 bg-white rounded-lg shadow">
          <h2 className="text-2xl font-bold mb-4 text-green-600">
            環境変数情報
          </h2>
          <div className="space-y-3">
            {envInfo &&
              Object.entries(envInfo).map(([key, value]) => (
                <div key={key} className="bg-gray-100 p-3 rounded">
                  <p className="text-sm font-mono">
                    <strong>{key}:</strong> {String(value)}
                  </p>
                </div>
              ))}
          </div>
        </div>

        {/* ブラウザ情報 */}
        <div className="mb-8 p-6 bg-white rounded-lg shadow">
          <h2 className="text-2xl font-bold mb-4 text-purple-600">
            ブラウザ情報
          </h2>
          {loading || !browserInfo ? (
            <p className="text-gray-600">読み込み中...</p>
          ) : (
            <div className="space-y-3">
              <div className="bg-gray-100 p-3 rounded">
                <p className="text-sm">
                  <strong>ユーザーエージェント:</strong>
                </p>
                <p className="text-xs font-mono mt-1 break-all">
                  {browserInfo.userAgent}
                </p>
              </div>
              <div className="bg-gray-100 p-3 rounded">
                <p className="text-sm">
                  <strong>プラットフォーム:</strong> {browserInfo.platform}
                </p>
              </div>
              <div className="bg-gray-100 p-3 rounded">
                <p className="text-sm">
                  <strong>言語:</strong> {browserInfo.language}
                </p>
              </div>
              <div className="bg-gray-100 p-3 rounded">
                <p className="text-sm">
                  <strong>タイムゾーン:</strong> {browserInfo.timeZone}
                </p>
              </div>
              <div className="bg-gray-100 p-3 rounded">
                <p className="text-sm">
                  <strong>現在時刻:</strong> {browserInfo.currentTime}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* ナビゲーション */}
        <div className="flex gap-4">
          <Link
            href="/"
            className="py-2 px-4 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            ホームに戻る
          </Link>
          <Link
            href="/auth/signin"
            className="py-2 px-4 bg-gray-600 text-white rounded hover:bg-gray-700"
          >
            ログイン画面に戻る
          </Link>
        </div>
      </div>
    </div>
  );
}
