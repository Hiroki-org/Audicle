import { R2StorageProvider } from '../r2-provider';
import { VercelBlobProvider } from '../vercel-blob-provider';

jest.mock('../r2-provider');
jest.mock('../vercel-blob-provider');

describe('getStorageProvider', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('デフォルトでVercelBlobProviderを返すこと', async () => {
    delete process.env.STORAGE_PROVIDER;

    // dynamically import the index so it uses the mocked modules and current env vars
    const storageIndex = await import('../index');
    storageIndex.resetStorageProvider(); // Ensure fresh state

    const provider = storageIndex.getStorageProvider();

    const { VercelBlobProvider: MockedVercelBlobProvider } = await import('../vercel-blob-provider');
    const { R2StorageProvider: MockedR2StorageProvider } = await import('../r2-provider');

    expect(MockedVercelBlobProvider).toHaveBeenCalledTimes(1);
    expect(MockedR2StorageProvider).not.toHaveBeenCalled();
    // We can check if it returns an instance created by the mock
    expect(provider).toBeDefined();
  });

  it('STORAGE_PROVIDERが"vercel-blob"の場合、VercelBlobProviderを返すこと', async () => {
    process.env.STORAGE_PROVIDER = 'vercel-blob';

    const storageIndex = await import('../index');
    storageIndex.resetStorageProvider();

    const provider = storageIndex.getStorageProvider();

    const { VercelBlobProvider: MockedVercelBlobProvider } = await import('../vercel-blob-provider');
    const { R2StorageProvider: MockedR2StorageProvider } = await import('../r2-provider');

    expect(MockedVercelBlobProvider).toHaveBeenCalledTimes(1);
    expect(MockedR2StorageProvider).not.toHaveBeenCalled();
    expect(provider).toBeDefined();
  });

  it('STORAGE_PROVIDERが"r2"の場合、R2StorageProviderを返すこと', async () => {
    process.env.STORAGE_PROVIDER = 'r2';

    const storageIndex = await import('../index');
    storageIndex.resetStorageProvider();

    const provider = storageIndex.getStorageProvider();

    const { VercelBlobProvider: MockedVercelBlobProvider } = await import('../vercel-blob-provider');
    const { R2StorageProvider: MockedR2StorageProvider } = await import('../r2-provider');

    expect(MockedR2StorageProvider).toHaveBeenCalledTimes(1);
    expect(MockedVercelBlobProvider).not.toHaveBeenCalled();
    expect(provider).toBeDefined();
  });

  it('一度作成されたプロバイダーインスタンスをキャッシュすること', async () => {
    process.env.STORAGE_PROVIDER = 'r2';

    const storageIndex = await import('../index');
    storageIndex.resetStorageProvider();

    const provider1 = storageIndex.getStorageProvider();
    const provider2 = storageIndex.getStorageProvider();

    const { R2StorageProvider: MockedR2StorageProvider } = await import('../r2-provider');

    expect(MockedR2StorageProvider).toHaveBeenCalledTimes(1);
    expect(provider1).toBe(provider2);
  });

  it('resetStorageProviderが呼ばれた後、新しいインスタンスを作成すること', async () => {
    process.env.STORAGE_PROVIDER = 'r2';

    const storageIndex = await import('../index');
    storageIndex.resetStorageProvider();

    const provider1 = storageIndex.getStorageProvider();
    storageIndex.resetStorageProvider();
    const provider2 = storageIndex.getStorageProvider();

    const { R2StorageProvider: MockedR2StorageProvider } = await import('../r2-provider');

    expect(MockedR2StorageProvider).toHaveBeenCalledTimes(2);
    expect(provider1).not.toBe(provider2);
  });
});
