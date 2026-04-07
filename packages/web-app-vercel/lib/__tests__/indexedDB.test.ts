/** @jest-environment jsdom */
import { checkStorageCapacity, getStorageUsage, clearAll } from '../indexedDB';

// Setup fake-indexeddb
import 'fake-indexeddb/auto';
import { IDBKeyRange, IDBRequest } from 'fake-indexeddb';

// polyfill IDBKeyRange in global if needed
if (!global.IDBKeyRange) {
    global.IDBKeyRange = IDBKeyRange as any;
}

describe('Storage Capacity Functions', () => {
    let originalNavigator: any;

    beforeEach(async () => {
        originalNavigator = global.navigator;
        Object.defineProperty(global, 'navigator', {
            value: {
                storage: {
                    estimate: jest.fn()
                }
            },
            configurable: true
        });
        jest.clearAllMocks();

        // Clear DB state if it exists
        try {
            await clearAll();
        } catch (e) {
            // ignore if not created
        }
    });

    afterEach(() => {
        Object.defineProperty(global, 'navigator', {
            value: originalNavigator,
            configurable: true
        });
    });

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

        it('returns fallback from IndexedDB if navigator.storage is not available', async () => {
            // Remove storage entirely
            delete (global as any).navigator.storage;

            // When no articles are downloaded, total size is 0
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
