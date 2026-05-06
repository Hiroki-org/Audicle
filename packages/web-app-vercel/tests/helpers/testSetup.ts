import type { Page } from '@playwright/test';
import { STORAGE_KEYS } from '@/lib/constants';

async function openAppOrigin(page: Page) {
    try {
        await page.goto('/');
        await page.waitForLoadState('load');
    } catch {
        // If navigation fails for some reason, continue and try to clear state
        // from the current origin.
        /* noop */
    }
}

async function clearBrowserState(page: Page) {
    await page.evaluate(async () => {
        try { localStorage.clear(); } catch { /* ignore */ }
        try { sessionStorage.clear(); } catch { /* ignore */ }

        try {
            if ('caches' in window) {
                const cacheNames = await caches.keys();
                await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));
            }
        } catch {
            /* ignore */
        }

        try {
            if ('indexedDB' in window) {
                const databaseNames = new Set(['audicle-cache', 'audicle-audio-cache']);

                if (typeof indexedDB.databases === 'function') {
                    const databases = await indexedDB.databases();
                    databases.forEach((database) => {
                        if (database.name) {
                            databaseNames.add(database.name);
                        }
                    });
                }

                await Promise.all([...databaseNames].map((name) => new Promise<void>((resolve) => {
                    const request = indexedDB.deleteDatabase(name);
                    request.onsuccess = () => resolve();
                    request.onerror = () => resolve();
                    request.onblocked = () => resolve();
                })));
            }
        } catch {
            /* ignore */
        }
    });
}

/**
 * ブラウザ内のテスト状態をクリアする（認証Cookieは保持）
 * ソート順などの設定をリセットしたい場合に使用
 */
export async function clearLocalStorage(page: Page) {
    try {
        await openAppOrigin(page);

        // Note: We intentionally do NOT clear cookies here to preserve auth session.
        // Use clearLocalStorageAndCookies if you need to clear everything.
        await clearBrowserState(page);
    } catch (error) {
        // localStorageアクセスできない場合は無視（デフォルト値が使われる）
        console.warn('localStorage clear failed:', error);
    }
}

/**
 * localStorageとCookiesを両方クリアする（完全にリセット）
 * 認証状態もクリアされるため、未認証状態でのテストに使用
 */
export async function clearLocalStorageAndCookies(page: Page) {
    try {
        await openAppOrigin(page);

        try {
            await page.context().clearCookies();
        } catch {
            /* noop */
        }

        await clearBrowserState(page);
    } catch (error) {
        console.warn('localStorage/cookies clear failed:', error);
    }
}

/**
 * デフォルトのソート順を設定（position昇順）
 */
export async function setDefaultSort(page: Page) {
    await page.evaluate((key) => {
        localStorage.setItem(key, 'newest');
    }, STORAGE_KEYS.HOME_SORT);
}
