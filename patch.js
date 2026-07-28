const fs = require('fs');
const file = 'packages/web-app-vercel/components/ConfirmDialog.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  /import \{ useState, useCallback \} from "react";/,
  `import { useState, useCallback } from "react";\nimport { Button } from "@/components/ui/button";`
);

content = content.replace(
  /<button[\s\S]*?onClick=\{onCancel\}[\s\S]*?>[\s\S]*?\{cancelText\}[\s\S]*?<\/button>/,
  `<Button variant="secondary" onClick={onCancel}>\n            {cancelText}\n          </Button>`
);

content = content.replace(
  /<button[\s\S]*?onClick=\{onConfirm\}[\s\S]*?>[\s\S]*?\{confirmText\}[\s\S]*?<\/button>/,
  `<Button variant={isDangerous ? "destructive" : "default"} onClick={onConfirm}>\n            {confirmText}\n          </Button>`
);

fs.writeFileSync(file, content);
