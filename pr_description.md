🔒 Fix Unsanitized LocalStorage in Inline Script (XSS Risk)

🎯 **What:**
The inline script in `packages/web-app-vercel/app/layout.tsx` was vulnerable to Cross-Site Scripting (XSS) due to dynamic string interpolation of variables (`STORAGE_KEYS.COLOR_THEME` and `DEFAULT_SETTINGS.color_theme`) directly inside `dangerouslySetInnerHTML`.

⚠️ **Risk:**
If an attacker managed to manipulate the constants, they could escape the string literal context and inject arbitrary malicious JavaScript into the head of the document, which would be executed immediately upon page load. This poses a significant security risk as it bypasses standard React escaping mechanisms.

🛡️ **Solution:**
Replaced string interpolation inside `dangerouslySetInnerHTML` with a secure approach using HTML5 data attributes (`data-theme-key` and `data-default-theme`). The dynamically generated script now reads these values securely via `document.currentScript.getAttribute()`. This completely separates the dynamic data from the executable script context, effectively mitigating the XSS vector while preserving the immediate theme application to prevent FOUC (Flash of Unstyled Content).
