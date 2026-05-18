import { test, expect } from '@playwright/test'

const THEME_STORAGE_KEY = 'audicle-color-theme'
const THEMES = ['ocean', 'purple', 'forest', 'rose', 'orange'] as const
const COLOR_MAP: Record<string, string> = {
    ocean: 'hsl(199 89% 48%)',
    purple: 'hsl(262 83% 58%)',
    forest: 'hsl(142 76% 36%)',
    rose: 'hsl(346 77% 50%)',
    orange: 'hsl(25 95% 53%)',
}

test.describe('Theme FOUC prevention', () => {
    test.beforeEach(async ({ page }) => {
        // No-op: keep default context handling. We'll create unauthenticated contexts per-test.
    })

    test('Guest: localStorage theme is applied before hydration', async ({ browser }) => {
        const theme = 'purple'
        const ctx = await browser.newContext()
        await ctx.addInitScript({ content: `localStorage.setItem('${THEME_STORAGE_KEY}', '${theme}')` })
        const p = await ctx.newPage()
        p.on('console', msg => console.log('PAGE LOG:', msg.type(), msg.text()))
        await p.goto('/', { waitUntil: 'domcontentloaded' })

        const stored = await p.evaluate((k) => localStorage.getItem(k), THEME_STORAGE_KEY)
        console.log('stored localStorage theme', stored)

        const headHtml = await p.evaluate(() => document.head.innerHTML)
        console.log('head innerHTML snippet', headHtml.slice(0, 400))

        const domTheme = await p.evaluate(() => document.documentElement.getAttribute('data-theme'))
        expect(domTheme).toBe(theme)

        const computedPrimary = await p.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--color-primary'))
        expect(computedPrimary.trim()).toBe(COLOR_MAP[theme])
        await ctx.close()
    })

    test.describe('Themes mapping', () => {
        for (const theme of THEMES) {
            test(`Guest: ${theme} applied on reload`, async ({ browser }) => {
                const ctx = await browser.newContext()
                await ctx.addInitScript({ content: `localStorage.setItem('${THEME_STORAGE_KEY}', '${theme}')` })
                const p = await ctx.newPage()
                p.on('console', msg => console.log('PAGE LOG:', msg.type(), msg.text()))
                await p.goto('/', { waitUntil: 'domcontentloaded' })

                const domTheme = await p.evaluate(() => document.documentElement.getAttribute('data-theme'))
                expect(domTheme).toBe(theme)

                const computedPrimary = await p.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--color-primary'))
                expect(computedPrimary.trim()).toBe(COLOR_MAP[theme])
                await ctx.close()
            })
        }
    })

    test('Guest: dark mode is applied along with theme', async ({ browser }) => {
        const theme = 'forest'
        const ctx = await browser.newContext({ colorScheme: 'dark' })
        await ctx.addInitScript({ content: `localStorage.setItem('${THEME_STORAGE_KEY}', '${theme}')` })
        const p = await ctx.newPage()
        p.on('console', msg => console.log('PAGE LOG:', msg.type(), msg.text()))
        await p.setDefaultNavigationTimeout(45000)
        await p.goto('/', { waitUntil: 'domcontentloaded' })

        const domTheme = await p.evaluate(() => document.documentElement.getAttribute('data-theme'))
        const isDark = await p.evaluate(() => document.documentElement.classList.contains('dark'))
        expect(domTheme).toBe(theme)
        expect(isDark).toBe(true)

        const computedPrimary = await p.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--color-primary'))
        expect(computedPrimary.trim()).toBe(COLOR_MAP[theme])
        await ctx.close()
    })

    test('Guest: default ocean when localStorage not set', async ({ browser }) => {
        // No theme in localStorage
        const ctx = await browser.newContext()
        const p = await ctx.newPage()
        p.on('console', msg => console.log('PAGE LOG:', msg.type(), msg.text()))
        await p.goto('/', { waitUntil: 'domcontentloaded' })

        const domTheme = await p.evaluate(() => document.documentElement.getAttribute('data-theme'))
        expect(domTheme).toBe('ocean')
        await ctx.close()
    })
})

export { }
