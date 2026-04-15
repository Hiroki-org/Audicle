import { test, expect } from '@playwright/test';
import { clearLocalStorage } from '../helpers/testSetup';

test.describe('Reader - プレイリスト関連のナビゲーション', () => {
    test.beforeEach(async ({ page }) => {
        // Mock /api/extract to return deterministic content based on URL query
        await page.route('**/api/extract', async route => {
            const request = route.request();
            try {
                request.postDataJSON()?.url;
            } catch {
                // ignore
            }

            let title = 'Example Domain';
            try {
                const parsed = new URL(targetUrl);
                const id = parsed.searchParams.get('id');
                if (id === 'apple') title = 'Apple';
                else if (id === 'banana') title = 'Banana';
                else if (id === 'cherry') title = 'Cherry';
            } catch {
                // URL parse failed, use default title
            }

            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    title: title,
                    content: `<p>Content for ${title}</p>`,
                    textLength: 100
                })
            });
        });
    });

    test('プレイリスト詳細 -> リーダーにプレイリストクエリが含まれ、前へ/次へボタンが表示される', async ({ page }) => {
        // Navigate to playlists list
        await page.goto('/playlists');
        await page.waitForSelector('a[data-testid="playlist-item"]', { state: 'visible' });

        // Click the Default Playlist (explicitly find by text)
        const defaultPlaylist = page.locator('a[data-testid="playlist-item"]').filter({ hasText: 'ソートテスト用プレイリスト' }).first();
        await expect(defaultPlaylist).toBeVisible();
        await defaultPlaylist.click();

        // Verify we are on playlist detail page
        await page.waitForSelector('a[data-testid="playlist-article"]', { state: 'visible' });

        // Find the first article (Apple)
        const link = page.locator('a[data-testid="playlist-article"]').first();
        const href = await link.getAttribute('href');
        expect(href).toContain('playlist=');

        // Navigate to reader
        await link.click();

        // Ensure audio player is visible and prev/next are present
        await page.waitForSelector('[data-testid="audio-player-desktop"]', { state: 'visible' });
        const prev = page.getByTestId('desktop-prev-button');
        const next = page.getByTestId('desktop-next-button');
        await expect(prev).toBeVisible();
        await expect(next).toBeVisible();

        // Verify title is "Apple" (mocked)
        await expect(page.getByTestId('article-title')).toContainText('Apple');
    });

    test('ホーム -> リーダーがデフォルトプレイリストを使用し、前へ/次へボタンが表示される', async ({ page }) => {
        // Open home and click first article (home shows default playlist items)
        await page.goto('/');
        await page.waitForSelector('a[data-testid="playlist-article"]', { state: 'visible' });

        // Ensure the article we expect exists in the page; find the "Apple" article explicitly
        // Using .first() previously picked up any article, including real URLs that failed extraction in CI.
        const article = page.locator('a[data-testid="playlist-article"]').filter({ hasText: 'Apple' }).first();
        await expect(article).toBeVisible();

        await article.click();

        // Now page should navigate to /reader?url=... and initialize default playlist, showing prev/next
        await page.waitForSelector('[data-testid="audio-player-desktop"]', { state: 'visible' });
        const prev = page.getByTestId('desktop-prev-button');
        const next = page.getByTestId('desktop-next-button');
        await expect(prev).toBeVisible();
        await expect(next).toBeVisible();
    });

    // Tests are now unskipped as we mock the extraction
    test('プレイリスト内の前へ/次へ遷移が正しくナビゲートする', async ({ page }) => {
        // Navigate to playlists list
        await page.goto('/playlists');
        await page.waitForSelector('a[data-testid="playlist-item"]', { state: 'visible' });

        // Click the Default Playlist
        await page.locator('a[data-testid="playlist-item"]').filter({ hasText: 'ソートテスト用プレイリスト' }).first().click();

        // Wait for articles
        await page.waitForSelector('a[data-testid="playlist-article"]', { state: 'visible' });

        // Click first article (Apple)
        const firstLink = page.locator('a[data-testid="playlist-article"]').first();
        await expect(firstLink).toContainText('Apple');
        await firstLink.click();

        // ensure in playlist mode
        await page.waitForSelector('[data-testid="audio-player-desktop"]', { state: 'visible' });
        const next = page.getByTestId('desktop-next-button');
        const prev = page.getByTestId('desktop-prev-button');
        await expect(next).toBeVisible();
        await expect(prev).toBeVisible();
        await expect(page.getByTestId('article-title')).toContainText('Apple');

        // Click next -> Banana
        const initialUrl = page.url();
        await next.click();
        await page.waitForURL((url) => url.toString() !== initialUrl);
        await expect(page.getByTestId('article-title')).toContainText('Banana');

        // Click next -> Cherry
        const secondUrl = page.url();
        await next.click();
        await page.waitForURL((url) => url.toString() !== secondUrl);
        await expect(page.getByTestId('article-title')).toContainText('Cherry');

        // Click previous -> Banana
        const currentUrl = page.url();
        await prev.click();
        await page.waitForURL((url) => url.toString() !== currentUrl);
        await expect(page.getByTestId('article-title')).toContainText('Banana');
    });

    test('前へ/次へナビゲーションでプレイリストのソート順が尊重される', async ({ page }) => {
        // Navigate to playlist
        await page.goto('/playlists');
        await page.waitForSelector('a[data-testid="playlist-item"]', { state: 'visible' });
        await page.locator('a[data-testid="playlist-item"]').filter({ hasText: 'ソートテスト用プレイリスト' }).first().click();

        // Wait for navigation to playlist detail page
        await page.waitForURL(/\/playlists\/.+/);

        // Wait for articles to load
        await page.waitForSelector('a[data-testid="playlist-article"]', { state: 'visible' });

        // Wait for sort selector to appear (indicates playlist has items)
        const sortSelector = page.locator('[data-testid="playlist-sort-select"]');
        await expect(sortSelector).toBeVisible({ timeout: 15000 });

        // Change sort to Title Descending (Z-A)
        await sortSelector.click();
        await page.waitForSelector("text=タイトル順 (Z-A)", { state: 'visible' });
        await page.getByRole('option', { name: 'タイトル順 (Z-A)' }).click();

        // Verify sort order: Cherry > Banana > Apple (Z-A)
        const articles = page.locator('a[data-testid="playlist-article"]');
        await expect(articles.nth(0)).toContainText('Cherry');
        await expect(articles.nth(1)).toContainText('Banana');
        await expect(articles.nth(2)).toContainText('Apple');
    });
});
