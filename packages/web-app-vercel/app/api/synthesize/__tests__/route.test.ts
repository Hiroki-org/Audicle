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

        const req: any = { json: async () => ({}) };
        const res = await routeModule.POST(req as any);
        expect(res.status).toBe(400);
    });

    it('returns 401 when unauthenticated', async () => {
        (auth as jest.Mock).mockResolvedValue(null);

        const req: any = { json: async () => ({ text: 'hello' }) };
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
            json: async () => ({ chunks: [{ text: 'hello world' }], voice: 'ja-JP' })
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
            json: async () => ({ chunks: [{ text: 'hello world' }], voice: 'ja-JP' })
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
            json: async () => ({ chunks: [{ text: 'hello world' }], voice: 'ja-JP' })
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
            json: async () => ({ chunks: [{ text: 'hello world' }], voice: 'ja-JP' })
        };

        const res = await routeModule.POST(req as any);
        expect(res.status).toBe(200);
    });

    describe('Text handling without separator removal', () => {
        beforeEach(() => {
            (auth as jest.Mock).mockResolvedValue({ user: { email: 'user@example.com' } });
            (getStorageProvider as jest.Mock).mockReturnValue({
                headObject: jest.fn().mockResolvedValue({ exists: false }),
                uploadObject: jest.fn().mockResolvedValue('https://storage.example/audio.mp3'),
                generatePresignedGetUrl: jest.fn().mockResolvedValue('https://storage.example/audio.mp3')
            });
            (getKv as jest.Mock).mockResolvedValue(null);
        });

        it('should pass text with separator characters directly to TTS without removal', async () => {
            const textWithSeparators = 'Step1: ========== 開始';
            const req: any = {
                json: async () => ({ chunks: [{ text: textWithSeparators }], voice: 'ja-JP' })
            };

            const res = await routeModule.POST(req as any);
            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.audioUrls).toBeDefined();
            expect(body.audioUrls.length).toBe(1);
        });

        it('should handle text with multiple consecutive dashes', async () => {
            const textWithDashes = '--- セクション ---';
            const req: any = {
                json: async () => ({ chunks: [{ text: textWithDashes }], voice: 'ja-JP' })
            };

            const res = await routeModule.POST(req as any);
            expect(res.status).toBe(200);
        });

        it('should handle text with consecutive equals signs', async () => {
            const textWithEquals = 'a==========b';
            const req: any = {
                json: async () => ({ chunks: [{ text: textWithEquals }], voice: 'ja-JP' })
            };

            const res = await routeModule.POST(req as any);
            expect(res.status).toBe(200);
        });

        it('should handle text with consecutive asterisks', async () => {
            const textWithAsterisks = '***強調***';
            const req: any = {
                json: async () => ({ chunks: [{ text: textWithAsterisks }], voice: 'ja-JP' })
            };

            const res = await routeModule.POST(req as any);
            expect(res.status).toBe(200);
        });

        it('should handle text with consecutive underscores', async () => {
            const textWithUnderscores = '___下線___';
            const req: any = {
                json: async () => ({ chunks: [{ text: textWithUnderscores }], voice: 'ja-JP' })
            };

            const res = await routeModule.POST(req as any);
            expect(res.status).toBe(200);
        });

        it('should handle text with consecutive hash signs', async () => {
            const textWithHashes = '###見出し###';
            const req: any = {
                json: async () => ({ chunks: [{ text: textWithHashes }], voice: 'ja-JP' })
            };

            const res = await routeModule.POST(req as any);
            expect(res.status).toBe(200);
        });

        it('should handle text with consecutive tildes', async () => {
            const textWithTildes = '~~~注意~~~';
            const req: any = {
                json: async () => ({ chunks: [{ text: textWithTildes }], voice: 'ja-JP' })
            };

            const res = await routeModule.POST(req as any);
            expect(res.status).toBe(200);
        });

        it('should handle text with mixed separator characters', async () => {
            const complexText = '=== 見出し === --- 本文 --- *** 強調 ***';
            const req: any = {
                json: async () => ({ chunks: [{ text: complexText }], voice: 'ja-JP' })
            };

            const res = await routeModule.POST(req as any);
            expect(res.status).toBe(200);
        });

        it('should handle markdown-style separators', async () => {
            const markdownText = '---\ntitle: Test\n---\n## Heading\n***bold***';
            const req: any = {
                json: async () => ({ chunks: [{ text: markdownText }], voice: 'ja-JP' })
            };

            const res = await routeModule.POST(req as any);
            expect(res.status).toBe(200);
        });

        it('should preserve separator characters in article URLs and metadata', async () => {
            const textWithSeparators = '====== 重要 ======';
            const req: any = {
                json: async () => ({ 
                    chunks: [{ text: textWithSeparators }], 
                    voice: 'ja-JP',
                    articleUrl: 'https://example.com/article-with-separators'
                })
            };

            const res = await routeModule.POST(req as any);
            expect(res.status).toBe(200);
        });
    });

    describe('Multiple chunks with various patterns', () => {
        beforeEach(() => {
            (auth as jest.Mock).mockResolvedValue({ user: { email: 'user@example.com' } });
            (getStorageProvider as jest.Mock).mockReturnValue({
                headObject: jest.fn().mockResolvedValue({ exists: false }),
                uploadObject: jest.fn().mockResolvedValue('https://storage.example/audio.mp3'),
                generatePresignedGetUrl: jest.fn().mockResolvedValue('https://storage.example/audio.mp3')
            });
            (getKv as jest.Mock).mockResolvedValue(null);
        });

        it('should handle multiple chunks with different separator patterns', async () => {
            const chunks = [
                { text: '=== Header ===' },
                { text: '--- Section ---' },
                { text: '*** Important ***' },
                { text: 'Normal text without separators' }
            ];
            const req: any = {
                json: async () => ({ chunks, voice: 'ja-JP' })
            };

            const res = await routeModule.POST(req as any);
            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.audioUrls.length).toBe(4);
        });

        it('should handle chunks with isSplitChunk flag', async () => {
            const chunks = [
                { text: 'First part', isSplitChunk: false },
                { text: 'Second part === with separator ===', isSplitChunk: true }
            ];
            const req: any = {
                json: async () => ({ chunks, voice: 'ja-JP' })
            };

            const res = await routeModule.POST(req as any);
            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.chunkMetadata).toBeDefined();
            expect(body.chunkMetadata[1].isSplitChunk).toBe(true);
        });
    });

    describe('Byte size validation with separator characters', () => {
        beforeEach(() => {
            (auth as jest.Mock).mockResolvedValue({ user: { email: 'user@example.com' } });
            (getStorageProvider as jest.Mock).mockReturnValue({
                headObject: jest.fn().mockResolvedValue({ exists: false }),
                uploadObject: jest.fn().mockResolvedValue('https://storage.example/audio.mp3'),
                generatePresignedGetUrl: jest.fn().mockResolvedValue('https://storage.example/audio.mp3')
            });
            (getKv as jest.Mock).mockResolvedValue(null);
        });

        it('should handle text with separators within byte size limit', async () => {
            // Create text with separators that's under 5000 bytes
            const textWithSeparators = '==== '.repeat(100) + '日本語テキスト';
            const byteSize = Buffer.byteLength(textWithSeparators, 'utf-8');
            expect(byteSize).toBeLessThan(5000);

            const req: any = {
                json: async () => ({ chunks: [{ text: textWithSeparators }], voice: 'ja-JP' })
            };

            const res = await routeModule.POST(req as any);
            expect(res.status).toBe(200);
        });
    });

    describe('Cache behavior with separator characters', () => {
        beforeEach(() => {
            (auth as jest.Mock).mockResolvedValue({ user: { email: 'user@example.com' } });
            (getKv as jest.Mock).mockResolvedValue(null);
        });

        it('should cache text with separator characters correctly', async () => {
            const textWithSeparators = '=== Cached Content ===';
            (getStorageProvider as jest.Mock).mockReturnValue({
                headObject: jest.fn().mockResolvedValue({ exists: false }),
                uploadObject: jest.fn().mockResolvedValue('https://storage.example/cached.mp3'),
                generatePresignedGetUrl: jest.fn().mockResolvedValue('https://storage.example/cached.mp3')
            });

            const req: any = {
                json: async () => ({ 
                    chunks: [{ text: textWithSeparators }], 
                    voice: 'ja-JP',
                    articleUrl: 'https://example.com/test'
                })
            };

            const res = await routeModule.POST(req as any);
            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.cacheStats).toBeDefined();
            expect(body.cacheStats.cacheMisses).toBe(1);
        });

        it('should retrieve cached text with separator characters', async () => {
            const textWithSeparators = '--- Separator Text ---';
            (getStorageProvider as jest.Mock).mockReturnValue({
                headObject: jest.fn().mockResolvedValue({ exists: true }),
                generatePresignedGetUrl: jest.fn().mockResolvedValue('https://storage.example/cached.mp3')
            });

            const req: any = {
                json: async () => ({ 
                    chunks: [{ text: textWithSeparators }], 
                    voice: 'ja-JP'
                })
            };

            const res = await routeModule.POST(req as any);
            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.cacheStats.cacheHits).toBe(1);
        });
    });

    describe('Speaking rate handling', () => {
        beforeEach(() => {
            (auth as jest.Mock).mockResolvedValue({ user: { email: 'user@example.com' } });
            (getStorageProvider as jest.Mock).mockReturnValue({
                headObject: jest.fn().mockResolvedValue({ exists: false }),
                uploadObject: jest.fn().mockResolvedValue('https://storage.example/audio.mp3'),
                generatePresignedGetUrl: jest.fn().mockResolvedValue('https://storage.example/audio.mp3')
            });
            (getKv as jest.Mock).mockResolvedValue(null);
        });

        it('should apply custom speaking rate', async () => {
            const req: any = {
                json: async () => ({ 
                    chunks: [{ text: 'Test with custom speed' }], 
                    voice: 'ja-JP',
                    speakingRate: 1.5
                })
            };

            const res = await routeModule.POST(req as any);
            expect(res.status).toBe(200);
        });

        it('should default to 1.0 speaking rate when not specified', async () => {
            const req: any = {
                json: async () => ({ 
                    chunks: [{ text: 'Test default speed' }], 
                    voice: 'ja-JP'
                })
            };

            const res = await routeModule.POST(req as any);
            expect(res.status).toBe(200);
        });
    });
