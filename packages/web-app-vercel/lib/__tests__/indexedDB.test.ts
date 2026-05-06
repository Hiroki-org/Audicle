import { generateKey } from '../indexedDB';

type IndexedDBMock = {
    openRequest: Record<string, any>;
    db: Record<string, any>;
    transaction: Record<string, any>;
    store: Record<string, jest.Mock>;
    putRequest: Record<string, any>;
    clearRequest: Record<string, any>;
};

function createIndexedDBMock(): IndexedDBMock {
    const openRequest: Record<string, any> = {};
    const putRequest: Record<string, any> = {};
    const clearRequest: Record<string, any> = {};
    const store = {
        put: jest.fn(() => putRequest),
        clear: jest.fn(() => clearRequest),
    };
    const transaction: Record<string, any> = {
        objectStore: jest.fn(() => store),
        error: null,
    };
    const db: Record<string, any> = {
        transaction: jest.fn(() => transaction),
        close: jest.fn(),
    };

    Object.defineProperty(global, 'indexedDB', {
        configurable: true,
        value: {
            open: jest.fn(() => openRequest),
        },
    });

    return { openRequest, db, transaction, store, putRequest, clearRequest };
}

async function openDatabase(mock: IndexedDBMock) {
    mock.openRequest.result = mock.db;
    mock.openRequest.onsuccess();
    await Promise.resolve();
}

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

    it('should generate a key with default voiceModel when provided as an empty string', () => {
        const articleUrl = 'https://example.com/article';
        const chunkIndex = 0;
        const voiceModel = '';

        const result = generateKey(articleUrl, chunkIndex, voiceModel);

        expect(result).toBe(`${encodeURIComponent('https://example.com/article')}:0:${encodeURIComponent('default')}`);
    });

    it('should handle complex URLs and different index values', () => {
        const articleUrl = 'https://example.com/path/to/article?param1=value1&param2=value2#hash';
        const chunkIndex = 999;
        const voiceModel = 'ja-JP-Standard-A';

        const result = generateKey(articleUrl, chunkIndex, voiceModel);

        expect(result).toBe(`${encodeURIComponent('https://example.com/path/to/article?param1=value1&param2=value2#hash')}:999:${encodeURIComponent('ja-JP-Standard-A')}`);
    });
});

describe('IndexedDB write transactions', () => {
    afterEach(() => {
        jest.resetModules();
        // @ts-ignore
        delete global.indexedDB;
    });

    it('saveAudioChunk should resolve only after the write transaction completes', async () => {
        const mock = createIndexedDBMock();
        const { saveAudioChunk } = await import('../indexedDB');
        const entry = {
            audioData: new Blob(['audio'], { type: 'audio/wav' }),
            timestamp: 123,
            articleUrl: 'https://example.com/article',
            chunkIndex: 0,
            totalChunks: 2,
            voiceModel: 'ja-JP-Test',
            size: 5,
        };

        let resolved = false;
        const promise = saveAudioChunk(entry).then(() => {
            resolved = true;
        });

        await openDatabase(mock);

        expect(mock.store.put).toHaveBeenCalledWith(expect.objectContaining({
            key: generateKey(entry.articleUrl, entry.chunkIndex, entry.voiceModel),
            articleUrl: entry.articleUrl,
        }));
        await Promise.resolve();
        expect(resolved).toBe(false);

        mock.transaction.oncomplete();

        await expect(promise).resolves.toBeUndefined();
        expect(resolved).toBe(true);
    });

    it('saveAudioChunk should reject when the put request fails', async () => {
        const mock = createIndexedDBMock();
        const { saveAudioChunk } = await import('../indexedDB');
        const error = new Error('put failed');
        const promise = saveAudioChunk({
            audioData: new Blob(['audio'], { type: 'audio/wav' }),
            timestamp: 123,
            articleUrl: 'https://example.com/article',
            chunkIndex: 0,
            totalChunks: 1,
            size: 5,
        });

        await openDatabase(mock);
        mock.putRequest.error = error;
        mock.putRequest.onerror();

        await expect(promise).rejects.toBe(error);
    });

    it('saveAudioChunk should reject with a fallback Error when the transaction abort has no error', async () => {
        const mock = createIndexedDBMock();
        const { saveAudioChunk } = await import('../indexedDB');
        const promise = saveAudioChunk({
            audioData: new Blob(['audio'], { type: 'audio/wav' }),
            timestamp: 123,
            articleUrl: 'https://example.com/article',
            chunkIndex: 0,
            totalChunks: 1,
            size: 5,
        });

        await openDatabase(mock);
        mock.transaction.error = null;
        mock.transaction.onabort();

        await expect(promise).rejects.toThrow('Save transaction aborted');
    });

    it('clearAll should resolve only after the clear transaction completes', async () => {
        const mock = createIndexedDBMock();
        const { clearAll } = await import('../indexedDB');

        let resolved = false;
        const promise = clearAll().then(() => {
            resolved = true;
        });

        await openDatabase(mock);

        expect(mock.store.clear).toHaveBeenCalledTimes(1);
        await Promise.resolve();
        expect(resolved).toBe(false);

        mock.transaction.oncomplete();

        await expect(promise).resolves.toBeUndefined();
        expect(resolved).toBe(true);
    });

    it('clearAll should reject when the clear transaction aborts', async () => {
        const mock = createIndexedDBMock();
        const { clearAll } = await import('../indexedDB');
        const error = new Error('transaction aborted');
        const promise = clearAll();

        await openDatabase(mock);
        mock.transaction.error = error;
        mock.transaction.onabort();

        await expect(promise).rejects.toBe(error);
    });

    it('clearAll should reject with a fallback Error when the transaction abort has no error', async () => {
        const mock = createIndexedDBMock();
        const { clearAll } = await import('../indexedDB');
        const promise = clearAll();

        await openDatabase(mock);
        mock.transaction.error = null;
        mock.transaction.onabort();

        await expect(promise).rejects.toThrow('Clear transaction aborted');
    });
});
