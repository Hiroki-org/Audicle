💡 **What:**
Implemented a `withRetry` wrapper for all Supabase API calls (`.from`, `.rpc`, `.auth.admin`) in `packages/web-app-vercel/scripts/seed-test-data.ts`.

🎯 **Why:**
The GitHub Actions CI test suite was continuing to fail sporadically during the `seed-test-data` step due to transient DNS and network errors (e.g., `getaddrinfo ENOTFOUND ohoaxvgkwnrljmxqrggo.supabase.co` or `fetch failed`). The original fix only addressed authentication endpoints, but standard database queries also experience these connectivity drops. This implementation ensures a robust 3-retry attempt with a 3-second delay across all Supabase interactions, preventing intermittent pipeline failures.
