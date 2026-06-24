import { TextToSpeechClient, protos } from '@google-cloud/text-to-speech';
import { GoogleError } from 'google-gax';
import fs from 'fs';
import { removeSeparatorCharacters } from '@/lib/textCleaner';
import { parseTTSError, TTSError } from './ttsError';

// Google Cloud TTS APIの最大リクエストバイト数
export const MAX_TTS_BYTES = 5000;

export function getLanguageCode(voiceModel: string): string {
    const match = voiceModel.match(/^([a-z]{2}-[A-Z]{2})/);
    return match ? match[1] : 'ja-JP';
}

// Google Cloud TTS クライアント
let ttsCLient: TextToSpeechClient | null = null;

export function getTTSClient(): TextToSpeechClient | null {
    if (ttsCLient) {
        return ttsCLient;
    }

    // try common env var first (standard for Google client libraries)
    const googleKeyFileEnv = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    if (googleKeyFileEnv && fs.existsSync(googleKeyFileEnv)) {
        ttsCLient = new TextToSpeechClient({ keyFilename: googleKeyFileEnv });
        return ttsCLient;
    }

    const credentialsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
    if (!credentialsJson) {
        // In test environments or CI, return null to allow fallback behavior
        // (the caller will synthesize a dummy buffer).
        if (process.env.NODE_ENV !== 'production' || process.env.CI === 'true' || process.env.TEST_SESSION_TOKEN) {
            return null;
        }
        throw new Error('GOOGLE_APPLICATION_CREDENTIALS_JSON environment variable is not set');
    }

    // Try parsing the env var as JSON, but be tolerant of base64-encoded or
    // file-path variants. This helps when people paste multi-line JSON into
    // env files; we prefer single-line JSON, but fall back to base64.

    const tryParseJson = (s: string): unknown | null => {
        try {
            return JSON.parse(s);
        } catch (e) {
            void e;
            return null;
        }
    };

    // 1) If plain JSON — try raw first
    let credentials = tryParseJson(credentialsJson);

    // 1b) If it looks like a quoted string from a .env that escaped newlines
    // (e.g., "{\n  \"type\": ...\n}"), unescape and try again
    if (!credentials) {
        try {
            const unescaped = credentialsJson.replace(/\\n/g, '\n').replace(/^"|"$/g, '');
            credentials = tryParseJson(unescaped);
        } catch (_) { void _; }
    }

    // 2) If base64 encoded JSON
    if (!credentials) {
        try {
            const decoded = Buffer.from(credentialsJson, 'base64').toString('utf8');
            credentials = tryParseJson(decoded);
        } catch {
            // ignore decode errors
        }
    }

    // 3) If it's a path to a JSON file (e.g., set by developer), prefer keyFilename
    if (!credentials) {
        try {
            const trimmed = credentialsJson.trim();
            if ((trimmed.startsWith('/') || trimmed.endsWith('.json') || trimmed.includes('.json')) && fs.existsSync(trimmed)) {
                ttsCLient = new TextToSpeechClient({ keyFilename: trimmed });
                return ttsCLient;
            }
        } catch (_e) {
            // ignore
            void _e;
            void _e;
        }
    }

    if (!credentials) {
        throw new Error('Failed to parse GOOGLE_APPLICATION_CREDENTIALS_JSON (expected JSON or base64-encoded JSON, or a path to a keyfile)');
    }

    // `credentials` is unknown type from tryParseJson; the TextToSpeechClient
    // expects a credential-like object. We'll pass it as `credentials` after a
    // best-effort cast.
    ttsCLient = new TextToSpeechClient({
        credentials: credentials as any,
    });
    return ttsCLient;
}

export async function synthesizeToBuffer(text: string, voice: string, speakingRate: number = 2.0): Promise<Buffer> {
    const client = getTTSClient();

    // Fallback for test environments without credentials
    if (!client) {
        // Return a minimal MP3 buffer (silence) for testing
        // This is a very small MP3 frame that represents silence
        const dummyMp3Buffer = Buffer.from([
            0xFF, 0xFB, 0x10, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        ]);
        return dummyMp3Buffer;
    }

    // テキストのバイトサイズをチェック
    const textByteSize = Buffer.byteLength(text, 'utf-8');
    if (textByteSize > MAX_TTS_BYTES) {
        console.error(`[TTS Error] Text exceeds maximum byte size: ${textByteSize} bytes (max: ${MAX_TTS_BYTES})`);
        throw new TTSError(
            `テキストが最大バイトサイズを超えています: ${textByteSize} bytes (最大: ${MAX_TTS_BYTES})`,
            'INVALID_ARGUMENT',
            400
        );
    }

    // TTS APIに送信する前にセパレータ文字を除去
    const cleanedText = removeSeparatorCharacters(text);
    const cleanedByteSize = Buffer.byteLength(cleanedText);
    if (cleanedByteSize > MAX_TTS_BYTES) {
        throw new TTSError(
            `テキストが最大バイトサイズを超えています: ${cleanedByteSize} bytes (最大: ${MAX_TTS_BYTES})`,
            'INVALID_ARGUMENT',
            400
        );
    }

    const synthesisInput: protos.google.cloud.texttospeech.v1.ISynthesisInput = {
        text: cleanedText,
    };

    const languageCode = getLanguageCode(voice);

    const voiceParams: protos.google.cloud.texttospeech.v1.IVoiceSelectionParams = {
        languageCode,
        name: voice || 'ja-JP-Neural2-B',
    };

    const audioConfig: protos.google.cloud.texttospeech.v1.IAudioConfig = {
        audioEncoding: protos.google.cloud.texttospeech.v1.AudioEncoding.MP3,
        speakingRate: speakingRate,
    };

    try {
        const [response] = await client.synthesizeSpeech({
            input: synthesisInput,
            voice: voiceParams,
            audioConfig: audioConfig,
        });

        const audioContent = response.audioContent;
        if (!audioContent) {
            throw new Error('No audio content in response');
        }

        return Buffer.isBuffer(audioContent) ? audioContent : Buffer.from(audioContent);
    } catch (synthError) {
        // 既にTTSErrorの場合はそのまま再スロー
        if (synthError instanceof TTSError) {
            throw synthError;
        }

        // エラー詳細をログに記録
        console.error('[TTS Error] Google Cloud TTS API error:', {
            error: synthError,
            errorType: synthError instanceof GoogleError ? 'GoogleError' : 'Unknown',
            code: synthError instanceof GoogleError ? synthError.code : undefined,
            message: synthError instanceof Error ? synthError.message : String(synthError),
            textLength: text.length,
            textByteSize,
            voice,
        });

        // エラーをパースして適切な情報を取得
        const errorInfo = parseTTSError(synthError);
        throw new TTSError(errorInfo.userMessage, errorInfo.errorType, errorInfo.statusCode);
    }
}
