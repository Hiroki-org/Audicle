const fs = require('fs');

const payload = {
  branch_name: 'jules-10710077923693051495-930bf01c',
  title: '🔒 Security Fix: Remove debug endpoint that leaked environment variables',
  commit_message: '🔒 [Security Fix] Remove debug endpoint that leaked environment variables',
  description: `🎯 **What:** Removed the vulnerable \`/debug\` endpoint located at \`packages/web-app-vercel/app/debug/page.tsx\`.
⚠️ **Risk:** The endpoint was leaking sensitive environment variables to the client, such as \`NEXT_PUBLIC_DEBUG_MODE\`, \`NEXT_PUBLIC_ALLOWED_USERS_PREVIEW\`, \`NODE_ENV\`, and \`NEXT_PUBLIC_API_URL\`. This information disclosure could be exploited to gather internal details for further attacks.
🛡️ **Solution:** Completely deleted the debug directory and its associated files. Additionally, updated \`packages/web-app-vercel/middleware.ts\` to remove the route bypass for \`/debug\`, ensuring it is no longer reachable or implicitly accessible without authentication.`
};

fs.writeFileSync('payload.json', JSON.stringify(payload, null, 2));
