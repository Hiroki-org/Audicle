import { articleStorage, Article } from '../articleStorage';

// localStorageのモック
const localStorageMock = (() => {
    let store: Record<string, string> = {};
    return {
        getItem: jest.fn((key: string) => store[key] || null),
        setItem: jest.fn((key: string, value: string) => {
            store[key] = value;
        }),
        removeItem: jest.fn((key: string) => {
            delete store[key];
        }),
        clear: jest.fn(() => {
            store = {};
        }),
    };
})();

Object.defineProperty(window, 'localStorage', {
    value: localStorageMock,
});

// crypto.randomUUIDのモック
Object.defineProperty(globalThis, 'crypto', {
    value: {
        randomUUID: () => 'test-uuid-12345',
    },
});

describe('articleStorage', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        localStorageMock.clear();
    });

    describe('getAll', () => {
        it('should return empty array when no articles', () => {
            localStorageMock.getItem.mockReturnValueOnce(null);
            expect(articleStorage.getAll()).toEqual([]);
        });

        it('should return articles from localStorage', () => {
            const articles: Article[] = [
                {
                    id: '1',
                    url: 'https://example.com',
                    title: 'Test Article',
                    chunks: [],
                    createdAt: '2024-01-01T00:00:00Z',
                },
            ];
            localStorageMock.getItem.mockReturnValueOnce(JSON.stringify(articles));
            expect(articleStorage.getAll()).toEqual(articles);
        });

        it('should return empty array on parse error', () => {
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
            localStorageMock.getItem.mockReturnValueOnce('invalid json');
            expect(articleStorage.getAll()).toEqual([]);
            expect(consoleSpy).toHaveBeenCalled();
            consoleSpy.mockRestore();
        });
    });

    describe('add', () => {
        it('should add article with generated id and createdAt', () => {
            localStorageMock.getItem.mockReturnValue('[]');
            const article = {
                url: 'https://example.com',
                title: 'New Article',
                chunks: [],
            };

            const result = articleStorage.add(article);

            expect(result.id).toBe('test-uuid-12345');
            expect(result.url).toBe('https://example.com');
            expect(result.title).toBe('New Article');
            expect(result.createdAt).toBeDefined();
            expect(localStorageMock.setItem).toHaveBeenCalled();
        });

        it('should use provided id if given', () => {
            localStorageMock.getItem.mockReturnValue('[]');
            const article = {
                id: 'custom-id',
                url: 'https://example.com',
                title: 'New Article',
                chunks: [],
            };

            const result = articleStorage.add(article);
            expect(result.id).toBe('custom-id');
        });
    });

    describe('update', () => {
        it('should update existing article', () => {
            const articles: Article[] = [
                {
                    id: '1',
                    url: 'https://example.com',
                    title: 'Original Title',
                    chunks: [],
                    createdAt: '2024-01-01T00:00:00Z',
                },
            ];
            localStorageMock.getItem.mockReturnValue(JSON.stringify(articles));

            const result = articleStorage.update('1', { title: 'Updated Title' });

            expect(result?.title).toBe('Updated Title');
            expect(localStorageMock.setItem).toHaveBeenCalled();
        });

        it('should return null for non-existent article', () => {
            localStorageMock.getItem.mockReturnValue('[]');
            const result = articleStorage.update('non-existent', { title: 'Test' });
            expect(result).toBeNull();
        });
    });

    describe('getById', () => {
        it('should return article by id', () => {
            const articles: Article[] = [
                {
                    id: '1',
                    url: 'https://example.com',
                    title: 'Test',
                    chunks: [],
                    createdAt: '2024-01-01T00:00:00Z',
                },
            ];
            localStorageMock.getItem.mockReturnValue(JSON.stringify(articles));

            const result = articleStorage.getById('1');
            expect(result?.id).toBe('1');
        });

        it('should return undefined for non-existent id', () => {
            localStorageMock.getItem.mockReturnValue('[]');
            const result = articleStorage.getById('non-existent');
            expect(result).toBeUndefined();
        });
    });

    describe('upsert', () => {
        it('should add new article when url not found', () => {
            localStorageMock.getItem.mockReturnValue('[]');
            const article = {
                url: 'https://example.com',
                title: 'New Article',
                chunks: [],
            };

            const result = articleStorage.upsert(article);
            expect(result.url).toBe('https://example.com');
            expect(result.id).toBeDefined();
        });

        it('should update existing article when url found', () => {
            const articles: Article[] = [
                {
                    id: 'existing-id',
                    url: 'https://example.com',
                    title: 'Original',
                    chunks: [],
                    createdAt: '2024-01-01T00:00:00Z',
                },
            ];
            localStorageMock.getItem.mockReturnValue(JSON.stringify(articles));

            const result = articleStorage.upsert({
                url: 'https://example.com',
                title: 'Updated',
                chunks: [{ index: 0, text: 'chunk1' }],
            });

            expect(result.id).toBe('existing-id');
            expect(result.title).toBe('Updated');
        });

        it('should update id when provided in upsert', () => {
            const articles: Article[] = [
                {
                    id: 'old-id',
                    url: 'https://example.com',
                    title: 'Original',
                    chunks: [],
                    createdAt: '2024-01-01T00:00:00Z',
                },
            ];
            localStorageMock.getItem.mockReturnValue(JSON.stringify(articles));

            const result = articleStorage.upsert({
                id: 'new-id',
                url: 'https://example.com',
                title: 'Updated',
                chunks: [],
            });

            expect(result.id).toBe('new-id');
        });
    });

    describe('remove', () => {
        it('should remove article by id', () => {
            const articles: Article[] = [
                {
                    id: '1',
                    url: 'https://example.com/1',
                    title: 'Article 1',
                    chunks: [],
                    createdAt: '2024-01-01T00:00:00Z',
                },
                {
                    id: '2',
                    url: 'https://example.com/2',
                    title: 'Article 2',
                    chunks: [],
                    createdAt: '2024-01-01T00:00:00Z',
                },
            ];
            localStorageMock.getItem.mockReturnValue(JSON.stringify(articles));

            articleStorage.remove('1');

            expect(localStorageMock.setItem).toHaveBeenCalled();
            const savedData = JSON.parse(localStorageMock.setItem.mock.calls[0][1]);
            expect(savedData).toHaveLength(1);
            expect(savedData[0].id).toBe('2');
        });
    });

    describe('clear', () => {
        it('should remove all articles from localStorage', () => {
            articleStorage.clear();
            expect(localStorageMock.removeItem).toHaveBeenCalledWith('audicle_articles');
        });
    });
});
