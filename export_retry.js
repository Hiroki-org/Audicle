const fs = require('fs');

const path = 'packages/web-app-vercel/lib/hooks/usePlaylists.ts';
let content = fs.readFileSync(path, 'utf8');

content = content.replace('async function retryFetch', 'export async function retryFetch');

fs.writeFileSync(path, content, 'utf8');
