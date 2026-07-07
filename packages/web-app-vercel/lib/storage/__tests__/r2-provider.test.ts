import { R2StorageProvider } from "../r2-provider";
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

jest.mock("@aws-sdk/client-s3");
jest.mock("@aws-sdk/s3-request-presigner");

describe("R2StorageProvider", () => {
    const requiredEnv = {
        R2_ACCOUNT_ID: "test-account-id",
        R2_ACCESS_KEY_ID: "test-access-key",
        R2_SECRET_ACCESS_KEY: "test-secret-key",
        R2_BUCKET_NAME: "test-bucket",
    };
    const originalEnv = Object.fromEntries(
        Object.keys(requiredEnv).map((key) => [key, process.env[key]])
    );

    const restoreRequiredEnv = () => {
        for (const [key, value] of Object.entries(originalEnv)) {
            if (value === undefined) {
                delete process.env[key];
            } else {
                process.env[key] = value;
            }
        }
    };

    beforeEach(() => {
        jest.clearAllMocks();
        Object.assign(process.env, requiredEnv);
    });

    afterAll(() => {
        restoreRequiredEnv();
    });

    describe("constructor", () => {
        it("should initialize successfully with all required env vars", () => {
            expect(() => new R2StorageProvider()).not.toThrow();
            expect(S3Client).toHaveBeenCalledWith({
                region: "auto",
                endpoint: "https://test-account-id.r2.cloudflarestorage.com",
                credentials: {
                    accessKeyId: "test-access-key",
                    secretAccessKey: "test-secret-key",
                },
            });
        });

        it.each(Object.keys(requiredEnv))("should throw error when %s is missing", (envKey) => {
            delete process.env[envKey];
            expect(() => new R2StorageProvider()).toThrow(
                "Missing required R2 environment variables: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME"
            );
        });
    });

    describe("methods", () => {
        let provider: R2StorageProvider;
        let mockS3ClientInstance: any;

        beforeEach(() => {
            mockS3ClientInstance = {
                send: jest.fn(),
            };
            (S3Client as jest.Mock).mockImplementation(() => mockS3ClientInstance);
            provider = new R2StorageProvider();
        });

        describe("generatePresignedPutUrl", () => {
            it("should return a presigned URL for PutObject", async () => {
                (getSignedUrl as jest.Mock).mockResolvedValue("https://presigned-put-url");
                const url = await provider.generatePresignedPutUrl("test-key", 3600);
                expect(url).toBe("https://presigned-put-url");
                expect(PutObjectCommand).toHaveBeenCalledWith({
                    Bucket: "test-bucket",
                    Key: "test-key",
                    ContentType: "audio/mpeg",
                });
                expect(getSignedUrl).toHaveBeenCalledWith(mockS3ClientInstance, expect.any(Object), {
                    expiresIn: 3600,
                });
            });
        });

        describe("generatePresignedGetUrl", () => {
            it("should return a presigned URL for GetObject", async () => {
                (getSignedUrl as jest.Mock).mockResolvedValue("https://presigned-get-url");
                const url = await provider.generatePresignedGetUrl("test-key", 3600);
                expect(url).toBe("https://presigned-get-url");
                expect(GetObjectCommand).toHaveBeenCalledWith({
                    Bucket: "test-bucket",
                    Key: "test-key",
                });
                expect(getSignedUrl).toHaveBeenCalledWith(mockS3ClientInstance, expect.any(Object), { expiresIn: 3600 });
            });
        });

        describe("uploadObject", () => {
            it("should upload object and return a presigned get URL", async () => {
                (getSignedUrl as jest.Mock).mockResolvedValue("https://presigned-get-url-after-upload");
                mockS3ClientInstance.send.mockResolvedValue({});

                const data = Buffer.from("test-data");
                const url = await provider.uploadObject("test-key", data, "text/plain", 3600);

                expect(url).toBe("https://presigned-get-url-after-upload");
                expect(PutObjectCommand).toHaveBeenCalledWith({
                    Bucket: "test-bucket",
                    Key: "test-key",
                    Body: expect.any(Uint8Array),
                    ContentType: "text/plain",
                });
                expect(mockS3ClientInstance.send).toHaveBeenCalledWith(expect.any(Object));
                expect(GetObjectCommand).toHaveBeenCalledWith({
                    Bucket: "test-bucket",
                    Key: "test-key",
                });
                expect(getSignedUrl).toHaveBeenCalledWith(mockS3ClientInstance, expect.any(Object), { expiresIn: 3600 });
            });

            it("should upload an ArrayBuffer body", async () => {
                (getSignedUrl as jest.Mock).mockResolvedValue("https://presigned-get-url-after-upload");
                mockS3ClientInstance.send.mockResolvedValue({});

                const data = new Uint8Array([1, 2, 3]).buffer;
                await provider.uploadObject("array-buffer-key", data, "application/octet-stream", 1800);

                expect(PutObjectCommand).toHaveBeenCalledWith({
                    Bucket: "test-bucket",
                    Key: "array-buffer-key",
                    Body: expect.any(Uint8Array),
                    ContentType: "application/octet-stream",
                });
                expect(GetObjectCommand).toHaveBeenCalledWith({
                    Bucket: "test-bucket",
                    Key: "array-buffer-key",
                });
                expect(getSignedUrl).toHaveBeenCalledWith(mockS3ClientInstance, expect.any(Object), {
                    expiresIn: 1800,
                });
            });
        });

        describe("deleteObject", () => {
            it("should delete object successfully", async () => {
                mockS3ClientInstance.send.mockResolvedValue({});
                await provider.deleteObject("test-key");
                expect(DeleteObjectCommand).toHaveBeenCalledWith({
                    Bucket: "test-bucket",
                    Key: "test-key",
                });
                expect(mockS3ClientInstance.send).toHaveBeenCalledWith(expect.any(Object));
            });
        });

        describe("headObject", () => {
            it("should return exists: true and size when object is found", async () => {
                mockS3ClientInstance.send.mockResolvedValue({ ContentLength: 1024 });
                const result = await provider.headObject("test-key");
                expect(result).toEqual({ exists: true, size: 1024 });
                expect(HeadObjectCommand).toHaveBeenCalledWith({
                    Bucket: "test-bucket",
                    Key: "test-key",
                });
            });

            it("should return exists: false when NotFound error is thrown", async () => {
                const error = new Error("Not found");
                error.name = "NotFound";
                mockS3ClientInstance.send.mockRejectedValue(error);

                const result = await provider.headObject("test-key");
                expect(result).toEqual({ exists: false });
            });

            it("should return exists: false when 404 httpStatusCode is thrown", async () => {
                const error = new Error("Not found");
                (error as any).$metadata = { httpStatusCode: 404 };
                mockS3ClientInstance.send.mockRejectedValue(error);

                const result = await provider.headObject("test-key");
                expect(result).toEqual({ exists: false });
            });

            it("should throw other errors", async () => {
                const error = new Error("Other error");
                mockS3ClientInstance.send.mockRejectedValue(error);

                await expect(provider.headObject("test-key")).rejects.toThrow("Other error");
            });
        });
    });
});
