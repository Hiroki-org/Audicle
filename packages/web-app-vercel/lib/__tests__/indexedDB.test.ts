/** @jest-environment jsdom */
import { checkStorageCapacity, getStorageUsage } from '../indexedDB';

describe('Storage Capacity Functions', () => {
    let originalStorage: any;
    let originalIndexedDB: any;

    beforeEach(() => {
        jest.clearAllMocks();
        originalStorage = global.navigator.storage;
        originalIndexedDB = global.indexedDB;
        Object.defineProperty(global.navigator, 'storage', {
            value: {
                estimate: jest.fn()
            },
            configurable: true
        });
    });

    afterEach(() => {
        Object.defineProperty(global.navigator, 'storage', {
            value: originalStorage,
            configurable: true
        });
        Object.defineProperty(global, 'indexedDB', {
            value: originalIndexedDB,
            configurable: true
        });
    });

    const createEmptyIndexedDBMock = () => {
        const getAllRequest: any = { result: [] };
        const store = {
            getAll: jest.fn(() => {
                queueMicrotask(() => getAllRequest.onsuccess?.({ target: getAllRequest } as any));
                return getAllRequest;
            })
        };
        const db = {
            transaction: jest.fn(() => ({
                objectStore: () => store
            }))
        };
        return {
            open: jest.fn(() => {
                const request: any = { result: db };
                queueMicrotask(() => request.onsuccess?.({ target: request } as any));
                return request;
            })
        };
    };

    describe('getStorageUsage', () => {
        it('returns used and available from navigator.storage.estimate if available', async () => {
            (global.navigator.storage.estimate as jest.Mock).mockResolvedValue({
                usage: 50,
                quota: 100
            });

            const result = await getStorageUsage();
            expect(result).toEqual({ used: 50, available: 100 });
            expect(global.navigator.storage.estimate).toHaveBeenCalledTimes(1);
        });

        it('falls back to IndexedDB usage when navigator.storage is unavailable', async () => {
            delete (global.navigator as any).storage;
            Object.defineProperty(global, 'indexedDB', {
                value: createEmptyIndexedDBMock(),
                configurable: true
            });

            const result = await getStorageUsage();
            expect(result).toEqual({ used: 0, available: Infinity });
        });
    });

    describe('checkStorageCapacity', () => {
        it('returns true when requiredSize plus used is less than available', async () => {
            (global.navigator.storage.estimate as jest.Mock).mockResolvedValue({
                usage: 50,
                quota: 100
            });

            const result = await checkStorageCapacity(40);
            expect(result).toBe(true);
        });

        it('returns false when requiredSize plus used is equal to available', async () => {
            (global.navigator.storage.estimate as jest.Mock).mockResolvedValue({
                usage: 50,
                quota: 100
            });

            const result = await checkStorageCapacity(50);
            expect(result).toBe(false);
        });

        it('returns false when requiredSize plus used is greater than available', async () => {
            (global.navigator.storage.estimate as jest.Mock).mockResolvedValue({
                usage: 50,
                quota: 100
            });

            const result = await checkStorageCapacity(60);
            expect(result).toBe(false);
        });
    });
});
