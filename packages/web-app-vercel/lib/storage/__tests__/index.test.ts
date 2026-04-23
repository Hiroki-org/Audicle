describe("getStorageProvider", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("デフォルトでVercelBlobProviderを返すこと", async () => {
    delete process.env.STORAGE_PROVIDER;

    const storageIndex = await import("../index");
    const { VercelBlobProvider } = await import("../vercel-blob-provider");
    const provider = storageIndex.getStorageProvider();

    expect(provider).toBeInstanceOf(VercelBlobProvider);
  });

  it('STORAGE_PROVIDERが"vercel-blob"の場合、VercelBlobProviderを返すこと', async () => {
    process.env.STORAGE_PROVIDER = "vercel-blob";

    const storageIndex = await import("../index");
    const { VercelBlobProvider } = await import("../vercel-blob-provider");
    const provider = storageIndex.getStorageProvider();

    expect(provider).toBeInstanceOf(VercelBlobProvider);
  });

  it('STORAGE_PROVIDERが"r2"の場合、R2StorageProviderを返すこと', async () => {
    process.env.STORAGE_PROVIDER = "r2";
    process.env.R2_ACCOUNT_ID = "test-account";
    process.env.R2_ACCESS_KEY_ID = "test-key";
    process.env.R2_SECRET_ACCESS_KEY = "test-secret";
    process.env.R2_BUCKET_NAME = "test-bucket";

    const storageIndex = await import("../index");
    const { R2StorageProvider } = await import("../r2-provider");
    const provider = storageIndex.getStorageProvider();

    expect(provider).toBeInstanceOf(R2StorageProvider);
  });

  it("一度作成されたプロバイダーインスタンスをキャッシュすること", async () => {
    process.env.STORAGE_PROVIDER = "r2";
    process.env.R2_ACCOUNT_ID = "test-account";
    process.env.R2_ACCESS_KEY_ID = "test-key";
    process.env.R2_SECRET_ACCESS_KEY = "test-secret";
    process.env.R2_BUCKET_NAME = "test-bucket";

    const storageIndex = await import("../index");
    const provider1 = storageIndex.getStorageProvider();
    const provider2 = storageIndex.getStorageProvider();

    expect(provider1).toBe(provider2);
  });

  it("resetStorageProviderが呼ばれた後、新しいインスタンスを作成すること", async () => {
    process.env.STORAGE_PROVIDER = "r2";
    process.env.R2_ACCOUNT_ID = "test-account";
    process.env.R2_ACCESS_KEY_ID = "test-key";
    process.env.R2_SECRET_ACCESS_KEY = "test-secret";
    process.env.R2_BUCKET_NAME = "test-bucket";

    const storageIndex = await import("../index");
    const provider1 = storageIndex.getStorageProvider();

    storageIndex.resetStorageProvider();
    const provider2 = storageIndex.getStorageProvider();

    expect(provider1).not.toBe(provider2);
  });
});
