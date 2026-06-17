🎯 **What:** The code health issue addressed
Modified `packages/web-app/lib/logger.ts` to suppress `console.log` and other log outputs in non-development environments by checking `process.env.NODE_ENV === "development"`.

💡 **Why:** How this improves maintainability
Directly using `console.log` without environment checks leads to unintended logs in production, which can expose sensitive data or clutter the user's console. Centralizing this check in the logger utility ensures that no logging statements run in production while keeping development logs intact.

✅ **Verification:** How you confirmed the change is safe
- Verified `process.env.NODE_ENV === "development"` works correctly in the app by checking the `next.config.ts`.
- Ran the full test suite (`npm run test`) and confirmed that tests pass correctly.
- Ran lint checks (`npm run lint`) and confirmed no new lint issues were introduced.

✨ **Result:** The improvement achieved
Log outputs are safely disabled in production environments without needing to modify callsites across the entire codebase. This keeps the codebase cleaner, improves performance slightly, and prevents production information leaks.
