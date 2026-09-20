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

export const articleStorage = {
  migrate: (): void => {
    if (typeof window === "undefined") return;

    const legacyData = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacyData) {
      try {
        const articles = JSON.parse(legacyData);

        if (!Array.isArray(articles)) {
             // 不正なデータ形式の場合は削除して終了
             localStorage.removeItem(LEGACY_STORAGE_KEY);
             return;
        }

        if (articles.length === 0) {
            localStorage.removeItem(LEGACY_STORAGE_KEY);
            return;
        }

        const index: Article[] = [];
        let successCount = 0;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        articles.forEach((article: any) => {
            // 必須フィールドの存在チェック
            if (!article || typeof article !== 'object' || !article.id) {
                logger.warn("Migration: Skipping invalid article", article);
                return;
            }

            const { chunks, ...metadata } = article;
            const chunkCount = Array.isArray(chunks) ? chunks.length : 0;

            try {
                // コンテンツを保存
                if (Array.isArray(chunks) && chunks.length > 0) {
                    localStorage.setItem(
                        `${STORAGE_KEY_PREFIX_CONTENT}${article.id}`,
                        JSON.stringify(chunks)
                    );
                }
                // インデックスに追加
                index.push({
                    ...metadata,
                    chunkCount,
                });
                successCount++;
            } catch (err) {
                logger.error(`Migration: Failed to save article ${article.id}`, err);
            }
        });

        // インデックスを保存
        localStorage.setItem(STORAGE_KEY_INDEX, JSON.stringify(index));

        // レガシーデータを削除
        localStorage.removeItem(LEGACY_STORAGE_KEY);
        logger.success(`Migration successful: ${successCount} articles migrated`);

      } catch (e) {
        logger.error("Migration failed", e);
      }
    }
  },

  // すべての記事を取得（インデックスのみ）
  getAll: (): Article[] => {
    if (typeof window === "undefined") return [];

    const data = localStorage.getItem(STORAGE_KEY_INDEX);
    if (!data) return [];

    try {
        return JSON.parse(data);
    } catch (e) {
        logger.error("Failed to parse article index", e);
        return [];
    }
  },

  // 記事を追加
  add: (article: Omit<Article, "id" | "createdAt"> & { chunks: Chunk[] }): Article => {
    // createdAtが渡されても無視するように除外
    const { chunks, ...temp } = article;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { createdAt, ...rest } = temp as typeof temp & { createdAt?: unknown };

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

        // 返り値にはchunksを含める
        return { ...newArticle, chunks };
    } catch (e) {
        logger.error("Failed to add article", e);
        throw e; // 呼び出し元でエラーハンドリングさせる
    }
  },

  // 記事を削除
  remove: (id: string): void => {
    try {
        const articles = articleStorage.getAll().filter((a) => a.id !== id);
        localStorage.setItem(STORAGE_KEY_INDEX, JSON.stringify(articles));
        localStorage.removeItem(`${STORAGE_KEY_PREFIX_CONTENT}${id}`);
    } catch (e) {
        logger.error("Failed to remove article", e);
    }
  },

  // IDで記事を取得
  getById: (id: string): Article | undefined => {
    const meta = articleStorage.getAll().find((a) => a.id === id);
    if (!meta) return undefined;

    try {
        const chunksJson = localStorage.getItem(`${STORAGE_KEY_PREFIX_CONTENT}${id}`);
        const chunks = chunksJson ? JSON.parse(chunksJson) : [];
        return { ...meta, chunks };
    } catch (e) {
        logger.error(`Failed to load chunks for article ${id}`, e);
        return { ...meta, chunks: [] };
    }
  },

  // すべてクリア
  clear: (): void => {
    try {
        // インデックスに依存せず、プレフィックスに一致するキーを全て削除
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(STORAGE_KEY_PREFIX_CONTENT)) {
                keysToRemove.push(key);
            }
        }
        keysToRemove.forEach(key => localStorage.removeItem(key));

        localStorage.removeItem(STORAGE_KEY_INDEX);
        localStorage.removeItem(LEGACY_STORAGE_KEY);
    } catch (e) {
        logger.error("Failed to clear storage", e);
    }
  },
};

// 初期化時に移行を実行
if (typeof window !== "undefined") {
    try {
        articleStorage.migrate();
    } catch (e) {
        console.error("Migration init failed", e);
    }
}
