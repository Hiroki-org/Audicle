import { articleStorage } from '../storage';
import { Chunk } from '@/types/api';

// Mock logger
jest.mock('@/lib/logger', () => ({
  logger: {
    warn: jest.fn(),
    error: jest.fn(),
    success: jest.fn(),
  },
}));

// Mock crypto
Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: jest.fn().mockReturnValue('mock-uuid'),
  },
  writable: true,
});

describe('articleStorage', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
  });

  const mockChunks: Chunk[] = [
    { text: 'Hello world', start: 0, end: 11 },
  ];

  const mockArticleInput = {
    title: 'Test Article',
    url: 'https://example.com',
    chunks: mockChunks,
  };

  describe('add', () => {
    it('should add an article and separate content from index', () => {
      const result = articleStorage.add(mockArticleInput);

      expect(result).toEqual({
        id: 'mock-uuid',
        title: 'Test Article',
        url: 'https://example.com',
        chunks: mockChunks,
        chunkCount: 1,
        createdAt: expect.any(Number),
      });

      // Check index storage
      const indexJson = localStorage.getItem('audicle_articles_index');
      expect(indexJson).toBeTruthy();
      const index = JSON.parse(indexJson!);
      expect(index).toHaveLength(1);
      expect(index[0]).toEqual(expect.objectContaining({
        id: 'mock-uuid',
        title: 'Test Article',
        chunkCount: 1,
      }));
      expect(index[0].chunks).toBeUndefined(); // Index should not have chunks

      // Check content storage
      const contentJson = localStorage.getItem('audicle_article_content_mock-uuid');
      expect(contentJson).toBeTruthy();
      const content = JSON.parse(contentJson!);
      expect(content).toEqual(mockChunks);
    });
  });

  describe('getAll', () => {
    it('should return empty array when storage is empty', () => {
      expect(articleStorage.getAll()).toEqual([]);
    });

    it('should return articles from index', () => {
      articleStorage.add(mockArticleInput);
      const articles = articleStorage.getAll();
      expect(articles).toHaveLength(1);
      expect(articles[0].id).toBe('mock-uuid');
      expect(articles[0].chunks).toBeUndefined();
    });
  });

  describe('getById', () => {
    it('should return undefined for non-existent id', () => {
      expect(articleStorage.getById('non-existent')).toBeUndefined();
    });

    it('should return article with chunks', () => {
      articleStorage.add(mockArticleInput);
      const article = articleStorage.getById('mock-uuid');
      expect(article).toBeDefined();
      expect(article?.id).toBe('mock-uuid');
      expect(article?.chunks).toEqual(mockChunks);
    });

    it('should return empty chunks if content is missing', () => {
      articleStorage.add(mockArticleInput);
      localStorage.removeItem('audicle_article_content_mock-uuid');

      const article = articleStorage.getById('mock-uuid');
      expect(article).toBeDefined();
      expect(article?.chunks).toEqual([]);
    });
  });

  describe('remove', () => {
    it('should remove article from index and content', () => {
      articleStorage.add(mockArticleInput);

      articleStorage.remove('mock-uuid');

      expect(articleStorage.getAll()).toHaveLength(0);
      expect(localStorage.getItem('audicle_article_content_mock-uuid')).toBeNull();
    });
  });

  describe('clear', () => {
    it('should clear all articles and content', () => {
      articleStorage.add(mockArticleInput);
      // Add another dummy item to ensure specific clearing works if needed,
      // though implementation clears everything with prefix
      localStorage.setItem('other_key', 'keep me');

      articleStorage.clear();

      expect(articleStorage.getAll()).toHaveLength(0);
      expect(localStorage.getItem('audicle_article_content_mock-uuid')).toBeNull();
      expect(localStorage.getItem('audicle_articles_index')).toBeNull();
      // Implementation loops over keys starting with prefix.
      expect(localStorage.getItem('other_key')).toBe('keep me');
    });
  });

  describe('migrate', () => {
    it('should migrate legacy data', () => {
      const legacyArticles = [
        {
          id: 'legacy-1',
          title: 'Legacy Article',
          url: 'https://legacy.com',
          chunks: mockChunks,
          createdAt: 1234567890,
        }
      ];
      localStorage.setItem('audicle_articles', JSON.stringify(legacyArticles));

      articleStorage.migrate();

      // Check index
      const articles = articleStorage.getAll();
      expect(articles).toHaveLength(1);
      expect(articles[0].id).toBe('legacy-1');
      expect(articles[0].chunkCount).toBe(1);

      // Check content
      const contentJson = localStorage.getItem('audicle_article_content_legacy-1');
      expect(JSON.parse(contentJson!)).toEqual(mockChunks);

      // Check legacy removal
      expect(localStorage.getItem('audicle_articles')).toBeNull();
    });

    it('should handle empty legacy data', () => {
      localStorage.setItem('audicle_articles', '[]');
      articleStorage.migrate();
      expect(localStorage.getItem('audicle_articles')).toBeNull();
      expect(articleStorage.getAll()).toHaveLength(0);
    });


    it('should log error when global migration fails', () => {
      const { logger } = require('@/lib/logger');

      const error = new Error('Mock global failure');
      jest.spyOn(Storage.prototype, 'getItem').mockImplementationOnce(() => {
        throw error;
      });

      articleStorage.migrate();

      expect(logger.error).toHaveBeenCalledWith('Migration failed', error);

      jest.restoreAllMocks();
    });

    it('should handle invalid legacy data', () => {
        localStorage.setItem('audicle_articles', 'invalid-json');
        articleStorage.migrate();
        // Should catch error and probably do nothing or log error
        // The implementation tries JSON.parse inside a try-catch, so it catches.
        // It doesn't remove the key if parse fails
       expect(localStorage.getItem('audicle_articles')).toBe('invalid-json');
    });
  });
});
