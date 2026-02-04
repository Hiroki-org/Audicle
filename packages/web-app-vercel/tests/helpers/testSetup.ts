import { Page } from '@playwright/test';
import { STORAGE_KEYS } from '@/lib/constants';

/**
 * localStorageのみをクリアする（認証状態を保持）
 * ソート順などの設定をリセットしたい場合に使用
 */
export async function clearLocalStorage(page: Page) {
    try {
        // Ensure we are on the app origin so localStorage is accessible.
        // Using '/' relies on Playwright config baseURL.
        try {
            await page.goto('/');
            await page.waitForLoadState('load');
        } catch (e) {
            // If navigation fails for some reason (non-critical), continue and
            // try to clear localStorage from the current context.
            /* noop */
        }

        // Note: We intentionally do NOT clear cookies here to preserve auth session.
        // Use clearLocalStorageAndCookies if you need to clear everything.

        await page.evaluate(() => {
            localStorage.clear();
            try { sessionStorage.clear(); } catch (e) { /* ignore */ }
        });
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
        try {
            await page.goto('/');
            await page.waitForLoadState('load');
        } catch (e) {
            /* noop */
        }

        try {
            await page.context().clearCookies();
        } catch (e) {
            /* noop */
        }

        await page.evaluate(() => {
            localStorage.clear();
            try { sessionStorage.clear(); } catch (e) { /* ignore */ }
        });
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