/** @jest-environment jsdom */
import { checkStorageCapacity, getStorageUsage } from '../indexedDB';

describe('Storage Capacity Functions', () => {
    let originalNavigator: any;

    beforeEach(() => {
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
