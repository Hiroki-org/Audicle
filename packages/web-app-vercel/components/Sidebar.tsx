"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Menu,
  X,
  Home,
  List,
  Settings,
  Plus,
  LogOut,
  User,
  TrendingUp,
} from "lucide-react";
import { handleSignOut } from "@/app/auth/signin/actions";
import { useSession } from "next-auth/react";

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { data: session } = useSession();

  const navItems = [
    { href: "/", label: "ホーム", icon: Home },
    { href: "/playlists", label: "プレイリスト", icon: List },
    { href: "/popular", label: "人気記事", icon: TrendingUp },
    { href: "/settings", label: "設定", icon: Settings },
  ];

  const handleLinkClick = () => {
    setSidebarOpen(false);
  };

  return (
    <>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          data-testid="mobile-sidebar-overlay"
          className="fixed inset-0 bg-black/80 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Mobile header */}
      <div className="lg:hidden flex items-center justify-between p-4 border-b border-zinc-800 bg-black">
        <Button
          size="icon"
          variant="ghost"
          onClick={() => setSidebarOpen(true)}
          aria-label="メニューを開く"
        >
          <Menu className="h-5 w-5" />
        </Button>
        <h2 className="text-lg font-bold">Audicle</h2>
        <div className="w-9" />
      </div>

      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-black border-r border-zinc-800 flex flex-col transform transition-transform duration-300 lg:sticky lg:top-0 lg:h-screen ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="p-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-primary/80 to-primary bg-clip-text text-transparent">
              Audicle
            </h1>
            <p className="text-xs text-zinc-400 mt-1">Web記事読み上げアプリ</p>
          </div>
          <Button
            size="icon"
            variant="ghost"
            className="lg:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-label="メニューを閉じる"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={handleLinkClick}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                pathname === href
                  ? "bg-zinc-800 text-white"
                  : "text-zinc-400 hover:text-white hover:bg-zinc-900"
              }`}
            >
              <Icon className="h-5 w-5" />
              <span className="font-medium">{label}</span>
            </Link>
          ))}
        </nav>

        <div className="p-4 space-y-3 border-t border-zinc-800">
          {/* User info */}
          {session?.user && (
            <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-zinc-900">
              <User className="h-4 w-4 text-zinc-400" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  {session.user.name || session.user.email}
                </p>
                {session.user.name && session.user.email && (
                  <p className="text-xs text-zinc-500 truncate">
                    {session.user.email}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* New article button */}
          <Button className="w-full" onClick={() => router.push("/reader")}>
            <Plus className="h-4 w-4 mr-2" />
            新しい記事を読む
          </Button>

          {/* Logout button */}
          <Button
            variant="ghost"
            className="w-full text-red-400 hover:text-red-300 hover:bg-red-950/30"
            onClick={() => handleSignOut()}
          >
            <LogOut className="h-4 w-4 mr-2" />
            ログアウト
          </Button>
        </div>
      </aside>
    </>
  );
}
