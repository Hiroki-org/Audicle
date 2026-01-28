// 記事データの型定義と保存機能

import { Chunk } from "@/types/api";

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
        if (Array.isArray(articles) && articles.length > 0) {
          const index: Article[] = [];
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          articles.forEach((article: any) => {
            const { chunks, ...metadata } = article;
            // コンテンツを保存
            if (chunks) {
              localStorage.setItem(
                `${STORAGE_KEY_PREFIX_CONTENT}${article.id}`,
                JSON.stringify(chunks)
              );
            }
            // インデックスに追加
            index.push({
              ...metadata,
              chunkCount: chunks ? chunks.length : 0,
            });
          });

          // インデックスを保存
          localStorage.setItem(STORAGE_KEY_INDEX, JSON.stringify(index));
          // レガシーデータを削除
          localStorage.removeItem(LEGACY_STORAGE_KEY);
        } else {
          // 空または不正なデータの場合は単に削除
          localStorage.removeItem(LEGACY_STORAGE_KEY);
        }
      } catch (e) {
        console.error("Migration failed", e);
      }
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
    return data ? JSON.parse(data) : [];
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
  },

  // 記事を削除
  remove: (id: string): void => {
    const articles = articleStorage.getAll().filter((a) => a.id !== id);
    localStorage.setItem(STORAGE_KEY_INDEX, JSON.stringify(articles));
    localStorage.removeItem(`${STORAGE_KEY_PREFIX_CONTENT}${id}`);
  },

  // IDで記事を取得
  getById: (id: string): Article | undefined => {
    const meta = articleStorage.getAll().find((a) => a.id === id);
    if (!meta) return undefined;

    const chunksJson = localStorage.getItem(`${STORAGE_KEY_PREFIX_CONTENT}${id}`);
    const chunks = chunksJson ? JSON.parse(chunksJson) : [];

    return { ...meta, chunks };
  },

  // すべてクリア
  clear: (): void => {
    // インデックスを取得して、個別の記事データも削除する
    const articles = articleStorage.getAll();
    articles.forEach(article => {
      localStorage.removeItem(`${STORAGE_KEY_PREFIX_CONTENT}${article.id}`);
    });
    localStorage.removeItem(STORAGE_KEY_INDEX);
    localStorage.removeItem(LEGACY_STORAGE_KEY);
  },
};
