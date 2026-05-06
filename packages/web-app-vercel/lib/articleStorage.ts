// 記事データの型定義と保存機能

import { Chunk } from "@/types/api";

export interface Article {
    id: string;
    url: string;
    title: string;
    chunks: Chunk[];
    createdAt: string;
}

const STORAGE_KEY = "audicle_articles";

const _clearCorruptStorage = (): void => {
    if (typeof window === "undefined") return;
    try {
        localStorage.removeItem(STORAGE_KEY);
    } catch {
        // Ignore cleanup failures; callers can continue with an empty list.
    }
};

const _isStoredChunk = (value: unknown): value is Chunk => {
    if (typeof value !== "object" || value === null) return false;
    const chunk = value as Partial<Chunk>;
    return (
        typeof chunk.id === "string" &&
        typeof chunk.text === "string" &&
        typeof chunk.cleanedText === "string" &&
        typeof chunk.type === "string"
    );
};

const _isStoredArticle = (value: unknown): value is Article => {
    if (typeof value !== "object" || value === null) return false;
    const article = value as Partial<Article>;
    return (
        typeof article.id === "string" &&
        typeof article.url === "string" &&
        typeof article.title === "string" &&
        typeof article.createdAt === "string" &&
        Array.isArray(article.chunks) &&
        article.chunks.every(_isStoredChunk)
    );
};

const _readArticles = (): Article[] => {
    if (typeof window === "undefined") return [];
    try {
        const data = localStorage.getItem(STORAGE_KEY);
        if (!data) return [];
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) {
            const validArticles = parsed.filter(_isStoredArticle);
            if (validArticles.length !== parsed.length) {
                console.warn("Some articles in localStorage were invalid; filtering invalid entries");
                _writeArticles(validArticles);
            }
            return validArticles;
        }
        console.warn("Invalid articles structure in localStorage; clearing stored articles");
        _clearCorruptStorage();
        return [];
    } catch (e) {
        console.error("Failed to parse articles from localStorage", e);
        _clearCorruptStorage();
        return [];
    }
};

const _writeArticles = (articles: Article[]): void => {
    if (typeof window === "undefined") return;
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(articles));
    } catch (e) {
        console.error("Failed to write articles to localStorage", e);
    }
};

export const articleStorage = {
    // すべての記事を取得
    getAll: (): Article[] => {
        return _readArticles();
    },

    // 記事を追加
    add: (article: Omit<Article, "id" | "createdAt"> & { id?: string }): Article => {
        const articles = _readArticles();
        const newArticle: Article = {
            ...article,
            id: article.id || crypto.randomUUID(),
            createdAt: new Date().toISOString(),
        };
        articles.unshift(newArticle);
        _writeArticles(articles);
        return newArticle;
    },

    // 記事を更新
    update: (id: string, updates: Partial<Omit<Article, "id" | "createdAt">>): Article | null => {
        const articles = _readArticles();
        const index = articles.findIndex((a) => a.id === id);
        if (index === -1) return null;
        articles[index] = { ...articles[index], ...updates };
        _writeArticles(articles);
        return articles[index];
    },

    // IDで記事を取得
    getById: (id: string): Article | undefined => {
        return _readArticles().find((a) => a.id === id);
    },

    // 記事をupsert（URLをキーに既存を更新、なければ追加）
    upsert: (article: Omit<Article, "id" | "createdAt"> & { id?: string }): Article => {
        const articles = _readArticles();
        const existingIndex = articles.findIndex((a) => a.url === article.url);

        if (existingIndex >= 0) {
            // 既存の記事を更新
            articles[existingIndex] = {
                ...articles[existingIndex],
                ...article,
                // idが指定されている場合は更新
                ...(article.id && { id: article.id }),
            };
            _writeArticles(articles);
            return articles[existingIndex];
        } else {
            // 新規追加
            return articleStorage.add(article);
        }
    },

    // 記事を削除
    remove: (id: string): void => {
        const articles = _readArticles().filter((a) => a.id !== id);
        _writeArticles(articles);
    },

    // すべてクリア
    clear: (): void => {
        if (typeof window === "undefined") return;
        localStorage.removeItem(STORAGE_KEY);
    },
};
