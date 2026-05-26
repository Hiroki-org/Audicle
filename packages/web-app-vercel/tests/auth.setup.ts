import { test as setup } from '@playwright/test'
import fs from 'fs'

const authFile = 'playwright/.auth/user.json'

setup('authenticate', async ({ page }) => {
    // Stale local auth state can redirect every protected E2E page back to
    // /auth/signin. Always create a fresh state for deterministic runs.
    if (fs.existsSync(authFile)) {
        console.log('[AUTH SETUP] Removing existing auth state at', authFile)
        fs.rmSync(authFile, { force: true })
    }

    console.log('[AUTH SETUP] Creating new auth state...')

    // 診断ログ追加
    console.log('[SETUP DIAGNOSTIC] NODE_ENV:', process.env.NODE_ENV)
    console.log('[SETUP DIAGNOSTIC] TEST_USER_EMAIL:', process.env.TEST_USER_EMAIL)
    console.log('[SETUP DIAGNOSTIC] TEST_USER_PASSWORD:', process.env.TEST_USER_PASSWORD ? 'SET' : 'NOT SET')

    await page.goto('http://localhost:3000/auth/signin')

    // デバッグ: ページの状態を確認
    console.log('[AUTH SETUP] Current URL:', page.url())
    const pageContent = await page.content()
    console.log('[AUTH SETUP] Page title:', await page.title())
    console.log('[AUTH SETUP] Page content (first 2000 chars):', pageContent.substring(0, 2000))

    // スクリーンショットを保存（デバッグ用）
    await page.screenshot({ path: 'test-results/auth-signin-page.png', fullPage: true }).catch(e => {
        console.warn('[AUTH SETUP] Screenshot failed:', e)
    })

    // ネットワークリクエストを監視（ログインボタンクリックの前に設定）
    page.on('request', request => {
        if (request.url().includes('/api/auth')) {
            console.log('[AUTH SETUP] Auth API request:', request.method(), request.url())
        }
    })

    page.on('response', async response => {
        if (response.url().includes('/api/auth')) {
            console.log('[AUTH SETUP] Auth API response:', response.status(), response.url())
            const body = await response.text().catch(() => 'Could not read body')
            console.log('[AUTH SETUP] Response body:', body)
        }
    })

    // Credentials Providerのフォームを探す
    await page.waitForSelector('input[type="email"]', { timeout: 10000 })

    const email = process.env.TEST_USER_EMAIL || 'test@example.com';
    const password = process.env.TEST_USER_PASSWORD || 'password';

    console.log(`[AUTH SETUP] Attempting login with email: ${email}`);

    await page.fill('input[type="email"]', email)
    await page.fill('input[type="password"]', password)

    // ログインボタンをクリック
    const loginButton = page.getByRole('button', { name: 'ログイン', exact: true })
    await loginButton.click()

    // ログイン完了を待つ（トップページにリダイレクト）
    await page.waitForURL('/', { timeout: 45000 })

    // Clear localStorage to avoid stale popular-articles cache in storageState
    await page.evaluate(() => {
        try {
            localStorage.clear();
            sessionStorage.clear();
            console.log('[AUTH SETUP] Cleared localStorage and sessionStorage');
        } catch (e) {
            console.warn('[AUTH SETUP] localStorage clear failed', e);
        }
    });

    // 認証状態を保存
    await page.context().storageState({ path: authFile })
    console.log('[AUTH SETUP] Authentication state saved to', authFile)

    // 保存された内容を確認
    const saved = JSON.parse(fs.readFileSync(authFile, 'utf-8'))
    console.log('[AUTH SETUP] Saved cookies count:', saved.cookies?.length)
    console.log('[AUTH SETUP] Saved origins count:', saved.origins?.length)
})
