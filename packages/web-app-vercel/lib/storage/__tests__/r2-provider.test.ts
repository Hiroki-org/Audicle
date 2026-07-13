import { R2StorageProvider } from "../r2-provider";

jest.mock("@aws-sdk/client-s3", () => {
    const originalModule = jest.requireActual("@aws-sdk/client-s3");
    return {
        ...originalModule,
        S3Client: jest.fn().mockImplementation(() => ({
            send: jest.fn()
        })),
        HeadObjectCommand: jest.fn()
    };
});

describe("R2StorageProvider", () => {
    let provider: R2StorageProvider;
    let mockClient: any;
    const originalEnv = process.env;

    beforeEach(() => {
        jest.clearAllMocks();
        process.env = { ...originalEnv };
        process.env.R2_ACCOUNT_ID = "test-account";
        process.env.R2_ACCESS_KEY_ID = "test-key";
        process.env.R2_SECRET_ACCESS_KEY = "test-secret";
        process.env.R2_BUCKET_NAME = "test-bucket";

        provider = new R2StorageProvider();
        mockClient = (provider as any).client;
    });

    afterAll(() => {
        process.env = originalEnv;
    });

    describe("headObject", () => {
        it("should return exists: true and size if the object exists", async () => {
            mockClient.send.mockResolvedValueOnce({
                ContentLength: 1024
            });

            const result = await provider.headObject("test-key");

            expect(result).toEqual({ exists: true, size: 1024 });
            expect(mockClient.send).toHaveBeenCalledTimes(1);
        });

        it("should return exists: false if the object is not found (name === 'NotFound')", async () => {
            const error = new Error("Not Found");
            error.name = "NotFound";
            mockClient.send.mockRejectedValueOnce(error);

            const result = await provider.headObject("test-key");

            expect(result).toEqual({ exists: false });
            expect(mockClient.send).toHaveBeenCalledTimes(1);
        });

        it("should return exists: false if the object is not found ($metadata.httpStatusCode === 404)", async () => {
            const error: any = new Error("Not Found");
            error.$metadata = { httpStatusCode: 404 };
            mockClient.send.mockRejectedValueOnce(error);

            const result = await provider.headObject("test-key");

            expect(result).toEqual({ exists: false });
            expect(mockClient.send).toHaveBeenCalledTimes(1);
        });

        it("should throw an error for other errors", async () => {
            const error = new Error("Some other error");
            mockClient.send.mockRejectedValueOnce(error);

            await expect(provider.headObject("test-key")).rejects.toThrow("Some other error");
            expect(mockClient.send).toHaveBeenCalledTimes(1);
        });
    });
});
