const fs = require('fs');

const content = fs.readFileSync('packages/web-app-vercel/app/reader/ReaderClient.tsx', 'utf8');
const lines = content.split('\n');

console.log(`ReaderClient.tsx: ${lines.length} lines`);
