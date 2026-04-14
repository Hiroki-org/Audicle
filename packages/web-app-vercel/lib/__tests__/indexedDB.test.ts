import "fake-indexeddb/auto";
import { generateKey, saveAudioChunk, getAudioChunk, getArticleChunks, deleteArticle, clearAll, getDownloadedArticles, getStorageUsage, getArticleDownloadStatus, checkStorageCapacity } from '../indexedDB';

describe('indexedDB utils', () => {
  beforeEach(async () => {
    await clearAll();
  });

  describe('generateKey', () => {
    it('should generate a key with all arguments provided', () => {
        const articleUrl = 'https://example.com/article';
        const chunkIndex = 5;
        const voiceModel = 'en-US-Neural2-F';

        const result = generateKey(articleUrl, chunkIndex, voiceModel);

        expect(result).toBe(`${encodeURIComponent('https://example.com/article')}:5:${encodeURIComponent('en-US-Neural2-F')}`);
    });

    it('should generate a key with default voiceModel when not provided', () => {
        const articleUrl = 'https://example.com/article';
        const chunkIndex = 2;

        const result = generateKey(articleUrl, chunkIndex);

        expect(result).toBe(`${encodeURIComponent('https://example.com/article')}:2:${encodeURIComponent('default')}`);
    });
  });

  describe('saveAudioChunk and getAudioChunk', () => {
    it('should save and retrieve an audio chunk', async () => {
      const entry = {
        articleUrl: 'https://example.com/article1',
        chunkIndex: 0,
        totalChunks: 2,
        voiceModel: 'en-US-Neural2-F',
        timestamp: Date.now(),
        size: 1024,
        audioData: new Blob(['test data']),
      };

      await saveAudioChunk(entry);
      const retrieved = await getAudioChunk(entry.articleUrl, entry.chunkIndex, entry.voiceModel);

      expect(retrieved).not.toBeNull();
      expect(retrieved?.articleUrl).toBe(entry.articleUrl);
      expect(retrieved?.chunkIndex).toBe(entry.chunkIndex);
      expect(retrieved?.totalChunks).toBe(entry.totalChunks);
      expect(retrieved?.voiceModel).toBe(entry.voiceModel);
      expect(retrieved?.size).toBe(entry.size);
      expect(retrieved?.key).toBe(generateKey(entry.articleUrl, entry.chunkIndex, entry.voiceModel));
    });

    it('should return null for non-existent chunk', async () => {
      const retrieved = await getAudioChunk('https://example.com/missing', 0);
      expect(retrieved).toBeNull();
    });
  });

  describe('getArticleChunks', () => {
    it('should retrieve all chunks for a specific article', async () => {
      const articleUrl1 = 'https://example.com/article1';
      const articleUrl2 = 'https://example.com/article2';

      await saveAudioChunk({
        articleUrl: articleUrl1,
        chunkIndex: 0,
        totalChunks: 2,
        timestamp: Date.now(),
        size: 1024,
        audioData: new Blob(['data1']),
      });
      await saveAudioChunk({
        articleUrl: articleUrl1,
        chunkIndex: 1,
        totalChunks: 2,
        timestamp: Date.now(),
        size: 1024,
        audioData: new Blob(['data2']),
      });
      await saveAudioChunk({
        articleUrl: articleUrl2,
        chunkIndex: 0,
        totalChunks: 1,
        timestamp: Date.now(),
        size: 1024,
        audioData: new Blob(['data3']),
      });

      const chunks1 = await getArticleChunks(articleUrl1);
      expect(chunks1).toHaveLength(2);
      expect(chunks1.map(c => c.chunkIndex)).toEqual(expect.arrayContaining([0, 1]));

      const chunks2 = await getArticleChunks(articleUrl2);
      expect(chunks2).toHaveLength(1);
      expect(chunks2[0].chunkIndex).toBe(0);
    });
  });

  describe('deleteArticle', () => {
    it('should delete all chunks for a specific article', async () => {
      const articleUrl = 'https://example.com/article1';

      await saveAudioChunk({
        articleUrl,
        chunkIndex: 0,
        totalChunks: 2,
        timestamp: Date.now(),
        size: 1024,
        audioData: new Blob(['data1']),
      });
      await saveAudioChunk({
        articleUrl,
        chunkIndex: 1,
        totalChunks: 2,
        timestamp: Date.now(),
        size: 1024,
        audioData: new Blob(['data2']),
      });

      await deleteArticle(articleUrl);

      const chunks = await getArticleChunks(articleUrl);
      expect(chunks).toHaveLength(0);
    });
  });

  describe('clearAll', () => {
    it('should delete all chunks for all articles', async () => {
      await saveAudioChunk({
        articleUrl: 'https://example.com/article1',
        chunkIndex: 0,
        totalChunks: 1,
        timestamp: Date.now(),
        size: 1024,
        audioData: new Blob(['data1']),
      });
      await saveAudioChunk({
        articleUrl: 'https://example.com/article2',
        chunkIndex: 0,
        totalChunks: 1,
        timestamp: Date.now(),
        size: 1024,
        audioData: new Blob(['data2']),
      });

      await clearAll();

      const chunks1 = await getArticleChunks('https://example.com/article1');
      const chunks2 = await getArticleChunks('https://example.com/article2');

      expect(chunks1).toHaveLength(0);
      expect(chunks2).toHaveLength(0);
    });
  });

  describe('getDownloadedArticles', () => {
    it('should return aggregated data for downloaded articles', async () => {
      const articleUrl1 = 'https://example.com/article1';
      const articleUrl2 = 'https://example.com/article2';
      const ts1 = Date.now() - 1000;
      const ts2 = Date.now();

      await saveAudioChunk({
        articleUrl: articleUrl1,
        chunkIndex: 0,
        totalChunks: 3,
        voiceModel: 'model1',
        timestamp: ts1,
        size: 1000,
        audioData: new Blob(['data']),
      });
      await saveAudioChunk({
        articleUrl: articleUrl1,
        chunkIndex: 1,
        totalChunks: 3,
        voiceModel: 'model1',
        timestamp: ts2, // more recent
        size: 2000,
        audioData: new Blob(['data']),
      });
      await saveAudioChunk({
        articleUrl: articleUrl2,
        chunkIndex: 0,
        totalChunks: 1,
        voiceModel: 'model2',
        timestamp: ts1,
        size: 1500,
        audioData: new Blob(['data']),
      });

      const downloaded = await getDownloadedArticles();
      expect(downloaded).toHaveLength(2);

      const a1 = downloaded.find(a => a.url === articleUrl1);
      expect(a1).toBeDefined();
      expect(a1?.totalChunks).toBe(3);
      expect(a1?.downloadedChunks).toBe(2);
      expect(a1?.totalSize).toBe(3000);
      expect(a1?.timestamp).toBe(ts2);
      expect(a1?.voiceModel).toBe('model1');

      const a2 = downloaded.find(a => a.url === articleUrl2);
      expect(a2).toBeDefined();
      expect(a2?.totalChunks).toBe(1);
      expect(a2?.downloadedChunks).toBe(1);
      expect(a2?.totalSize).toBe(1500);
      expect(a2?.timestamp).toBe(ts1);
      expect(a2?.voiceModel).toBe('model2');
    });
  });

  describe('getStorageUsage', () => {
    let originalStorage: StorageManager | undefined;

    beforeEach(() => {
      originalStorage = navigator.storage;
    });

    afterEach(() => {
      Object.defineProperty(navigator, 'storage', {
        value: originalStorage,
        configurable: true,
      });
    });

    it('should use navigator.storage.estimate if available', async () => {
      Object.defineProperty(navigator, 'storage', {
        value: {
          estimate: jest.fn().mockResolvedValue({ usage: 1234, quota: 5678 })
        },
        configurable: true,
      });

      const usage = await getStorageUsage();
      expect(usage).toEqual({ used: 1234, available: 5678 });
    });

    it('should fallback to calculating from DB if navigator.storage.estimate is not available', async () => {
      Object.defineProperty(navigator, 'storage', {
        value: {},
        configurable: true,
      });

      await saveAudioChunk({
        articleUrl: 'https://example.com/article1',
        chunkIndex: 0,
        totalChunks: 1,
        timestamp: Date.now(),
        size: 1000,
        audioData: new Blob(['data']),
      });
      await saveAudioChunk({
        articleUrl: 'https://example.com/article2',
        chunkIndex: 0,
        totalChunks: 1,
        timestamp: Date.now(),
        size: 2000,
        audioData: new Blob(['data']),
      });

      const usage = await getStorageUsage();
      expect(usage).toEqual({ used: 3000, available: Infinity });
    });
  });

  describe('getArticleDownloadStatus', () => {
    it('should return null for non-existent article', async () => {
      const status = await getArticleDownloadStatus('https://example.com/missing');
      expect(status).toBeNull();
    });

    it('should return partial completion status', async () => {
      const articleUrl = 'https://example.com/article1';
      await saveAudioChunk({
        articleUrl,
        chunkIndex: 0,
        totalChunks: 3,
        timestamp: Date.now(),
        size: 1024,
        audioData: new Blob(['data']),
      });

      const status = await getArticleDownloadStatus(articleUrl);
      expect(status).toEqual({
        downloaded: 1,
        total: 3,
        isComplete: false,
      });
    });

    it('should return full completion status', async () => {
      const articleUrl = 'https://example.com/article1';
      await saveAudioChunk({
        articleUrl,
        chunkIndex: 0,
        totalChunks: 2,
        timestamp: Date.now(),
        size: 1024,
        audioData: new Blob(['data']),
      });
      await saveAudioChunk({
        articleUrl,
        chunkIndex: 1,
        totalChunks: 2,
        timestamp: Date.now(),
        size: 1024,
        audioData: new Blob(['data']),
      });

      const status = await getArticleDownloadStatus(articleUrl);
      expect(status).toEqual({
        downloaded: 2,
        total: 2,
        isComplete: true,
      });
    });
  });

  describe('checkStorageCapacity', () => {
    let originalStorage: StorageManager | undefined;

    beforeEach(() => {
      originalStorage = navigator.storage;
    });

    afterEach(() => {
      Object.defineProperty(navigator, 'storage', {
        value: originalStorage,
        configurable: true,
      });
    });

    it('should return true if enough capacity', async () => {
      Object.defineProperty(navigator, 'storage', {
        value: {
          estimate: jest.fn().mockResolvedValue({ usage: 100, quota: 1000 })
        },
        configurable: true,
      });

      const canFit = await checkStorageCapacity(500);
      expect(canFit).toBe(true); // 100 + 500 = 600 < 1000
    });

    it('should return false if not enough capacity', async () => {
      Object.defineProperty(navigator, 'storage', {
        value: {
          estimate: jest.fn().mockResolvedValue({ usage: 800, quota: 1000 })
        },
        configurable: true,
      });

      const canFit = await checkStorageCapacity(500);
      expect(canFit).toBe(false); // 800 + 500 = 1300 > 1000
    });
  });

  describe('Error Handling', () => {
    let originalIndexedDB: IDBFactory;

    beforeEach(() => {
      originalIndexedDB = global.indexedDB;
    });

    afterEach(() => {
      Object.defineProperty(global, 'indexedDB', {
        value: originalIndexedDB,
        configurable: true,
      });
      // Need to reset the cached dbPromise in the module, but it's not exported.
      // We can force a reset by closing the mock connection if it was established,
      // but the easiest way to ensure a fresh state for module-level variables
      // is to reset modules, which we can't easily do inside a describe block without
      // re-requiring the module.
      // Since fake-indexeddb resets its state, we just need to ensure our tests that
      // test openDB failures run when dbPromise is null.
      // Since dbPromise is null initially, we should test openDB error first.
    });

    it('should handle openDB error', async () => {
      // Create a fake IDBOpenDBRequest
      const mockRequest = {
        onerror: null as any,
        onsuccess: null as any,
        onupgradeneeded: null as any,
        error: new Error('Mock open error'),
      } as unknown as IDBOpenDBRequest;

      const mockIndexedDB = {
        open: jest.fn().mockReturnValue(mockRequest)
      };

      Object.defineProperty(global, 'indexedDB', {
        value: mockIndexedDB,
        configurable: true,
      });

      // We need to re-import or somehow reset the dbPromise.
      // Since we can't easily reset dbPromise, we mock indexedDB.open
      // to return our mock request, then trigger onerror.

      // Let's use jest.isolateModules to test this to ensure a fresh module state
      let moduleSaveAudioChunk: any;
      jest.isolateModules(() => {
        const dbModule = require('../indexedDB');
        moduleSaveAudioChunk = dbModule.saveAudioChunk;
      });

      const promise = moduleSaveAudioChunk({
        articleUrl: 'err', chunkIndex: 0, totalChunks: 1, timestamp: 0, size: 0, audioData: new Blob()
      });

      await Promise.resolve();

      if (mockRequest.onerror) {
        (mockRequest as any).onerror({ target: mockRequest });
      }

      await expect(promise).rejects.toThrow('Mock open error');
    });

    it('should handle transaction error during saveAudioChunk', async () => {
       // Save a chunk normally to ensure DB is open
       await saveAudioChunk({
        articleUrl: 'test', chunkIndex: 0, totalChunks: 1, timestamp: 0, size: 0, audioData: new Blob()
      });

      // Now we want to force a transaction error.
      // We can do this by mocking db.transaction on the resolved db.
      // We can't easily access 'db' since it's hidden inside the module.
      // But we can spy on IDBDatabase.prototype.transaction if fake-indexeddb uses it.
      // Alternatively, we can force a put error by passing invalid data, but we already have blob.

      // Let's try to mock the IDBTransaction's put method or the transaction itself.
      // With fake-indexeddb, we can't easily spy on internal prototypes.

      // Let's just create an isolated test that mocks indexedDB completely to test transaction errors.
      let dbModule: any;
      jest.isolateModules(() => {
        dbModule = require('../indexedDB');
      });

      const mockTransaction = {
        onerror: null as any,
        objectStore: jest.fn().mockReturnValue({
          put: jest.fn().mockReturnValue({
            onsuccess: null,
            onerror: null
          })
        }),
        error: new Error('Tx error')
      };

      const mockDb = {
        transaction: jest.fn().mockReturnValue(mockTransaction),
        objectStoreNames: { contains: jest.fn().mockReturnValue(true) }
      };

      const mockRequest = {
        onerror: null as any,
        onsuccess: null as any,
        result: mockDb
      };

      Object.defineProperty(global, 'indexedDB', {
        value: { open: jest.fn().mockReturnValue(mockRequest) },
        configurable: true,
      });

      const promise = dbModule.saveAudioChunk({
        articleUrl: 'err', chunkIndex: 0, totalChunks: 1, timestamp: 0, size: 0, audioData: new Blob()
      });

      await Promise.resolve();
      if (mockRequest.onsuccess) (mockRequest as any).onsuccess();

      await Promise.resolve();
      if (mockTransaction.onerror) (mockTransaction as any).onerror();

      await expect(promise).rejects.toThrow('Tx error');
    });

    it('should handle request error during saveAudioChunk put', async () => {
      let dbModule: any;
      jest.isolateModules(() => {
        dbModule = require('../indexedDB');
      });

      const mockPutRequest = {
        onerror: null as any,
        onsuccess: null as any,
        error: new Error('Put error')
      };

      const mockTransaction = {
        onerror: null as any,
        objectStore: jest.fn().mockReturnValue({
          put: jest.fn().mockReturnValue(mockPutRequest)
        })
      };

      const mockDb = {
        transaction: jest.fn().mockReturnValue(mockTransaction),
      };

      const mockRequest = {
        onerror: null as any,
        onsuccess: null as any,
        result: mockDb
      };

      Object.defineProperty(global, 'indexedDB', {
        value: { open: jest.fn().mockReturnValue(mockRequest) },
        configurable: true,
      });

      const promise = dbModule.saveAudioChunk({
        articleUrl: 'err', chunkIndex: 0, totalChunks: 1, timestamp: 0, size: 0, audioData: new Blob()
      });

      await Promise.resolve();
      if (mockRequest.onsuccess) (mockRequest as any).onsuccess();

      await Promise.resolve();
      if (mockPutRequest.onerror) (mockPutRequest as any).onerror();

      await expect(promise).rejects.toThrow('Put error');
    });

    it('should handle request error during getAudioChunk get', async () => {
      let dbModule: any;
      jest.isolateModules(() => {
        dbModule = require('../indexedDB');
      });

      const mockGetRequest = {
        onerror: null as any,
        onsuccess: null as any,
        error: new Error('Get error')
      };

      const mockTransaction = {
        onerror: null as any,
        objectStore: jest.fn().mockReturnValue({
          get: jest.fn().mockReturnValue(mockGetRequest)
        })
      };

      const mockDb = {
        transaction: jest.fn().mockReturnValue(mockTransaction),
      };

      const mockRequest = {
        onerror: null as any,
        onsuccess: null as any,
        result: mockDb
      };

      Object.defineProperty(global, 'indexedDB', {
        value: { open: jest.fn().mockReturnValue(mockRequest) },
        configurable: true,
      });

      const promise = dbModule.getAudioChunk('url', 0);

      await Promise.resolve();
      if (mockRequest.onsuccess) (mockRequest as any).onsuccess();

      await Promise.resolve();
      if (mockGetRequest.onerror) (mockGetRequest as any).onerror();

      await expect(promise).rejects.toThrow('Get error');
    });

    it('should handle connection unexpectedly closed', async () => {
      let dbModule: any;
      jest.isolateModules(() => {
        dbModule = require('../indexedDB');
      });

      const firstGetRequest = {
        onerror: null as any,
        onsuccess: null as any,
        result: undefined,
      };
      const secondGetRequest = {
        onerror: null as any,
        onsuccess: null as any,
        result: undefined,
      };

      const objectStore = {
        get: jest
          .fn()
          .mockReturnValueOnce(firstGetRequest)
          .mockReturnValueOnce(secondGetRequest),
      };

      const mockDb = {
        onclose: null as any,
        transaction: jest.fn().mockReturnValue({
          objectStore: jest.fn().mockReturnValue(objectStore),
        }),
      };

      const mockRequest = {
        onerror: null as any,
        onsuccess: null as any,
        result: mockDb,
      };

      const mockRequest2 = {
        onerror: null as any,
        onsuccess: null as any,
        result: mockDb,
      };

      Object.defineProperty(global, 'indexedDB', {
        value: {
          open: jest.fn()
            .mockReturnValueOnce(mockRequest)
            .mockReturnValueOnce(mockRequest2),
        },
        configurable: true,
      });

      const promise1 = dbModule.getAudioChunk('url', 0);
      await Promise.resolve();
      if (mockRequest.onsuccess) (mockRequest as any).onsuccess();
      await Promise.resolve();
      if (firstGetRequest.onsuccess) (firstGetRequest as any).onsuccess();
      await expect(promise1).resolves.toBeNull();

      // Trigger onclose and ensure next call re-opens DB
      if (mockDb.onclose) (mockDb as any).onclose();

      const promise2 = dbModule.getAudioChunk('url', 0);
      await Promise.resolve();
      if (mockRequest2.onsuccess) (mockRequest2 as any).onsuccess();
      await Promise.resolve();
      if (secondGetRequest.onsuccess) (secondGetRequest as any).onsuccess();
      await expect(promise2).resolves.toBeNull();

      expect(global.indexedDB.open).toHaveBeenCalledTimes(2);
    });
  });
});
