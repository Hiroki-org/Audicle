"use client";

import React, { memo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Minus } from "lucide-react";
import { extractDomain } from "@/lib/utils";
import { createReaderUrl } from "@/lib/urlBuilder";
import type { PlaylistItemWithArticle } from "@/types/playlist";

interface ArticleCardProps {
  item: PlaylistItemWithArticle;
  onArticleClick: (item: PlaylistItemWithArticle) => void;
  onPlaylistAdd: (itemId: string) => void;
  onRemove: (itemId: string) => void;
  href?: string;
}

export const ArticleCard = memo(function ArticleCard({
  item,
  onArticleClick,
  onPlaylistAdd,
  onRemove,
  href,
}: ArticleCardProps) {
  const readerHref =
    href ??
    (item.article?.url
      ? createReaderUrl({ articleUrl: item.article.url })
      : "#");

  return (
    <Card className="relative group bg-zinc-900/50 border-zinc-800 hover:bg-zinc-800/50 transition-colors cursor-pointer">
      <CardContent className="p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h3
              className="text-lg lg:text-xl font-semibold text-white mb-2 truncate"
              title={item.article?.title}
            >
              <a
                href={readerHref}
                data-testid="playlist-article"
                className="after:content-[''] after:absolute after:inset-0 after:z-10 focus:outline-none focus:underline"
                onClick={(e) => {
                  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
                    return;
                  }
                  e.preventDefault();
                  onArticleClick(item);
                }}
              >
                {item.article?.title || "No Title"}
              </a>
            </h3>
            <p
              className="text-sm text-zinc-400 mb-3 truncate"
              title={item.article?.url}
            >
              {item.article?.url ? extractDomain(item.article.url) : ""}
            </p>
            <div className="flex items-center gap-4 text-xs text-zinc-500">
              <span>
                {new Date(item.added_at).toLocaleDateString("ja-JP", {
                  timeZone: "UTC",
                })}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 relative z-20">
            <Button
              size="sm"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                onPlaylistAdd(item.article_id);
              }}
              className="text-primary/70 hover:text-primary/80 hover:bg-primary/10"
              aria-label="プレイリストに追加"
              title="プレイリストに追加"
            >
              <Plus className="size-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                onRemove(item.id);
              }}
              className="text-orange-400 hover:text-orange-300 hover:bg-orange-950/30"
              aria-label="プレイリストから削除"
              title="プレイリストから削除"
            >
              <Minus className="size-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});
