## 2024-05-18 - Prevented DB error leakage in API responses
**Vulnerability:** Supabase database error details (`error.message`) were directly returned to the client in the 500 error responses of `/api/stats/article` and `/api/stats/popular`.
**Learning:** Returning database error messages can leak details about the database structure and queries, which is a potential security risk.
**Prevention:** Ensured error responses return a generic message (`error: 'Failed to record stats'`) while logging the actual `error.message` on the server using `console.error`.
