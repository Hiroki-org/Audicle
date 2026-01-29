import { Page } from '@playwright/test';
import { STORAGE_KEYS } from '@/lib/constants';

/**
 * localStorageをクリアする（ページ遷移後に呼び出す）
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

        // Also clear cookies in the context to avoid persisted auth/session
        // interfering with isolated tests.
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
        // localStorageアクセスできない場合は無視（デフォルト値が使われる）
        console.warn('localStorage clear failed:', error);
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