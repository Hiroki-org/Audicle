import { put, head, del } from "@vercel/blob";
import type { StorageProvider } from "./types";

export class VercelBlobProvider implements StorageProvider {
    private publicBaseUrl?: string;

    constructor() {
        this.publicBaseUrl = this.resolvePublicBaseUrl();
    }

    private resolvePublicBaseUrl(): string | undefined {
        const token = process.env.BLOB_READ_WRITE_TOKEN;
        if (!token) return undefined;
        const parts = token.split("_");
        if (parts.length > 3 && parts[0] === "vercel" && parts[1] === "blob") {
            const storeId = parts[3];
            return `https://${storeId}.public.blob.vercel-storage.com`;
        }
        return undefined;
    }

    private requirePublicBaseUrl(): string {
        if (!this.publicBaseUrl) {
            throw new Error("BLOB_READ_WRITE_TOKEN is required to construct Vercel Blob URLs");
        }
        return this.publicBaseUrl;
    }

    private getFullUrl(key: string): string {
        const baseUrl = this.requirePublicBaseUrl();
        // key may contain multiple segments (e.g. "folder/file name.mp3").
        // Encode each segment individually.
        const encodedKey = key.split('/').map(encodeURIComponent).join('/');
        return `${baseUrl}/${encodedKey}`;
    }

    async generatePresignedPutUrl(key: string, _expiresIn: number): Promise<string> {
        const blob = await put(key, new Blob([]), {
            access: "public",
            addRandomSuffix: false,
            contentType: "audio/mpeg",
        });
        return blob.url;
    }

    async generatePresignedGetUrl(key: string, _expiresIn: number): Promise<string> {
        return this.getFullUrl(key);
    }

    async uploadObject(key: string, data: ArrayBuffer | Buffer, contentType: string, _expiresIn?: number): Promise<string> {
        // Vercel BlobのputメソッドはBuffer、Blob、またはstring を受け付ける
        // ArrayBufferの場合はBufferに変換、既にBufferの場合そのまま使用
        const fileData = data instanceof ArrayBuffer ? Buffer.from(data) : data;
        const blob = await put(key, fileData, {
            access: "public",
            addRandomSuffix: false,
            contentType,
        });
        return blob.url;
    }

    async deleteObject(key: string): Promise<void> {
        const fullUrl = this.getFullUrl(key);
        await del(fullUrl);
    }

    async headObject(key: string): Promise<{ exists: boolean; size?: number }> {
        try {
            const fullUrl = this.getFullUrl(key);
            const response = await head(fullUrl);
            return { exists: true, size: response.size };
        } catch {
            return { exists: false };
        }
    }
}
