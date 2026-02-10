import 'fake-indexeddb/auto';
import {
  saveAudioChunk,
  getAudioChunk,
  getArticleChunks,
  deleteArticle,
  clearAll,
  getDownloadedArticles,
  generateKey,
  AudioCacheEntry
} from '../indexedDB';

// Polyfill structuredClone for JSDOM
if (!global.structuredClone) {
    global.structuredClone = function mockStructuredClone(obj: any): any {
        if (obj instanceof Blob) return obj;
        if (typeof obj !== 'object' || obj === null) return obj;

        if (Array.isArray(obj)) {
            return obj.map(mockStructuredClone);
        }

        const cloned: any = {};
        for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                cloned[key] = mockStructuredClone(obj[key]);
            }
        }
        return cloned;
    };
}

// Mock logger to avoid console output during tests
jest.mock('../logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

describe('IndexedDB Audio Cache', () => {
  const mockBlob = new Blob(['test-audio-data'], { type: 'audio/mpeg' });
  const articleUrl = 'https://example.com/article/1';

  beforeEach(async () => {
    await clearAll();
    jest.clearAllMocks();
  });

  describe('generateKey', () => {
    it('should generate correct key', () => {
      expect(generateKey('url', 1, 'voice')).toBe('url:1:voice');
      expect(generateKey('url', 1)).toBe('url:1:default');
    });
  });

  describe('saveAudioChunk & getAudioChunk', () => {
    it('should save and retrieve an audio chunk', async () => {
      const entry: Omit<AudioCacheEntry, 'key'> = {
        articleUrl,
        chunkIndex: 0,
        totalChunks: 3,
        audioData: mockBlob,
        timestamp: Date.now(),
        size: 1024,
        voiceModel: 'en-US-Neural2-A'
      };

      await saveAudioChunk(entry);

      const retrieved = await getAudioChunk(articleUrl, 0, 'en-US-Neural2-A');

      expect(retrieved).toBeDefined();
      expect(retrieved?.articleUrl).toBe(articleUrl);
      expect(retrieved?.chunkIndex).toBe(0);
      expect(retrieved?.audioData).toBeInstanceOf(Blob);
      // Verify key generation in saved entry
      expect(retrieved?.key).toBe(generateKey(articleUrl, 0, 'en-US-Neural2-A'));
    });

    it('should return null for non-existent chunk', async () => {
      const retrieved = await getAudioChunk(articleUrl, 99);
      expect(retrieved).toBeNull();
    });
  });

  describe('getArticleChunks', () => {
    it('should retrieve all chunks for an article', async () => {
      const entries = [0, 1, 2].map(index => ({
        articleUrl,
        chunkIndex: index,
        totalChunks: 3,
        audioData: mockBlob,
        timestamp: Date.now(),
        size: 1000
      }));

      for (const entry of entries) {
        await saveAudioChunk(entry);
      }

      const chunks = await getArticleChunks(articleUrl);
      expect(chunks).toHaveLength(3);
      expect(chunks.sort((a, b) => a.chunkIndex - b.chunkIndex)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ chunkIndex: 0 }),
          expect.objectContaining({ chunkIndex: 1 }),
          expect.objectContaining({ chunkIndex: 2 })
        ])
      );
    });
  });

  describe('deleteArticle', () => {
    it('should delete all chunks for an article', async () => {
       const entries = [0, 1].map(index => ({
        articleUrl,
        chunkIndex: index,
        totalChunks: 2,
        audioData: mockBlob,
        timestamp: Date.now(),
        size: 1000
      }));

      for (const entry of entries) {
        await saveAudioChunk(entry);
      }

      // Add another article to ensure it's not deleted
      await saveAudioChunk({
        articleUrl: 'https://other.com',
        chunkIndex: 0,
        totalChunks: 1,
        audioData: mockBlob,
        timestamp: Date.now(),
        size: 1000
      });

      await deleteArticle(articleUrl);

      const chunks = await getArticleChunks(articleUrl);
      expect(chunks).toHaveLength(0);

      const otherChunks = await getArticleChunks('https://other.com');
      expect(otherChunks).toHaveLength(1);
    });
  });

  describe('getDownloadedArticles', () => {
    it('should correctly aggregate downloaded articles', async () => {
      // Article 1: 2 chunks, fully downloaded
      await saveAudioChunk({
        articleUrl: 'url1',
        chunkIndex: 0,
        totalChunks: 2,
        audioData: mockBlob,
        timestamp: 1000,
        size: 100,
        voiceModel: 'v1'
      });
      await saveAudioChunk({
        articleUrl: 'url1',
        chunkIndex: 1,
        totalChunks: 2,
        audioData: mockBlob,
        timestamp: 2000,
        size: 100,
        voiceModel: 'v1'
      });

      // Article 2: 1 chunk of 3 downloaded
      await saveAudioChunk({
        articleUrl: 'url2',
        chunkIndex: 0,
        totalChunks: 3,
        audioData: mockBlob,
        timestamp: 3000,
        size: 200,
        voiceModel: 'v2'
      });

      const downloaded = await getDownloadedArticles();

      expect(downloaded).toHaveLength(2);

      const article1 = downloaded.find(a => a.url === 'url1');
      expect(article1).toBeDefined();
      expect(article1?.downloadedChunks).toBe(2);
      expect(article1?.totalChunks).toBe(2);
      expect(article1?.totalSize).toBe(200);
      expect(article1?.timestamp).toBe(2000); // Max timestamp

      const article2 = downloaded.find(a => a.url === 'url2');
      expect(article2).toBeDefined();
      expect(article2?.downloadedChunks).toBe(1);
      expect(article2?.totalChunks).toBe(3);
    });
  });
});
