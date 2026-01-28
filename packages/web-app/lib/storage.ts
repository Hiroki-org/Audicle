// 記事データの型定義と保存機能

import { Chunk } from "@/types/api";
import { logger } from "@/lib/logger";

export interface Article {
  id: string;
  url: string;
  title: string;
  chunks?: Chunk[];
  createdAt: number;
  chunkCount?: number;
}

const LEGACY_STORAGE_KEY = "audicle_articles";
const STORAGE_KEY_INDEX = "audicle_articles_index";
const STORAGE_KEY_PREFIX_CONTENT = "audicle_article_content_";

// Migration flag to prevent concurrent migrations
let isMigrating = false;

export const articleStorage = {
  migrate: (): void => {
    if (typeof window === "undefined") return;
    
    // Prevent concurrent migrations
    if (isMigrating) return;
    isMigrating = true;

    try {
      const legacyData = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (!legacyData) {
        isMigrating = false;
        return;
      }

      try {
        const articles = JSON.parse(legacyData);
        if (Array.isArray(articles) && articles.length > 0) {
          const index: Article[] = [];
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          articles.forEach((article: any) => {
            // Validate required fields
            if (!article.id || !article.url || !article.title) {
              logger.error("Skipping article with missing required fields", article);
              return;
            }

            const { chunks, ...metadata } = article;
            
            // Validate and save content
            if (chunks) {
              try {
                // Validate chunks is an array
                if (!Array.isArray(chunks)) {
                  logger.error("Invalid chunks data for article", article.id);
                  return;
                }
                localStorage.setItem(
                  `${STORAGE_KEY_PREFIX_CONTENT}${article.id}`,
                  JSON.stringify(chunks)
                );
              } catch (e) {
                logger.error("Failed to stringify/save chunks for article", article.id, e);
                return;
              }
            }
            
            // インデックスに追加
            index.push({
              ...metadata,
              chunkCount: Array.isArray(chunks) ? chunks.length : 0,
            });
          });

          // Save index and verify before removing legacy data
          try {
            localStorage.setItem(STORAGE_KEY_INDEX, JSON.stringify(index));
            
            // Verify index was saved successfully
            const migratedIndex = localStorage.getItem(STORAGE_KEY_INDEX);
            if (migratedIndex) {
              localStorage.removeItem(LEGACY_STORAGE_KEY);
              logger.success("Migration successful: Split storage enabled");
            } else {
              logger.error("Migration failed: Index not saved; legacy data preserved");
            }
          } catch (e) {
            logger.error("Failed to save index during migration; legacy data preserved", e);
          }
        } else {
          // 空または不正なデータの場合は単に削除
          localStorage.removeItem(LEGACY_STORAGE_KEY);
        }
      } catch (e) {
        logger.error("Migration failed; legacy data preserved", e);
      }
    } finally {
      isMigrating = false;
    }
  },

  // すべての記事を取得（インデックスのみ）
  getAll: (): Article[] => {
    if (typeof window === "undefined") return [];

    // 必要に応じて移行を実行
    if (localStorage.getItem(LEGACY_STORAGE_KEY)) {
      articleStorage.migrate();
    }

    const data = localStorage.getItem(STORAGE_KEY_INDEX);
    if (!data) {
      return [];
    }

    try {
      const parsed = JSON.parse(data);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      logger.error("Failed to parse article index from localStorage", e);
      return [];
    }
  },

  // 記事を追加
  add: (article: Omit<Article, "id" | "createdAt"> & { chunks: Chunk[] }): Article => {
    const { chunks, ...rest } = article;
    const newArticle: Article = {
      ...rest,
      id: crypto.randomUUID(),
      createdAt: Date.now(),
      chunkCount: chunks.length,
    };

    try {
      // コンテンツを保存
      localStorage.setItem(
        `${STORAGE_KEY_PREFIX_CONTENT}${newArticle.id}`,
        JSON.stringify(chunks)
      );

      // インデックスに追加（chunksを含めない）
      const articles = articleStorage.getAll();
      articles.unshift(newArticle); // 先頭に追加
      localStorage.setItem(STORAGE_KEY_INDEX, JSON.stringify(articles));
    } catch (e) {
      logger.error("Failed to save article to localStorage", e);
      // Cleanup on failure
      try {
        localStorage.removeItem(`${STORAGE_KEY_PREFIX_CONTENT}${newArticle.id}`);
      } catch (cleanupError) {
        logger.error("Failed to cleanup after storage error", cleanupError);
      }
      throw new Error("Failed to save article: Storage quota may be exceeded");
    }

    // 返り値にはchunksを含める
    return { ...newArticle, chunks };
  },

  // 記事を削除
  remove: (id: string): void => {
    try {
      const articles = articleStorage.getAll().filter((a) => a.id !== id);
      localStorage.setItem(STORAGE_KEY_INDEX, JSON.stringify(articles));
      localStorage.removeItem(`${STORAGE_KEY_PREFIX_CONTENT}${id}`);
    } catch (e) {
      logger.error("Failed to remove article from localStorage", e);
      throw new Error("Failed to remove article");
    }
  },

  // IDで記事を取得
  getById: (id: string): Article | undefined => {
    const meta = articleStorage.getAll().find((a) => a.id === id);
    if (!meta) return undefined;

    const chunksJson = localStorage.getItem(`${STORAGE_KEY_PREFIX_CONTENT}${id}`);
    let chunks: Chunk[] = [];
    
    if (chunksJson) {
      try {
        const parsed = JSON.parse(chunksJson);
        if (Array.isArray(parsed)) {
          chunks = parsed;
        } else {
          logger.error("Invalid chunks data for article", id);
        }
      } catch (e) {
        logger.error("Failed to parse chunks for article", id, e);
      }
    }

    return { ...meta, chunks };
  },

  // すべてクリア
  clear: (): void => {
    if (typeof window === "undefined") return;

    // すべての article content キーをインデックスに依存せず削除する
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key && key.startsWith(STORAGE_KEY_PREFIX_CONTENT)) {
        localStorage.removeItem(key);
      }
    }
    
    localStorage.removeItem(STORAGE_KEY_INDEX);
    localStorage.removeItem(LEGACY_STORAGE_KEY);
  },
};
