const fs = require('fs');
const path = require('path');

const filePath = path.join('packages', 'web-app-vercel', 'components', 'PlaylistItemRow.tsx');
let content = fs.readFileSync(filePath, 'utf8');

content = '"use client";\n\n' + content;

fs.writeFileSync(filePath, content, 'utf8');
console.log('Added use client directive');
