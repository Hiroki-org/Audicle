import { defineConfig, devices } from '@playwright/test'
import dotenv from 'dotenv'
import path from 'path'

// .env.localを読み込む（アプリ用の環境変数）
dotenv.config({ path: path.resolve(__dirname, '.env.local') })

// .env.test.localを読み込む（テスト専用の環境変数，優先される）
dotenv.config({ path: path.resolve(__dirname, '.env.test.local') })

console.log('[PLAYWRIGHT CONFIG] Loading config...');
console.log('[PLAYWRIGHT CONFIG] NEXT_PUBLIC_SUPABASE_URL exists:', !!process.env.NEXT_PUBLIC_SUPABASE_URL);
console.log('[PLAYWRIGHT CONFIG] TEST_USER_EMAIL exists:', !!process.env.TEST_USER_EMAIL);

export default defineConfig({
    testDir: './tests',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : undefined,
    reporter: 'html',
    timeout: 120000,
    expect: { timeout: 30000 },
    use: {
        baseURL: 'http://localhost:3000',
        trace: 'on-first-retry',
        // storageStateはここから削除
    },
    projects: [
        // 認証セットアップ（最初に実行）
        {
            name: 'setup',
            testMatch: /.*\.setup\.ts/,
            use: {
                baseURL: 'http://localhost:3000',
            },
        },

        // テスト実行（setupの後に実行）
        {
            name: 'chromium',
            use: {
                ...devices['Desktop Chrome'],
                storageState: 'playwright/.auth/user.json', // ここに移動
                // Enable autoplay without user gesture for audio playback tests
                launchOptions: {
                    args: ['--autoplay-policy=no-user-gesture-required'],
                },
            },
            dependencies: ['setup'],
        },
        // Firefox project: same settings as Chromium but using Desktop Firefox
        {
            name: 'firefox',
            use: {
                ...devices['Desktop Firefox'],
                storageState: 'playwright/.auth/user.json',
                // Firefox doesn't require special autoplay flags in Playwright
            },
            dependencies: ['setup'],
        },
        // Theme FOUC test project (no auth required)
        {
            name: 'theme-fouc',
            testMatch: /theme-fouc\.spec\.ts/,
            use: { ...devices['Desktop Chrome'] },
        },
    ],
    webServer: {
        command: process.env.CI_WEB_SERVER_COMMAND || 'AUTH_ENV=test npm run dev',
        url: 'http://localhost:3000',
        reuseExistingServer: !process.env.CI,
        // Increase timeout to allow the Next.js dev server (and turbopack) to
        // finish compilation and bind to the port in CI environments.
        // 5 minutes gives the build enough time for cold-starts.
        timeout: 300000,
        // Provide runtime environment variables to the Next.js dev server when Playwright starts it
        env: {
            NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
            NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
            NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
            NEXTAUTH_URL: process.env.NEXTAUTH_URL || 'http://localhost:3000',
            AUTH_ENV: process.env.AUTH_ENV,
            // Ensure TEST_USER_EMAIL has a fallback to match auth.setup.ts and lib/auth.ts
            TEST_USER_EMAIL: process.env.TEST_USER_EMAIL || 'test@example.com',
            TEST_USER_PASSWORD: process.env.TEST_USER_PASSWORD || 'password',
            // Expose CI and test helpers to the Next.js dev server started by Playwright
            CI: process.env.CI || '',
            TEST_SESSION_TOKEN: process.env.TEST_SESSION_TOKEN || '',
            // Provide a default EMAIL_HASH_SECRET for local/test runs to avoid "must be set" errors.
            EMAIL_HASH_SECRET: process.env.EMAIL_HASH_SECRET || 'test-secret-for-playwright',
            // R2 and KV environment variables for storage and metadata
            R2_ACCOUNT_ID: process.env.R2_ACCOUNT_ID || '',
            R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID || '',
            R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY || '',
            R2_BUCKET_NAME: process.env.R2_BUCKET_NAME || '',
            KV_REST_API_URL: process.env.KV_REST_API_URL || '',
            KV_REST_API_TOKEN: process.env.KV_REST_API_TOKEN || '',
            STORAGE_PROVIDER: process.env.STORAGE_PROVIDER || 'r2',
        },
    },
})
