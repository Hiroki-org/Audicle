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

    afterAll(() => {
        process.env = originalEnv;
    });

    describe("Initialization", () => {
        it("should parse storeId from BLOB_READ_WRITE_TOKEN", () => {
            expect((provider as any).publicBaseUrl).toBe("https://12345.public.blob.vercel-storage.com");
        });

        it("should have undefined publicBaseUrl if token is missing", () => {
            delete process.env.BLOB_READ_WRITE_TOKEN;
            const newProvider = new VercelBlobProvider();
            expect((newProvider as any).publicBaseUrl).toBeUndefined();
        });

        it("should have undefined publicBaseUrl if token format is invalid", () => {
            process.env.BLOB_READ_WRITE_TOKEN = "invalid_token";
            const newProvider = new VercelBlobProvider();
            expect((newProvider as any).publicBaseUrl).toBeUndefined();
        });
    });

    describe("generatePresignedPutUrl", () => {
        it("should call put with empty Blob and return url", async () => {
            (put as jest.Mock).mockResolvedValueOnce({ url: "https://example.com/put-url" });
            const url = await provider.generatePresignedPutUrl("test-key", 3600);
            expect(put).toHaveBeenCalledWith("test-key", expect.any(Blob), {
                access: "public",
                addRandomSuffix: false,
                contentType: "audio/mpeg",
            });
            expect(url).toBe("https://example.com/put-url");
        });
    });

    describe("generatePresignedGetUrl", () => {
        it("should generate URL based on publicBaseUrl", async () => {
            const url = await provider.generatePresignedGetUrl("test-key.mp3", 3600);
            expect(url).toBe("https://12345.public.blob.vercel-storage.com/test-key.mp3");
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
        it("should call del with the key", async () => {
            await provider.deleteObject("test-key.mp3");
            expect(del).toHaveBeenCalledWith("test-key.mp3");
        });
    });

    describe("headObject", () => {
        it("should return exists true and size if head succeeds", async () => {
            (head as jest.Mock).mockResolvedValueOnce({ size: 1024 });
            const result = await provider.headObject("test-key.mp3");
            expect(head).toHaveBeenCalledWith("test-key.mp3");
            expect(result).toEqual({ exists: true, size: 1024 });
        });

        it("should return exists false if head throws", async () => {
            (head as jest.Mock).mockRejectedValueOnce(new Error("Not found"));
            const result = await provider.headObject("test-key.mp3");
            expect(head).toHaveBeenCalledWith("test-key.mp3");
            expect(result).toEqual({ exists: false });
        });
    });
});
