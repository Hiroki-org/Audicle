import { R2StorageProvider } from "../r2-provider";
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

jest.mock("@aws-sdk/client-s3");
jest.mock("@aws-sdk/s3-request-presigner");

describe("R2StorageProvider", () => {
    const originalEnv = process.env;

    beforeEach(() => {
        jest.clearAllMocks();
        process.env = { ...originalEnv };
        process.env.R2_ACCOUNT_ID = "test-account-id";
        process.env.R2_ACCESS_KEY_ID = "test-access-key";
        process.env.R2_SECRET_ACCESS_KEY = "test-secret-key";
        process.env.R2_BUCKET_NAME = "test-bucket";
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    describe("Initialization", () => {
        it("should initialize S3Client with correct config", () => {
            new R2StorageProvider();
            expect(S3Client).toHaveBeenCalledWith({
                region: "auto",
                endpoint: "https://test-account-id.r2.cloudflarestorage.com",
                credentials: {
                    accessKeyId: "test-access-key",
                    secretAccessKey: "test-secret-key",
                },
            });
        });

        it("should throw if R2_ACCOUNT_ID is missing", () => {
            delete process.env.R2_ACCOUNT_ID;
            expect(() => new R2StorageProvider()).toThrow("Missing required R2 environment variables");
        });

        it("should throw if R2_ACCESS_KEY_ID is missing", () => {
            delete process.env.R2_ACCESS_KEY_ID;
            expect(() => new R2StorageProvider()).toThrow("Missing required R2 environment variables");
        });

        it("should throw if R2_SECRET_ACCESS_KEY is missing", () => {
            delete process.env.R2_SECRET_ACCESS_KEY;
            expect(() => new R2StorageProvider()).toThrow("Missing required R2 environment variables");
        });

        it("should throw if R2_BUCKET_NAME is missing", () => {
            delete process.env.R2_BUCKET_NAME;
            expect(() => new R2StorageProvider()).toThrow("Missing required R2 environment variables");
        });
    });

    describe("generatePresignedPutUrl", () => {
        it("should generate a presigned PUT URL", async () => {
            (getSignedUrl as jest.Mock).mockResolvedValueOnce("https://presigned-put-url");
            const provider = new R2StorageProvider();

            const url = await provider.generatePresignedPutUrl("test-key.mp3", 3600);

            expect(PutObjectCommand).toHaveBeenCalledWith({
                Bucket: "test-bucket",
                Key: "test-key.mp3",
                ContentType: "audio/mpeg",
            });
            expect(getSignedUrl).toHaveBeenCalledWith(expect.any(Object), expect.any(Object), { expiresIn: 3600 });
            expect(url).toBe("https://presigned-put-url");
        });
    });

    describe("generatePresignedGetUrl", () => {
        it("should generate a presigned GET URL", async () => {
            (getSignedUrl as jest.Mock).mockResolvedValueOnce("https://presigned-get-url");
            const provider = new R2StorageProvider();

            const url = await provider.generatePresignedGetUrl("test-key.mp3", 3600);

            expect(GetObjectCommand).toHaveBeenCalledWith({
                Bucket: "test-bucket",
                Key: "test-key.mp3",
            });
            expect(getSignedUrl).toHaveBeenCalledWith(expect.any(Object), expect.any(Object), { expiresIn: 3600 });
            expect(url).toBe("https://presigned-get-url");
        });
    });

    describe("uploadObject", () => {
        it("should upload Buffer data and return a GET URL", async () => {
            const mockSend = jest.fn().mockResolvedValue({});
            (S3Client as jest.Mock).mockImplementation(() => ({ send: mockSend }));
            (getSignedUrl as jest.Mock).mockResolvedValueOnce("https://presigned-get-url");

            const provider = new R2StorageProvider();
            const buffer = Buffer.from("test data");

            const url = await provider.uploadObject("test-key.mp3", buffer, "audio/mpeg");

            expect(PutObjectCommand).toHaveBeenCalledWith({
                Bucket: "test-bucket",
                Key: "test-key.mp3",
                Body: expect.any(Uint8Array),
                ContentType: "audio/mpeg",
            });
            expect(mockSend).toHaveBeenCalledWith(expect.any(Object));
            expect(getSignedUrl).toHaveBeenCalled();
            expect(url).toBe("https://presigned-get-url");
        });

        it("should upload ArrayBuffer data and return a GET URL", async () => {
            const mockSend = jest.fn().mockResolvedValue({});
            (S3Client as jest.Mock).mockImplementation(() => ({ send: mockSend }));
            (getSignedUrl as jest.Mock).mockResolvedValueOnce("https://presigned-get-url");

            const provider = new R2StorageProvider();
            const arrayBuffer = new ArrayBuffer(8);

            const url = await provider.uploadObject("test-key.mp3", arrayBuffer, "audio/mpeg", 7200);

            expect(PutObjectCommand).toHaveBeenCalledWith({
                Bucket: "test-bucket",
                Key: "test-key.mp3",
                Body: expect.any(Uint8Array),
                ContentType: "audio/mpeg",
            });
            expect(mockSend).toHaveBeenCalledWith(expect.any(Object));
            expect(getSignedUrl).toHaveBeenCalledWith(expect.any(Object), expect.any(Object), { expiresIn: 7200 });
            expect(url).toBe("https://presigned-get-url");
        });
    });

    describe("deleteObject", () => {
        it("should send a DeleteObjectCommand", async () => {
            const mockSend = jest.fn().mockResolvedValue({});
            (S3Client as jest.Mock).mockImplementation(() => ({ send: mockSend }));

            const provider = new R2StorageProvider();

            await provider.deleteObject("test-key.mp3");

            expect(DeleteObjectCommand).toHaveBeenCalledWith({
                Bucket: "test-bucket",
                Key: "test-key.mp3",
            });
            expect(mockSend).toHaveBeenCalledWith(expect.any(Object));
        });
    });

    describe("headObject", () => {
        it("should return exists: true and size if object exists", async () => {
            const mockSend = jest.fn().mockResolvedValue({ ContentLength: 1024 });
            (S3Client as jest.Mock).mockImplementation(() => ({ send: mockSend }));

            const provider = new R2StorageProvider();

            const result = await provider.headObject("test-key.mp3");

            expect(HeadObjectCommand).toHaveBeenCalledWith({
                Bucket: "test-bucket",
                Key: "test-key.mp3",
            });
            expect(mockSend).toHaveBeenCalledWith(expect.any(Object));
            expect(result).toEqual({ exists: true, size: 1024 });
        });

        it("should return exists: false if object does not exist (NotFound name)", async () => {
            const notFoundError = new Error("Not Found");
            notFoundError.name = "NotFound";

            const mockSend = jest.fn().mockRejectedValue(notFoundError);
            (S3Client as jest.Mock).mockImplementation(() => ({ send: mockSend }));

            const provider = new R2StorageProvider();

            const result = await provider.headObject("test-key.mp3");

            expect(result).toEqual({ exists: false });
        });

        it("should return exists: false if object does not exist (404 status code)", async () => {
            const notFoundError: any = new Error("Not Found");
            notFoundError.$metadata = { httpStatusCode: 404 };

            const mockSend = jest.fn().mockRejectedValue(notFoundError);
            (S3Client as jest.Mock).mockImplementation(() => ({ send: mockSend }));

            const provider = new R2StorageProvider();

            const result = await provider.headObject("test-key.mp3");

            expect(result).toEqual({ exists: false });
        });

        it("should throw error for other errors", async () => {
            const serverError = new Error("Internal Server Error");

            const mockSend = jest.fn().mockRejectedValue(serverError);
            (S3Client as jest.Mock).mockImplementation(() => ({ send: mockSend }));

            const provider = new R2StorageProvider();

            await expect(provider.headObject("test-key.mp3")).rejects.toThrow("Internal Server Error");
        });
    });
});
