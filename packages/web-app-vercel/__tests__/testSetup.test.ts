import { clearLocalStorage, clearLocalStorageAndCookies } from '../tests/helpers/testSetup';

function mockPage() {
    const clearCookies = jest.fn().mockResolvedValue(undefined);

    return {
        clearCookies,
        page: {
            goto: jest.fn().mockResolvedValue(undefined),
            waitForLoadState: jest.fn().mockResolvedValue(undefined),
            evaluate: jest.fn((fn: (..._args: unknown[]) => unknown, ...args: unknown[]) => fn(...args)),
            context: jest.fn(() => ({
                clearCookies,
            })),
        },
    };
}

function installBrowserStateMocks() {
    const localStorageMock = { clear: jest.fn(), setItem: jest.fn() };
    const sessionStorageMock = { clear: jest.fn() };
    const cachesMock = {
        delete: jest.fn().mockResolvedValue(true),
        keys: jest.fn().mockResolvedValue(['audicle-app-cache', 'audicle-audio-cache']),
    };
    const deleteDatabase = jest.fn(() => {
        const request: Partial<IDBOpenDBRequest> = {};
        queueMicrotask(() => request.onsuccess?.({} as Event));
        return request as IDBOpenDBRequest;
    });
    const indexedDBMock = {
        databases: jest.fn().mockResolvedValue([
            { name: 'audicle-audio-cache', version: 1 },
            { name: undefined, version: undefined },
        ]),
        deleteDatabase,
    };

    Object.defineProperty(globalThis, 'localStorage', {
        configurable: true,
        value: localStorageMock,
    });
    Object.defineProperty(globalThis, 'sessionStorage', {
        configurable: true,
        value: sessionStorageMock,
    });
    Object.defineProperty(globalThis, 'caches', {
        configurable: true,
        value: cachesMock,
    });
    Object.defineProperty(globalThis, 'indexedDB', {
        configurable: true,
        value: indexedDBMock,
    });

    return {
        cachesMock,
        deleteDatabase,
        indexedDBMock,
        localStorageMock,
        sessionStorageMock,
    };
}

describe('testSetup browser cleanup helpers', () => {
    beforeEach(() => {
        jest.restoreAllMocks();
    });

    it('clears storage, Cache Storage, and IndexedDB without clearing auth cookies', async () => {
        const state = installBrowserStateMocks();
        const { clearCookies, page } = mockPage();

        await clearLocalStorage(page as never);

        expect(page.goto).toHaveBeenCalledWith('/');
        expect(page.waitForLoadState).toHaveBeenCalledWith('load');
        expect(state.localStorageMock.clear).toHaveBeenCalledTimes(1);
        expect(state.sessionStorageMock.clear).toHaveBeenCalledTimes(1);
        expect(state.cachesMock.keys).toHaveBeenCalledTimes(1);
        expect(state.cachesMock.delete).toHaveBeenCalledWith('audicle-app-cache');
        expect(state.cachesMock.delete).toHaveBeenCalledWith('audicle-audio-cache');
        expect(state.indexedDBMock.databases).toHaveBeenCalledTimes(1);
        expect(state.deleteDatabase).toHaveBeenCalledWith('audicle-cache');
        expect(state.deleteDatabase).toHaveBeenCalledWith('audicle-audio-cache');
        expect(clearCookies).not.toHaveBeenCalled();
    });

    it('also clears cookies for unauthenticated browser reset', async () => {
        const state = installBrowserStateMocks();
        const { clearCookies, page } = mockPage();

        await clearLocalStorageAndCookies(page as never);

        expect(clearCookies).toHaveBeenCalledTimes(1);
        expect(state.localStorageMock.clear).toHaveBeenCalledTimes(1);
        expect(state.sessionStorageMock.clear).toHaveBeenCalledTimes(1);
        expect(state.cachesMock.delete).toHaveBeenCalledWith('audicle-app-cache');
        expect(state.deleteDatabase).toHaveBeenCalledWith('audicle-cache');
        expect(state.deleteDatabase).toHaveBeenCalledWith('audicle-audio-cache');
    });

    it('clears known IndexedDB cache names when database enumeration is unavailable', async () => {
        const state = installBrowserStateMocks();
        const { page } = mockPage();
        delete (state.indexedDBMock as { databases?: unknown }).databases;

        await clearLocalStorage(page as never);

        expect(state.deleteDatabase).toHaveBeenCalledWith('audicle-cache');
        expect(state.deleteDatabase).toHaveBeenCalledWith('audicle-audio-cache');
    });
});
