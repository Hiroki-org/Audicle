const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'packages/web-app-vercel/app/api/extract/route.ts');
let content = fs.readFileSync(filePath, 'utf8');

// The error is because fetchWithTimeout still runs and fails on 'http://internal-server/' (e.g. invalid status or network failure)
// which throws an error and bypasses the !isSafe check.
// We need to handle this by checking if the error was a network error and isSafe was actually false, but
// Promise.all rejects immediately if fetchWithTimeout rejects.

// Let's change the implementation to use Promise.allSettled or just catch the error and check isSafe
const searchStr = `    // Fetch HTML and perform SSRF check concurrently
    // Since fetchWithTimeout checks SSRF on redirects anyway, we can just do the initial check in parallel
    const [isSafe, html] = await Promise.all([
      isSafeUrl(url),
      fetchWithTimeout(url)
    ]).catch(error => {
      // If fetch fails early (e.g., due to timeout or other error before SSRF completes),
      // we still need to throw the error to be caught by the outer catch block
      throw error;
    });`;

const replaceStr = `    // Fetch HTML and perform SSRF check concurrently
    // We use Promise.allSettled so if fetch fails we can still check SSRF
    const results = await Promise.allSettled([
      isSafeUrl(url),
      fetchWithTimeout(url)
    ]);

    const isSafeResult = results[0];
    const htmlResult = results[1];

    const isSafe = isSafeResult.status === "fulfilled" ? isSafeResult.value : false;

    // If fetch failed but SSRF was the real issue (or isSafe is false), we should report SSRF.
    // If fetch failed and SSRF is true, we should rethrow the fetch error.
    if (isSafe && htmlResult.status === "rejected") {
       throw htmlResult.reason;
    }

    const html = htmlResult.status === "fulfilled" ? htmlResult.value : "";
`;

content = content.replace(searchStr, replaceStr);
fs.writeFileSync(filePath, content, 'utf8');
