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
            const url = await provider.generatePresignedGetUrl("test-key.mp3", 3600);
            expect(url).toBe("https://12345.public.blob.vercel-storage.com/test-key.mp3");
        });

        it("should have undefined publicBaseUrl if token is missing", async () => {
            delete process.env.BLOB_READ_WRITE_TOKEN;
            const newProvider = new VercelBlobProvider();
            await expect(newProvider.generatePresignedGetUrl("test-key.mp3", 3600)).rejects.toThrow("BLOB_READ_WRITE_TOKEN is required to construct Vercel Blob URLs");
        });

        it("should have undefined publicBaseUrl if token format is invalid", async () => {
            process.env.BLOB_READ_WRITE_TOKEN = "invalid_token";
            const newProvider = new VercelBlobProvider();
            await expect(newProvider.generatePresignedGetUrl("test-key.mp3", 3600)).rejects.toThrow("BLOB_READ_WRITE_TOKEN is required to construct Vercel Blob URLs");
        });
    });

    describe("generatePresignedPutUrl", () => {
        it("should call put with empty Blob and return url (uploading an empty public blob to get a public URL)", async () => {
            (put as jest.Mock).mockResolvedValueOnce({ url: "https://example.com/put-url" });
            const url = await provider.generatePresignedPutUrl("test-key", 3600);
            expect(put).toHaveBeenCalledWith("test-key", expect.any(Blob), {
                access: "public",
                addRandomSuffix: false,
                contentType: "audio/mpeg",
            });
            expect(url).toBe("https://example.com/put-url");
        });

        it("should propagate errors if put rejects", async () => {
            (put as jest.Mock).mockRejectedValueOnce(new Error("Put failed"));
            await expect(provider.generatePresignedPutUrl("test-key", 3600)).rejects.toThrow("Put failed");
        });
    });

    describe("generatePresignedGetUrl", () => {
        it("should generate URL based on storeId and publicBaseUrl", async () => {
            const url = await provider.generatePresignedGetUrl("test-key.mp3", 3600);
            expect(url).toBe("https://12345.public.blob.vercel-storage.com/test-key.mp3");
        });

        it("should url-encode path segments", async () => {
            const url = await provider.generatePresignedGetUrl("folder/test key.mp3", 3600);
            expect(url).toBe("https://12345.public.blob.vercel-storage.com/folder/test%20key.mp3");
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
        it("should call del with the full url", async () => {
            await provider.deleteObject("test-key.mp3");
            expect(del).toHaveBeenCalledWith("https://12345.public.blob.vercel-storage.com/test-key.mp3");
        });

        it("should call del with url-encoded full url", async () => {
            await provider.deleteObject("folder/test key.mp3");
            expect(del).toHaveBeenCalledWith("https://12345.public.blob.vercel-storage.com/folder/test%20key.mp3");
        });
    });

    describe("headObject", () => {
        it("should return exists true and size if head succeeds with full url", async () => {
            (head as jest.Mock).mockResolvedValueOnce({ size: 1024 });
            const result = await provider.headObject("test-key.mp3");
            expect(head).toHaveBeenCalledWith("https://12345.public.blob.vercel-storage.com/test-key.mp3");
            expect(result).toEqual({ exists: true, size: 1024 });
        });

        it("should return exists false if head throws with full url", async () => {
            (head as jest.Mock).mockRejectedValueOnce(new Error("Not found"));
            const result = await provider.headObject("folder/test key.mp3");
            expect(head).toHaveBeenCalledWith("https://12345.public.blob.vercel-storage.com/folder/test%20key.mp3");
            expect(result).toEqual({ exists: false });
        });
    });
});
