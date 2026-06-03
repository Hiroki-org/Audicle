💡 **What:**
Implemented network retry logic around `supabase.auth.admin.createUser` and `supabase.auth.admin.listUsers` in `packages/web-app-vercel/scripts/seed-test-data.ts`.

🎯 **Why:**
The GitHub Actions CI test suite was failing during the "テストデータ投入" (`seed-test-data`) job due to transient DNS and network errors (e.g., `getaddrinfo ENOTFOUND ohoaxvgkwnrljmxqrggo.supabase.co` or `fetch failed`). Supabase `supabase-js` returns these errors inside the `error` response object or throws them. The new implementation caches these errors and adds a 3-second delay between 3 retry attempts, ensuring transient failures won't break the CI pipeline.
