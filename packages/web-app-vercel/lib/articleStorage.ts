import { Chunk } from "@/types/api";

export interface Article {
    id: string;
    url: string;
    title: string;
    chunks: Chunk[];
    createdAt: string;
}

const STORAGE_KEY = "audicle_articles";

const _readArticles = (): Record<string, Article> => {
    if (typeof window === "undefined") return {};
    const data = localStorage.getItem(STORAGE_KEY);
    try {
        if (!data) return {};
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) {
            // Migrate array to record
            const record: Record<string, Article> = {};
            for (const article of parsed) {
                record[article.id] = article;
            }
            return record;
        }
        return parsed as Record<string, Article>;
    } catch (e) {
        console.error("Failed to parse articles from localStorage", e);
        return {};
    }
};

const _writeArticles = (articles: Record<string, Article>): void => {
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
        const record = _readArticles();
        return Object.values(record).sort((a, b) => {
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
    },

    // 記事を追加
    add: (article: Omit<Article, "id" | "createdAt"> & { id?: string }): Article => {
        const record = _readArticles();
        const newArticle: Article = {
            ...article,
            id: article.id || crypto.randomUUID(),
            createdAt: new Date().toISOString(),
        };
        record[newArticle.id] = newArticle;
        _writeArticles(record);
        return newArticle;
    },

    // 記事を更新
    update: (id: string, updates: Partial<Omit<Article, "id" | "createdAt">>): Article | null => {
        const record = _readArticles();
        if (!record[id]) return null;
        record[id] = { ...record[id], ...updates };
        _writeArticles(record);
        return record[id];
    },

    // IDで記事を取得
    getById: (id: string): Article | undefined => {
        const record = _readArticles();
        return record[id];
    },

    // 記事をupsert（URLをキーに既存を更新、なければ追加）
    upsert: (article: Omit<Article, "id" | "createdAt"> & { id?: string }): Article => {
        const record = _readArticles();
        const existingArticle = Object.values(record).find((a) => a.url === article.url);

        if (existingArticle) {
            // 既存の記事を更新
            const updatedArticle = {
                ...existingArticle,
                ...article,
                // idが指定されている場合は更新
                ...(article.id && { id: article.id }),
            };

            if (article.id && article.id !== existingArticle.id) {
                delete record[existingArticle.id];
            }

            record[updatedArticle.id] = updatedArticle;
            _writeArticles(record);
            return updatedArticle;
        } else {
            // 新規追加
            return articleStorage.add(article);
        }
    },

    // 記事を削除
    remove: (id: string): void => {
        const record = _readArticles();
        if (record[id]) {
            delete record[id];
            _writeArticles(record);
        }
    },

    // すべてクリア
    clear: (): void => {
        if (typeof window === "undefined") return;
        localStorage.removeItem(STORAGE_KEY);
    },
};
