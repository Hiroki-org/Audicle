import { STORAGE_KEYS } from "./constants";
import { PlaylistItemWithArticle } from "@/types/playlist";

export interface CachedPlaylistData {
    playlistId: string;
    playlistName: string;
    items: PlaylistItemWithArticle[];
}

interface CacheEnvelope {
    version: number;
    timestamp: number;
    payload: CachedPlaylistData;
}

const CACHE_VERSION = 1;
// Default TTL: 24 hours
const CACHE_TTL_MS = 1000 * 60 * 60 * 24;

export function getArticlesCache(userId: string): CachedPlaylistData | null {
    if (typeof window === "undefined" || !userId) return null;
    try {
        const key = `${STORAGE_KEYS.ARTICLES_CACHE}-${userId}`;
        const cached = localStorage.getItem(key);
        if (!cached) return null;

        const parsed = JSON.parse(cached);

        if (!isValidEnvelope(parsed)) {
            console.warn("Invalid cache structure detected");
            return null;
        }

        if (parsed.version !== CACHE_VERSION) {
            console.warn("Cache version mismatch; clearing cache");
            try { localStorage.removeItem(key); } catch { }
            return null;
        }

        if (Date.now() - parsed.timestamp > CACHE_TTL_MS) {
            console.info("Articles cache expired; removing");
            try { localStorage.removeItem(key); } catch { }
            return null;
        }

        if (isValidCachedData(parsed.payload)) {
            return parsed.payload;
        }

        console.warn("Invalid cached payload structure");
        return null;
    } catch (error) {
        console.error("Failed to read articles cache:", error);
        return null;
    }
}

function isValidEnvelope(obj: any): obj is CacheEnvelope {
    return (
        typeof obj === "object" &&
        obj !== null &&
        typeof obj.version === "number" &&
        typeof obj.timestamp === "number" &&
        typeof obj.payload === "object" &&
        obj.payload !== null
    );
}

function isValidCachedData(data: any): data is CachedPlaylistData {
    return (
        typeof data === "object" &&
        data !== null &&
        typeof data.playlistId === "string" &&
        typeof data.playlistName === "string" &&
        Array.isArray(data.items)
    );
}

export function setArticlesCache(userId: string, data: CachedPlaylistData): void {
    if (typeof window === "undefined" || !userId) return;
    try {
        const key = `${STORAGE_KEYS.ARTICLES_CACHE}-${userId}`;
        const envelope: CacheEnvelope = { version: CACHE_VERSION, timestamp: Date.now(), payload: data };
        localStorage.setItem(key, JSON.stringify(envelope));
    } catch (error) {
        // QuotaExceededError and others may occur; log to help debugging
        if ((error as any)?.name === "QuotaExceededError") {
            console.warn("Failed to save articles to cache (quota exceeded):", error);
        } else {
            console.warn("Failed to save articles to cache:", error);
        }
    }
}
