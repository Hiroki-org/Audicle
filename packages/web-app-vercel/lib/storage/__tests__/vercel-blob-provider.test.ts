import { put, head, del } from "@vercel/blob";
import { VercelBlobProvider } from "../vercel-blob-provider";

jest.mock("@vercel/blob", () => ({
    put: jest.fn(),
    head: jest.fn(),
    del: jest.fn(),
}));

describe("VercelBlobProvider", () => {
    let provider: VercelBlobProvider;
    const originalEnv = process.env;

    beforeEach(() => {
        jest.clearAllMocks();
        process.env = { ...originalEnv };
        process.env.BLOB_READ_WRITE_TOKEN = "vercel_blob_rw_12345_token";
        provider = new VercelBlobProvider();
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    describe("Initialization", () => {
        it("should parse storeId from BLOB_READ_WRITE_TOKEN", async () => {
            const url = await provider.generatePresignedGetUrl("test.mp3", 3600);
            expect(url).toBe("https://12345.public.blob.vercel-storage.com/test.mp3");
        });

        it("should throw if token is missing", async () => {
            delete process.env.BLOB_READ_WRITE_TOKEN;
            const newProvider = new VercelBlobProvider();
            await expect(newProvider.generatePresignedGetUrl("test.mp3", 3600)).rejects.toThrow("BLOB_READ_WRITE_TOKEN is required to construct Vercel Blob URLs");
        });

        it("should throw if token format is invalid", async () => {
            process.env.BLOB_READ_WRITE_TOKEN = "invalid_token";
            const newProvider = new VercelBlobProvider();
            await expect(newProvider.generatePresignedGetUrl("test.mp3", 3600)).rejects.toThrow("BLOB_READ_WRITE_TOKEN is required to construct Vercel Blob URLs");
        });
    });

    describe("generatePresignedPutUrl", () => {
        it("should upload an empty public blob and return its url", async () => {
            (put as jest.Mock).mockResolvedValueOnce({ url: "https://example.com/put-url" });
            const url = await provider.generatePresignedPutUrl("test-key", 3600);
            expect(put).toHaveBeenCalledWith("test-key", expect.any(Blob), {
                access: "public",
                addRandomSuffix: false,
                contentType: "audio/mpeg",
            });
            expect(url).toBe("https://example.com/put-url");
        });

        it("should throw if put rejects", async () => {
            (put as jest.Mock).mockRejectedValueOnce(new Error("Upload failed"));
            await expect(provider.generatePresignedPutUrl("test-key", 3600)).rejects.toThrow("Upload failed");
        });
    });

    describe("generatePresignedGetUrl", () => {
        it("should generate URL based on publicBaseUrl", async () => {
            const url = await provider.generatePresignedGetUrl("test-key.mp3", 3600);
            expect(url).toBe("https://12345.public.blob.vercel-storage.com/test-key.mp3");
        });

        it("should URL-encode key path segments", async () => {
            const url = await provider.generatePresignedGetUrl("path/to/my file.mp3", 3600);
            expect(url).toBe("https://12345.public.blob.vercel-storage.com/path/to/my%20file.mp3");
        });

        it("should throw error if publicBaseUrl is missing", async () => {
            delete process.env.BLOB_READ_WRITE_TOKEN;
            const newProvider = new VercelBlobProvider();
            await expect(newProvider.generatePresignedGetUrl("test-key.mp3", 3600)).rejects.toThrow("BLOB_READ_WRITE_TOKEN is required to construct Vercel Blob URLs");
        });
    });

    describe("uploadObject", () => {
        it("should upload Buffer data directly", async () => {
            (put as jest.Mock).mockResolvedValueOnce({ url: "https://example.com/uploaded.mp3" });
            const buffer = Buffer.from("test data");
            const url = await provider.uploadObject("test-key.mp3", buffer, "audio/mpeg");

            expect(put).toHaveBeenCalledWith("test-key.mp3", buffer, {
                access: "public",
                addRandomSuffix: false,
                contentType: "audio/mpeg",
            });
            expect(url).toBe("https://example.com/uploaded.mp3");
        });

        it("should convert ArrayBuffer to Buffer before upload", async () => {
            (put as jest.Mock).mockResolvedValueOnce({ url: "https://example.com/uploaded.mp3" });
            const arrayBuffer = new ArrayBuffer(8);
            const url = await provider.uploadObject("test-key.mp3", arrayBuffer, "audio/mpeg");

            expect(put).toHaveBeenCalledWith("test-key.mp3", expect.any(Buffer), {
                access: "public",
                addRandomSuffix: false,
                contentType: "audio/mpeg",
            });
            expect(url).toBe("https://example.com/uploaded.mp3");
        });
    });

    describe("deleteObject", () => {
        it("should call del with the full blob URL", async () => {
            await provider.deleteObject("test-key.mp3");
            expect(del).toHaveBeenCalledWith("https://12345.public.blob.vercel-storage.com/test-key.mp3");
        });

        it("should throw if token is missing", async () => {
            delete process.env.BLOB_READ_WRITE_TOKEN;
            const newProvider = new VercelBlobProvider();
            await expect(newProvider.deleteObject("test-key.mp3")).rejects.toThrow("BLOB_READ_WRITE_TOKEN is required to construct Vercel Blob URLs");
            expect(del).not.toHaveBeenCalled();
        });
    });

    describe("headObject", () => {
        it("should return exists true and size if head succeeds", async () => {
            (head as jest.Mock).mockResolvedValueOnce({ size: 1024 });
            const result = await provider.headObject("test-key.mp3");
            expect(head).toHaveBeenCalledWith("https://12345.public.blob.vercel-storage.com/test-key.mp3");
            expect(result).toEqual({ exists: true, size: 1024 });
        });

        it("should return exists false if head throws", async () => {
            (head as jest.Mock).mockRejectedValueOnce(new Error("Not found"));
            const result = await provider.headObject("test-key.mp3");
            expect(head).toHaveBeenCalledWith("https://12345.public.blob.vercel-storage.com/test-key.mp3");
            expect(result).toEqual({ exists: false });
        });
    });
});
