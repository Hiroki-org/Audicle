import { getStorageProvider, resetStorageProvider } from '../index';
import { R2StorageProvider } from '../r2-provider';
import { VercelBlobProvider } from '../vercel-blob-provider';

jest.mock('../r2-provider');
jest.mock('../vercel-blob-provider');

describe('getStorageProvider', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    resetStorageProvider();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('デフォルトでVercelBlobProviderを返すこと', async () => {
    delete process.env.STORAGE_PROVIDER;

    const provider = getStorageProvider();

    expect(VercelBlobProvider).toHaveBeenCalledTimes(1);
    expect(R2StorageProvider).not.toHaveBeenCalled();
    expect(provider).toBeInstanceOf(VercelBlobProvider);
  });

  it('STORAGE_PROVIDERが"vercel-blob"の場合、VercelBlobProviderを返すこと', async () => {
    process.env.STORAGE_PROVIDER = 'vercel-blob';

    const provider = getStorageProvider();

    expect(VercelBlobProvider).toHaveBeenCalledTimes(1);
    expect(R2StorageProvider).not.toHaveBeenCalled();
    expect(provider).toBeInstanceOf(VercelBlobProvider);
  });

  it('STORAGE_PROVIDERが"r2"の場合、R2StorageProviderを返すこと', async () => {
    process.env.STORAGE_PROVIDER = 'r2';

    const provider = getStorageProvider();

    expect(R2StorageProvider).toHaveBeenCalledTimes(1);
    expect(VercelBlobProvider).not.toHaveBeenCalled();
    expect(provider).toBeInstanceOf(R2StorageProvider);
  });

  it('一度作成されたプロバイダーインスタンスをキャッシュすること', async () => {
    process.env.STORAGE_PROVIDER = 'r2';

    const provider1 = getStorageProvider();
    const provider2 = getStorageProvider();

    expect(R2StorageProvider).toHaveBeenCalledTimes(1);
    expect(provider1).toBe(provider2);
  });

  it('resetStorageProviderが呼ばれた後、新しいインスタンスを作成すること', async () => {
    process.env.STORAGE_PROVIDER = 'r2';

    const provider1 = getStorageProvider();
    resetStorageProvider();
    const provider2 = getStorageProvider();

    expect(R2StorageProvider).toHaveBeenCalledTimes(2);
    expect(provider1).not.toBe(provider2);
  });
});
