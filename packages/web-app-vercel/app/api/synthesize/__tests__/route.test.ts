// next/server import not used in tests

// Mocks for auth, kv, storage, cacheIndex, and Google TTS
jest.mock('@/lib/auth', () => ({
    auth: jest.fn()
}));

jest.mock('@/lib/kv', () => ({
    getKv: jest.fn()
}));

jest.mock('@/lib/storage', () => ({
    getStorageProvider: jest.fn()
}));

jest.mock('@/lib/db/cacheIndex', () => ({
    getCacheIndex: jest.fn(),
    addCachedChunk: jest.fn(),
    isCachedInIndex: jest.fn(() => false),
}));

// Mock google cloud text-to-speech
jest.mock('@google-cloud/text-to-speech', () => {
    return {
        TextToSpeechClient: jest.fn().mockImplementation(() => ({
            synthesizeSpeech: jest.fn().mockResolvedValue([{ audioContent: Buffer.from('fake-audio') }])
        })),
        protos: {
            google: {
                cloud: {
                    texttospeech: {
                        v1: {
                            AudioEncoding: { MP3: 'MP3' }
                        }
                    }
                }
            }
        }
    };
});

import { auth } from '@/lib/auth';
import { getKv } from '@/lib/kv';
import { getStorageProvider } from '@/lib/storage';

// Import the handler after mocks
import * as routeModule from '../route';

describe('/api/synthesize route', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON = JSON.stringify({ project_id: 'test' });
    });

    it('returns 400 if body missing text and chunks', async () => {
        (auth as jest.Mock).mockResolvedValue({ user: { email: 'user@example.com' } });

        const req: any = { json: async () => ({}), headers: { get: () => 'http://localhost' } };
        const res = await routeModule.POST(req as any);
        expect(res.status).toBe(400);
    });

    it('returns 401 when unauthenticated', async () => {
        (auth as jest.Mock).mockResolvedValue(null);

        const req: any = { json: async () => ({ text: 'hello' }), headers: { get: () => 'http://localhost' } };
        const res = await routeModule.POST(req as any);
        expect(res.status).toBe(401);
    });

    it('returns 200 and audioUrls for valid chunks', async () => {
        (auth as jest.Mock).mockResolvedValue({ user: { email: 'user@example.com' } });

        // storage provider mock
        (getStorageProvider as jest.Mock).mockReturnValue({
            headObject: jest.fn().mockResolvedValue({ exists: false }),
            uploadObject: jest.fn().mockResolvedValue('https://storage.example/audio.mp3'),
            generatePresignedGetUrl: jest.fn().mockResolvedValue('https://storage.example/audio.mp3')
        });

        (getKv as jest.Mock).mockResolvedValue(null);

        const req: any = {
            json: async () => ({ chunks: [{ text: 'hello world' }], voice: 'ja-JP' }), headers: { get: () => 'http://localhost' }
        };

        const res = await routeModule.POST(req as any);
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body).toHaveProperty('audioUrls');
        expect(Array.isArray(body.audioUrls)).toBe(true);
        expect(body.audioUrls.length).toBe(1);
        expect(body.audioUrls[0]).toBe('https://storage.example/audio.mp3');
    });

    it('supports base64-encoded GOOGLE_APPLICATION_CREDENTIALS_JSON', async () => {
        (auth as jest.Mock).mockResolvedValue({ user: { email: 'user@example.com' } });

        (getStorageProvider as jest.Mock).mockReturnValue({
            headObject: jest.fn().mockResolvedValue({ exists: false }),
            uploadObject: jest.fn().mockResolvedValue('https://storage.example/audio.mp3'),
            generatePresignedGetUrl: jest.fn().mockResolvedValue('https://storage.example/audio.mp3')
        });

        (getKv as jest.Mock).mockResolvedValue(null);

        // Set env var to base64 of JSON
        const json = JSON.stringify({ project_id: 'test-base64' });
        process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON = Buffer.from(json).toString('base64');

        const req: any = {
            json: async () => ({ chunks: [{ text: 'hello world' }], voice: 'ja-JP' }), headers: { get: () => 'http://localhost' }
        };

        const res = await routeModule.POST(req as any);
        expect(res.status).toBe(200);
    });

    it('supports path to keyfile in GOOGLE_APPLICATION_CREDENTIALS_JSON', async () => {
        (auth as jest.Mock).mockResolvedValue({ user: { email: 'user@example.com' } });

        (getStorageProvider as jest.Mock).mockReturnValue({
            headObject: jest.fn().mockResolvedValue({ exists: false }),
            uploadObject: jest.fn().mockResolvedValue('https://storage.example/audio.mp3'),
            generatePresignedGetUrl: jest.fn().mockResolvedValue('https://storage.example/audio.mp3')
        });

        (getKv as jest.Mock).mockResolvedValue(null);

        const tmp = require('os').tmpdir();
        const filepath = require('path').join(tmp, `audicle-test-credentials-${Date.now()}.json`);
        const fs = require('fs');
        fs.writeFileSync(filepath, JSON.stringify({ project_id: 'test-file' }));

        process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON = filepath;

        const req: any = {
            json: async () => ({ chunks: [{ text: 'hello world' }], voice: 'ja-JP' }), headers: { get: () => 'http://localhost' }
        };

        const res = await routeModule.POST(req as any);
        expect(res.status).toBe(200);

        fs.unlinkSync(filepath);
    });

    it('supports escaped JSON string (e.g., multiline env) in GOOGLE_APPLICATION_CREDENTIALS_JSON', async () => {
        (auth as jest.Mock).mockResolvedValue({ user: { email: 'user@example.com' } });

        (getStorageProvider as jest.Mock).mockReturnValue({
            headObject: jest.fn().mockResolvedValue({ exists: false }),
            uploadObject: jest.fn().mockResolvedValue('https://storage.example/audio.mp3'),
            generatePresignedGetUrl: jest.fn().mockResolvedValue('https://storage.example/audio.mp3')
        });

        (getKv as jest.Mock).mockResolvedValue(null);

        const json = JSON.stringify({ project_id: 'test-escaped' });
        // Simulate env var that has escaped newlines and wrapped with quotes as sometimes happens
        process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON = '"' + json.replace(/\n/g, '\\n') + '"';

        const req: any = {
            json: async () => ({ chunks: [{ text: 'hello world' }], voice: 'ja-JP' }), headers: { get: () => 'http://localhost' }
        };

        const res = await routeModule.POST(req as any);
        expect(res.status).toBe(200);
    });
});
