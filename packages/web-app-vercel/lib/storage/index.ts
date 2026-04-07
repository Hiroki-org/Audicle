import type { StorageProvider } from "./types";
import { R2StorageProvider } from "./r2-provider";
import { VercelBlobProvider } from "./vercel-blob-provider";

let storageProvider: StorageProvider | null = null;

/**
 * ストレージプロバイダーを取得
 * 環境変数 STORAGE_PROVIDER で切り替え
 * - "r2": Cloudflare R2
 * - それ以外: Vercel Blob（デフォルト）
 */
export function getStorageProvider(): StorageProvider {
    if (storageProvider) return storageProvider;

    const provider = process.env.STORAGE_PROVIDER || "vercel-blob";

    if (provider === "r2") {
        storageProvider = new R2StorageProvider();
    } else {
        storageProvider = new VercelBlobProvider();
    }

    return storageProvider;
}

/**
 * テスト用: プロバイダーをリセット
 */
export function resetStorageProvider() {
    storageProvider = null;
}

export type { StorageProvider } from "./types";
