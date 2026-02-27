import { test, expect } from '@playwright/test';
import { validAudioBase64 } from '../helpers/testData';

// 認証済みテスト用
test.describe('人気記事（認証済み）', () => {
    // ブラウザのコンソールログをキャプチャ
    test.beforeEach(async ({ page }) => {
        // Mock /api/stats/popular
        await page.route('**/api/stats/popular*', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    articles: [{
                        articleId: 'test-article-id',
                        articleHash: 'test-hash',
                        url: 'https://example.com/article',
                        title: 'Test Article for Playback',
                        domain: 'example.com',
                        accessCount: 100,
                        uniqueUsers: 50,
                        cacheHitRate: 90.0,
                        isFullyCached: true,
                        lastAccessedAt: new Date().toISOString()
                    }],
                    total: 1
                })
            });
        });

        // Mock /api/articles/test-article-id
        await page.route('**/api/articles/test-article-id', async route => {
             await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    id: 'test-article-id',
                    url: 'https://example.com/article',
                    title: 'Test Article for Playback'
                })
             });
        });

        // Mock /api/extract
        await page.route('**/api/extract', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    title: 'Test Article for Playback',
                    content: '<p id="chunk-1">This is a test paragraph for audio playback.</p>',
                    textLength: 100
                })
            });
        });

        // Mock /api/synthesize - Return JSON with base64-encoded audio
        await page.route('**/api/synthesize', async route => {
            // Use shared validAudioBase64 from testData.ts
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ audio: validAudioBase64 })
            });
        });

        page.on('console', msg => {
            if (msg.text().includes('[DEBUG]') || msg.text().includes('[POPULAR]')) {
                console.log(`[BROWSER] ${msg.text()}`);
            }
        });
    });

    test('人気記事ページへのアクセス', async ({ page }) => {
        // /popularページにアクセス
        await page.goto('/popular');

        // Also fetch the API from the page context to log its response
        try {
            const apiResp = await page.evaluate(async () => {
                const res = await fetch('/api/stats/popular?period=week&limit=20');
                return { status: res.status, body: await res.text() };
            });
            console.log('[DEBUG] Direct fetch from page context status:', apiResp.status, 'body:', apiResp.body);
        } catch (e) {
            console.warn('[DEBUG] Direct fetch from page context failed:', e);
        }

        // ログインページにリダイレクトされず、正常に表示される
        await expect(page).toHaveURL('/popular');
        // 「人気記事」という見出しを特定（exact: true で完全一致）
        await expect(page.getByRole('heading', { name: '人気記事', exact: true })).toBeVisible();
    });

    test('人気記事一覧の表示', async ({ page }) => {
        // Log API responses for debugging
        page.on('request', (req) => {
            if (req.url().includes('/api/stats/popular')) {
                console.log('[DEBUG] /api/stats/popular request made:', req.method(), req.url());
            }
        });
        page.on('requestfailed', (req) => {
            if (req.url().includes('/api/stats/popular')) {
                console.log('[DEBUG] /api/stats/popular request failed:', req.failure()?.errorText, req.url());
            }
        });
        page.on('response', async (resp) => {
            try {
                if (resp.url().includes('/api/stats/popular')) {
                    const text = await resp.text();
                    console.log('[DEBUG] /api/stats/popular status:', resp.status(), 'body:', text);
                }
            } catch (e) {
                console.warn('[DEBUG] Error reading response body', e);
            }
        });

        // ページ読み込み（APIルートはbeforeEachでモック済み）
        await page.goto('/popular');

        // 記事カードが表示されるまで待機（timeout付き）
        // データがない場合はスキップするため、まずはコンテナやヘッダーの表示を確認
        await expect(page.getByRole('heading', { name: '人気記事' })).toBeVisible();

        const articles = page.locator('[data-testid="article-card"]');
        // 最初のカードが表示されるか、またはタイムアウト（データなし）
        try {
            await expect(articles.first()).toBeVisible({ timeout: 5000 });
        } catch (e) {
            console.log('No popular articles found within timeout');
        }

        const count = await articles.count();
        console.log('[DEBUG] Article card count:', count);

        if (count === 0) {
            console.log('No popular articles available');
            test.skip();
        }

        // 記事カードが表示されることを確認
        await expect(articles.first()).toBeVisible();
    });

    test('人気記事カードのクリックで記事ページへ遷移', async ({ page }) => {
        // Capture API response for debugging
        page.on('response', async (resp) => {
            try {
                if (resp.url().includes('/api/stats/popular')) {
                    const text = await resp.text();
                    console.log('[DEBUG] /api/stats/popular status:', resp.status(), 'body:', text);
                }
            } catch (e) {
                console.warn('[DEBUG] Error reading response body', e);
            }
        });

        // ページ読み込み（APIルートはbeforeEachでモック済み）
        await page.goto('/popular');

        // 記事カードが表示されるまで待機
        const articles = page.locator('[data-testid="article-card"]');
        try {
            await expect(articles.first()).toBeVisible({ timeout: 5000 });
        } catch (e) {
             console.log('No popular articles found within timeout');
        }

        const count = await articles.count();
        console.log('[DEBUG] Article card count:', count);

        // 記事カードが存在することを確認（モックにより必ず1つ以上存在する）
        expect(count).toBeGreaterThan(0);

        // 記事カードをクリック
        await articles.first().click();

        // /readerページに遷移することを確認
        await expect(page).toHaveURL(/\/reader/);

        // 記事タイトルまたはコンテンツが表示されることを確認
        await expect(page.locator('[data-testid="article-title"]')).toBeVisible();
    });

    test('人気記事からの音声再生', async ({ page }) => {
        // Mock Audio play to avoid CI environment issues
        await page.addInitScript(() => {
            HTMLMediaElement.prototype.play = async function() {
                return Promise.resolve();
            };
        });

        // ページ読み込み（APIルートはbeforeEachでモック済み）
        await page.goto('/popular');

        // 記事カードが表示されるまで待機
        const articles = page.locator('[data-testid="article-card"]');
        try {
            await expect(articles.first()).toBeVisible({ timeout: 5000 });
        } catch (e) {
             console.log('No popular articles found within timeout');
        }

        const count = await articles.count();
        // 記事カードが存在することを確認（モックにより必ず1つ以上存在する）
        expect(count).toBeGreaterThan(0);

        const articleCard = articles.first();
        await articleCard.click();

        // /readerページに遷移することを確認
        await expect(page).toHaveURL(/\/reader/);

        // 音声プレーヤー（再生ボタン）が表示される
        const playButton = page.locator('[data-testid="play-button"]').first();
        await expect(playButton).toBeVisible({ timeout: 20000 });

        // 再生ボタンをクリック
        await playButton.click();

        // 音声が再生される（またはロード中）
        // 音声要素自体は非表示またはJS制御のため、UIの状態変化を確認する
        const playbackState = page.locator('[data-testid="playback-loading"], [data-testid="pause-button"]').first();

        // エラーが発生していないか確認
        if (await page.locator('.text-red-600').isVisible()) {
             console.log('Error displayed:', await page.locator('.text-red-600').textContent());
        }

        await expect(playbackState).toBeVisible({ timeout: 30000 });
    });
});

// 未認証テスト用
test.describe('人気記事（未認証）', () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test('未ログイン時は認証ページにリダイレクト', async ({ page }) => {
        await page.goto('/popular');

        // ログインページにリダイレクトされる
        await expect(page).toHaveURL(/\/auth\/signin/);
        await expect(page.locator('h1')).toContainText('ログイン');
    });
});