const fs = require('fs');
const file = 'packages/web-app-vercel/app/api/synthesize/route.ts';
let code = fs.readFileSync(file, 'utf8');

const loggerCode = `
// System-level logger for use outside the POST handler
const systemLog = (level: 'info' | 'warn' | 'error', message: string, data: Record<string, unknown> = {}) => {
    console[level](JSON.stringify({ level, message, ...data }));
};
`;

code = code.replace(
    '// Google Cloud TTS クライアント\nlet ttsCLient: TextToSpeechClient | null = null;',
    loggerCode + '\n// Google Cloud TTS クライアント\nlet ttsCLient: TextToSpeechClient | null = null;'
);

code = code.replace(
    "console.log('[INFO] GOOGLE_APPLICATION_CREDENTIALS used as keyFilename');",
    "systemLog('info', 'GOOGLE_APPLICATION_CREDENTIALS used as keyFilename');"
);

code = code.replace(
    "console.log('[INFO] GOOGLE_APPLICATION_CREDENTIALS_JSON not set, using fallback for test environment');",
    "systemLog('info', 'GOOGLE_APPLICATION_CREDENTIALS_JSON not set, using fallback for test environment');"
);

code = code.replace(
    "console.log('[INFO] GOOGLE_APPLICATION_CREDENTIALS_JSON was loaded from an escaped JSON string');",
    "systemLog('info', 'GOOGLE_APPLICATION_CREDENTIALS_JSON was loaded from an escaped JSON string');"
);

code = code.replace(
    "console.log('[INFO] GOOGLE_APPLICATION_CREDENTIALS_JSON was loaded from base64');",
    "systemLog('info', 'GOOGLE_APPLICATION_CREDENTIALS_JSON was loaded from base64');"
);

code = code.replace(
    "console.log('[INFO] GOOGLE_APPLICATION_CREDENTIALS_JSON used as keyFilename');",
    "systemLog('info', 'GOOGLE_APPLICATION_CREDENTIALS_JSON used as keyFilename');"
);

code = code.replace(
    "console.log('[INFO] Using fallback dummy audio buffer for test environment');",
    "systemLog('info', 'Using fallback dummy audio buffer for test environment');"
);

fs.writeFileSync(file, code);
