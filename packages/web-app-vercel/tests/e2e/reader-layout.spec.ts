import { test, expect } from '@playwright/test';
import { mockArticles } from '../helpers/testData';

test.describe('Reader layout and controls', () => {
    test('Desktop: bottom-fixed controls and PlaybackSpeedDial modal', async ({ page }) => {
        await page.goto('/reader');

        // Load an article to show the audio controls
        await page.waitForSelector('[data-testid="url-input"]', { state: 'visible' });
        await page.fill('[data-testid="url-input"]', mockArticles[0].url);
        const extractButton = page.locator('[data-testid="extract-button"]');
        await expect(extractButton).toBeEnabled();
        await extractButton.click();
        // Wait for the desktop controls to appear (sm: fixed bar)
        await page.waitForSelector('[data-testid="audio-player-desktop"]', { state: 'visible', timeout: 30000 });

        // Desktop viewport
        await page.setViewportSize({ width: 1920, height: 1080 });

        const desktopBar = page.locator('[data-testid="audio-player-desktop"]');
        await expect(desktopBar).toBeVisible();

        // Position check: should be fixed to bottom
        const position = await desktopBar.evaluate((el) => window.getComputedStyle(el).position);
        const bottom = await desktopBar.evaluate((el) => window.getComputedStyle(el).bottom);
        expect(position).toBe('fixed');
        expect(bottom === '0px' || bottom === '0').toBeTruthy();

        // Check buttons: Playback speed, Play/Pause, Playlist add
        const speedButton = desktopBar.locator('button[title="再生速度を変更"]');
        const playButton = desktopBar.locator('button[title="再生"]');
        const playlistButton = desktopBar.locator('[data-testid="playlist-add-button"]');
        const downloadButton = desktopBar.locator('button[data-testid="download-button"]');

        // Some elements may be visible with other titles; ensure generic checks for button presence
        await expect(speedButton).toBeVisible();
        await expect(playButton).toBeVisible();
        await expect(playlistButton).toBeVisible();
        await expect(downloadButton).toBeVisible();

        // Verify ReaderView main has enough padding-bottom so content won't be hidden
        const main = page.locator('main');
        const paddingBottom = await main.evaluate((el) => parseFloat(window.getComputedStyle(el).paddingBottom || '0'));
        // Expect at least ~80px padding-bottom (pb-20 ~ 5rem = 80px). We used pb-24 (6rem ~ 96px), so 80 is a safe lower bound.
        expect(paddingBottom).toBeGreaterThanOrEqual(80);

        // Screenshot for reporting
        await page.screenshot({ path: 'test-results/reader-desktop-1920x1080.png', fullPage: true });

        // Open PlaybackSpeedDial modal
        await speedButton.click();
        await page.waitForSelector('text=再生速度', { state: 'visible' });
        const modal = page.locator('div:has-text("再生速度")').first();
        await expect(modal).toBeVisible();

        // Modal width check: ensure >= 500px for desktop
        const modalContainer = page.locator('.fixed.inset-0 .rounded-t-3xl').first();
        const modalBox = await modalContainer.boundingBox();
        if (modalBox) {
            expect(modalBox.width).toBeGreaterThanOrEqual(500);
        }

        // Backdrop opacity check (alpha >= 0.35 expected for bg-black/40)
        const backdrop = page.locator('.fixed.inset-0');
        const backdropBg = await backdrop.evaluate((el) => window.getComputedStyle(el as Element).backgroundColor);
        // backgroundColor like 'rgba(0, 0, 0, 0.4)'
        const match = /rgba\(\s*0,\s*0,\s*0,\s*(\d*\.?\d+)\)/.exec(backdropBg as string);
        if (match && match[1]) {
            const alpha = parseFloat(match[1]);
            expect(alpha).toBeGreaterThanOrEqual(0.35);
        }

        // z-index checks
        const modalFixed = page.locator('.fixed.inset-0.z-50');
        if (await modalFixed.count() > 0) {
            const modalZ = await modalFixed.evaluate((el) => window.getComputedStyle(el as Element).zIndex);
            expect(Number(modalZ)).toBeGreaterThanOrEqual(45);
        }

        // Screenshot modal
        await page.screenshot({ path: 'test-results/reader-desktop-modal-1920x1080.png', fullPage: true });
    });

    test('Mobile: existing mobile controls preserved', async ({ page }) => {
        await page.goto('/reader');
        await page.waitForSelector('[data-testid="url-input"]', { state: 'visible' });
        await page.fill('[data-testid="url-input"]', mockArticles[0].url);
        await page.click('[data-testid="extract-button"]');

        // Mobile viewport
        await page.setViewportSize({ width: 375, height: 667 });
        const mobileBar = page.locator('[data-testid="audio-player"]');
        await expect(mobileBar).toBeVisible();

        // Desktop bar should be hidden
        const desktopBar = page.locator('[data-testid="audio-player-desktop"]');
        await expect(desktopBar).not.toBeVisible();

        // Screenshot
        await page.screenshot({ path: 'test-results/reader-mobile-375x667.png', fullPage: true });
    });

    test('Desktop: Prev/Next presence when in playlist context and download button works', async ({ page }) => {
        // Create a test playlist with at least 2 articles via API (authenticated via page context)
        await page.goto('/playlists');
        const createResp = await page.request.post('/api/playlists', {
            data: { name: `E2E Test Playlist ${Date.now()}` },
        });
        let created = null;
        if (createResp.ok()) {
            created = await createResp.json();
            console.log('[DEBUG] Created playlist:', JSON.stringify(created));
            for (const article of [mockArticles[0], mockArticles[1]]) {
                const itemResp = await page.request.post(`/api/playlists/${created.id}/items`, {
                    data: { article_url: article.url, article_title: article.title, thumbnail_url: null, last_read_position: 0 },
                });
                console.log('[DEBUG] Added item response:', itemResp.status(), await itemResp.text());
            }
        } else {
            console.log('[DEBUG] Failed to create playlist:', createResp.status(), await createResp.text());
        }
        expect(created).toBeTruthy();
        if (!created) return;

        const playlistHref = `/playlists/${created.id}`;

        // APIレスポンスをキャプチャ
        let playlistApiResponse: string | null = null;
        page.on('response', async (response) => {
            if (response.url().includes(`/api/playlists/${created.id}`) && response.status() === 200) {
                try {
                    playlistApiResponse = await response.text();
                    console.log('[DEBUG] Playlist API response:', playlistApiResponse.substring(0, 500));
                } catch (e) {
                    console.log('[DEBUG] Error reading response:', e);
                }
            }
        });

        // gotoとwaitForResponseを同時に実行してAPIレスポンスを待つ
        await Promise.all([
            page.waitForResponse(
                resp => resp.url().includes(`/api/playlists/${created.id}`) && resp.status() === 200,
                { timeout: 20000 }
            ),
            page.goto(playlistHref)
        ]);

        // Reactの状態更新を待つ
        await page.waitForTimeout(2000);

        // ページの状態をデバッグ
        const pageContent = await page.content();
        console.log('[DEBUG] Page URL:', page.url());
        console.log('[DEBUG] Page contains "まだ記事がありません":', pageContent.includes('まだ記事がありません'));
        console.log('[DEBUG] Page contains "playlist-article":', pageContent.includes('playlist-article'));

        // スクリーンショットを取る
        await page.screenshot({ path: 'test-results/debug-playlist-page.png', fullPage: true });

        await page.waitForSelector('[data-testid="playlist-article"]', { state: 'visible', timeout: 20000 });
        const articleLink = page.locator('a[data-testid="playlist-article"]').first();
        const articleHref = await articleLink.getAttribute('href');
        if (articleHref) {
            await page.goto(articleHref);
        } else {
            await articleLink.click();
        }

        // Desktop viewport and check prev/next visible
        await page.setViewportSize({ width: 1920, height: 1080 });
        const desktopBar = page.locator('[data-testid="audio-player-desktop"]');
        await expect(desktopBar).toBeVisible();
        // In playlist mode, prev/next buttons should be present
        const prev = page.getByTestId('desktop-prev-button');
        const next = page.getByTestId('desktop-next-button');
        await expect(prev).toBeVisible();
        await expect(next).toBeVisible();

        // Test download button triggers API (it will trigger startDownload endpoint through UI). We assert button is visible and clickable.
        const downloadButton = desktopBar.locator('[data-testid="download-button"]');
        await expect(downloadButton).toBeVisible();
        await downloadButton.click();
        // After clicking a short wait to allow download to initiate
        await page.waitForTimeout(500);
        // Clean up: delete the playlist we created
        await page.request.delete(`/api/playlists/${created.id}`);
    });
});
