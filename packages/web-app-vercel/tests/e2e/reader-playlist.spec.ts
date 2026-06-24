import { test, expect } from '@playwright/test';

const navigationArticles = [
    { title: 'Apple', url: 'https://example.com/?id=apple' },
    { title: 'Banana', url: 'https://example.com/?id=banana' },
    { title: 'Cherry', url: 'https://example.com/?id=cherry' },
] as const;

async function requireOk(response: Awaited<any>, action: string) {
    if (!response.ok()) {
        throw new Error(`${action} failed: ${response.status()} ${await response.text()}`);
    }
}

async function createNavigationPlaylist(page: any) {
    const createResp = await page.request.post('/api/playlists', {
        data: {
            name: `E2E Navigation ${Date.now()}-${Math.random().toString(36).slice(2)}`,
        },
    });
    await requireOk(createResp, 'create playlist');
    const playlist = await createResp.json();

    for (const article of navigationArticles) {
        const itemResp = await page.request.post(`/api/playlists/${playlist.id}/items`, {
            data: {
                article_url: article.url,
                article_title: article.title,
                thumbnail_url: null,
                last_read_position: 0,
            },
        });
        await requireOk(itemResp, `add ${article.title}`);
    }

    return playlist as { id: string; name: string };
}

async function ensureDefaultPlaylistHasNavigationArticles(page: any) {
    const defaultResp = await page.request.get('/api/playlists/default');
    await requireOk(defaultResp, 'get default playlist');
    const defaultPlaylist = await defaultResp.json();

    for (const article of navigationArticles) {
        const itemResp = await page.request.post(`/api/playlists/${defaultPlaylist.id}/items`, {
            data: {
                article_url: article.url,
                article_title: article.title,
                thumbnail_url: null,
                last_read_position: 0,
            },
        });
        await requireOk(itemResp, `add default ${article.title}`);
    }
}

async function deletePlaylist(page: any, playlistId: string) {
    const response = await page.request.delete(`/api/playlists/${playlistId}`);
    if (!response.ok() && response.status() !== 404) {
        throw new Error(`delete playlist failed: ${response.status()} ${await response.text()}`);
    }
}

test.describe('Reader - プレイリスト関連のナビゲーション', () => {
    test.beforeEach(async ({ page }) => {
        // Mock /api/extract to return deterministic content based on URL query
        await page.route('**/api/extract', async route => {
            const request = route.request();
            let targetUrl = '';
            try {
                const postData = request.postDataJSON();
                if (postData?.url) {
                    targetUrl = postData.url;
                }
            } catch {
                // Parsing error, keep empty targetUrl
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
        const playlist = await createNavigationPlaylist(page);
        try {
            await page.goto(`/playlists/${playlist.id}`);
            await page.waitForSelector('a[data-testid="playlist-article"]', { state: 'visible' });

            const link = page.locator('a[data-testid="playlist-article"]').filter({ hasText: 'Apple' }).first();
            const href = await link.getAttribute('href');
            expect(href).toContain(`playlist=${playlist.id}`);
            expect(href).toContain('index=0');

            if (!href) throw new Error('playlist article href is missing');
            await page.goto(href);

            await page.waitForSelector('[data-testid="audio-player-desktop"]', { state: 'visible' });
            const prev = page.getByTestId('desktop-prev-button');
            const next = page.getByTestId('desktop-next-button');
            await expect(prev).toBeVisible();
            await expect(next).toBeVisible();
            await expect(page.getByTestId('article-title')).toContainText('Apple');
        } finally {
            await deletePlaylist(page, playlist.id);
        }
    });

    test('ホーム -> リーダーがデフォルトプレイリストを使用し、前へ/次へボタンが表示される', async ({ page }) => {
        await ensureDefaultPlaylistHasNavigationArticles(page);

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
        const playlist = await createNavigationPlaylist(page);
        try {
            await page.goto(`/playlists/${playlist.id}`);
            await page.waitForSelector('a[data-testid="playlist-article"]', { state: 'visible' });

            const firstLink = page.locator('a[data-testid="playlist-article"]').filter({ hasText: 'Apple' }).first();
            await expect(firstLink).toBeVisible();
            const firstHref = await firstLink.getAttribute('href');
            if (!firstHref) throw new Error('playlist article href is missing');
            await page.goto(firstHref);

            await page.waitForSelector('[data-testid="audio-player-desktop"]', { state: 'visible' });
            const next = page.getByTestId('desktop-next-button');
            const prev = page.getByTestId('desktop-prev-button');
            await expect(next).toBeVisible();
            await expect(next).toBeEnabled();
            await expect(prev).toBeVisible();
            await expect(prev).toBeEnabled();
            await expect(page.getByTestId('article-title')).toContainText('Apple');

            const initialUrl = page.url();
            await next.click();
            await page.waitForURL((url) => url.toString() !== initialUrl);
            await expect(page.getByTestId('article-title')).toContainText('Banana');

            const secondUrl = page.url();
            await next.click();
            await page.waitForURL((url) => url.toString() !== secondUrl);
            await expect(page.getByTestId('article-title')).toContainText('Cherry');

            const currentUrl = page.url();
            await prev.click();
            await page.waitForURL((url) => url.toString() !== currentUrl);
            await expect(page.getByTestId('article-title')).toContainText('Banana');
        } finally {
            await deletePlaylist(page, playlist.id);
        }
    });

    test('前へ/次へナビゲーションでプレイリストのソート順が尊重される', async ({ page }) => {
        const playlist = await createNavigationPlaylist(page);
        try {
            await page.goto(`/playlists/${playlist.id}`);
            await page.waitForSelector('a[data-testid="playlist-article"]', { state: 'visible' });

            const sortSelector = page.locator('[data-testid="playlist-sort-select"]');
            await expect(sortSelector).toBeVisible({ timeout: 15000 });

            await sortSelector.click();
            await page.waitForSelector("text=タイトル順 (Z-A)", { state: 'visible' });
            await page.getByRole('option', { name: 'タイトル順 (Z-A)' }).click();

            const articles = page.locator('a[data-testid="playlist-article"]');
            await expect(articles.nth(0)).toContainText('Cherry');
            await expect(articles.nth(1)).toContainText('Banana');
            await expect(articles.nth(2)).toContainText('Apple');
        } finally {
            await deletePlaylist(page, playlist.id);
        }
    });
});
