import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { R2StorageProvider } from "../r2-provider";

const mockSend = jest.fn();

jest.mock("@aws-sdk/client-s3", () => {
    return {
        S3Client: jest.fn().mockImplementation(() => ({
            send: mockSend,
        })),
        PutObjectCommand: jest.fn(),
        GetObjectCommand: jest.fn(),
        DeleteObjectCommand: jest.fn(),
        HeadObjectCommand: jest.fn(),
    };
});

jest.mock("@aws-sdk/s3-request-presigner", () => ({
    getSignedUrl: jest.fn(),
}));

describe("R2StorageProvider", () => {
    const originalEnv = { ...process.env };
    const restoreEnv = () => {
        for (const key of Object.keys(process.env)) {
            delete process.env[key];
        }
        Object.assign(process.env, originalEnv);
    };

    beforeEach(() => {
        jest.clearAllMocks();
        mockSend.mockReset();
        mockSend.mockResolvedValue(undefined);
        restoreEnv();
        process.env.R2_ACCOUNT_ID = "test-account";
        process.env.R2_ACCESS_KEY_ID = "test-access-key";
        process.env.R2_SECRET_ACCESS_KEY = "test-secret";
        process.env.R2_BUCKET_NAME = "test-bucket";
    });

    afterEach(() => {
        restoreEnv();
    });

    describe("Constructor", () => {
        it("should initialize S3Client with correct config", () => {
            new R2StorageProvider();
            expect(S3Client).toHaveBeenCalledWith({
                region: "auto",
                endpoint: "https://test-account.r2.cloudflarestorage.com",
                credentials: {
                    accessKeyId: "test-access-key",
                    secretAccessKey: "test-secret",
                },
            });
        });

        it("should throw error if R2_ACCOUNT_ID is missing", () => {
            delete process.env.R2_ACCOUNT_ID;
            expect(() => new R2StorageProvider()).toThrow("Missing required R2 environment variables");
        });

        it("should throw error if R2_ACCESS_KEY_ID is missing", () => {
            delete process.env.R2_ACCESS_KEY_ID;
            expect(() => new R2StorageProvider()).toThrow("Missing required R2 environment variables");
        });

        it("should throw error if R2_SECRET_ACCESS_KEY is missing", () => {
            delete process.env.R2_SECRET_ACCESS_KEY;
            expect(() => new R2StorageProvider()).toThrow("Missing required R2 environment variables");
        });

        it("should throw error if R2_BUCKET_NAME is missing", () => {
            delete process.env.R2_BUCKET_NAME;
            expect(() => new R2StorageProvider()).toThrow("Missing required R2 environment variables");
        });
    });

    describe("generatePresignedPutUrl", () => {
        it("should call getSignedUrl with PutObjectCommand", async () => {
            (getSignedUrl as jest.Mock).mockResolvedValueOnce("https://example.com/put");
            const provider = new R2StorageProvider();
            const url = await provider.generatePresignedPutUrl("test-key.mp3", 3600);

            expect(PutObjectCommand).toHaveBeenCalledWith({
                Bucket: "test-bucket",
                Key: "test-key.mp3",
                ContentType: "audio/mpeg",
            });
            expect(getSignedUrl).toHaveBeenCalledWith(
                expect.anything(),
                expect.any(Object), // Instance of PutObjectCommand
                { expiresIn: 3600 }
            );
            expect(url).toBe("https://example.com/put");
        });
    });

    describe("generatePresignedGetUrl", () => {
        it("should call getSignedUrl with GetObjectCommand", async () => {
            (getSignedUrl as jest.Mock).mockResolvedValueOnce("https://example.com/get");
            const provider = new R2StorageProvider();
            const url = await provider.generatePresignedGetUrl("test-key.mp3", 3600);

            expect(GetObjectCommand).toHaveBeenCalledWith({
                Bucket: "test-bucket",
                Key: "test-key.mp3",
            });
            expect(getSignedUrl).toHaveBeenCalledWith(
                expect.anything(),
                expect.any(Object), // Instance of GetObjectCommand
                { expiresIn: 3600 }
            );
            expect(url).toBe("https://example.com/get");
        });
    });

    describe("uploadObject", () => {
        it("should send PutObjectCommand and return a presigned GET URL (Buffer)", async () => {
            (getSignedUrl as jest.Mock).mockResolvedValueOnce("https://example.com/get");
            const provider = new R2StorageProvider();

            const buffer = Buffer.from("test");
            const url = await provider.uploadObject("test-key.mp3", buffer, "audio/mpeg", 3600);

            expect(PutObjectCommand).toHaveBeenCalledWith({
                Bucket: "test-bucket",
                Key: "test-key.mp3",
                Body: expect.any(Uint8Array),
                ContentType: "audio/mpeg",
            });
            const putInput = (PutObjectCommand as jest.Mock).mock.calls[0][0];
            expect(Array.from(putInput.Body)).toEqual([116, 101, 115, 116]);
            expect(mockSend).toHaveBeenCalledWith(expect.any(PutObjectCommand));
            expect(url).toBe("https://example.com/get");
        });

        it("should send PutObjectCommand and return a presigned GET URL (ArrayBuffer)", async () => {
            (getSignedUrl as jest.Mock).mockResolvedValueOnce("https://example.com/get");
            const provider = new R2StorageProvider();

            const arrayBuffer = new Uint8Array([1, 2, 3, 4]).buffer;
            const url = await provider.uploadObject("test-key.mp3", arrayBuffer, "audio/mpeg", 3600);

            expect(PutObjectCommand).toHaveBeenCalledWith({
                Bucket: "test-bucket",
                Key: "test-key.mp3",
                Body: expect.any(Uint8Array),
                ContentType: "audio/mpeg",
            });
            const putInput = (PutObjectCommand as jest.Mock).mock.calls[0][0];
            expect(Array.from(putInput.Body)).toEqual([1, 2, 3, 4]);
            expect(mockSend).toHaveBeenCalledWith(expect.any(PutObjectCommand));
            expect(url).toBe("https://example.com/get");
        });
    });

    describe("deleteObject", () => {
        it("should send DeleteObjectCommand", async () => {
            const provider = new R2StorageProvider();
            await provider.deleteObject("test-key.mp3");

            expect(DeleteObjectCommand).toHaveBeenCalledWith({
                Bucket: "test-bucket",
                Key: "test-key.mp3",
            });
            expect(mockSend).toHaveBeenCalledWith(expect.any(DeleteObjectCommand));
        });
    });

    describe("headObject", () => {
        it("should return exists true and size if HeadObjectCommand succeeds", async () => {
            mockSend.mockResolvedValueOnce({ ContentLength: 1024 });

            const provider = new R2StorageProvider();
            const result = await provider.headObject("test-key.mp3");

            expect(HeadObjectCommand).toHaveBeenCalledWith({
                Bucket: "test-bucket",
                Key: "test-key.mp3",
            });
            expect(mockSend).toHaveBeenCalledWith(expect.any(HeadObjectCommand));
            expect(result).toEqual({ exists: true, size: 1024 });
        });

        it("should return exists false if NotFound error is thrown", async () => {
            mockSend.mockRejectedValueOnce({ name: "NotFound" });

            const provider = new R2StorageProvider();
            const result = await provider.headObject("test-key.mp3");

            expect(result).toEqual({ exists: false });
        });

        it("should return exists false if 404 http status code error is thrown", async () => {
            mockSend.mockRejectedValueOnce({ $metadata: { httpStatusCode: 404 } });

            const provider = new R2StorageProvider();
            const result = await provider.headObject("test-key.mp3");

            expect(result).toEqual({ exists: false });
        });

        it("should throw error for other errors", async () => {
            mockSend.mockRejectedValueOnce(new Error("Other error"));

            const provider = new R2StorageProvider();
            await expect(provider.headObject("test-key.mp3")).rejects.toThrow("Other error");
        });
    });
});
