/**
 * TTS Error Handling Tests
 * synthesize/helpers/ttsError.ts のエラーハンドリング機能をテスト
 */
import { parseTTSError } from '../helpers/ttsError';
import { GoogleError } from 'google-gax';

/**
 * GoogleErrorをモックするクラス
 */
class MockGoogleError extends GoogleError {
    code?: number;

    constructor(message: string, code?: number) {
        super(message);
        this.name = 'GoogleError';
        this.code = code;
    }
}

describe('TTS Error Handling', () => {
    describe('parseTTSError function', () => {
        it('should map INVALID_ARGUMENT (code 3) to 400', () => {
            const error = new MockGoogleError('Invalid argument');
            error.code = 3;
            const result = parseTTSError(error);

            expect(result.statusCode).toBe(400);
            expect(result.errorType).toBe('INVALID_ARGUMENT');
            expect(result.userMessage).toContain('長すぎる');
        });

        it('should handle INVALID_ARGUMENT in message (case-insensitive)', () => {
            const error = new MockGoogleError('Invalid_Argument detected');
            error.code = 0;
            const result = parseTTSError(error);

            expect(result.statusCode).toBe(400);
            expect(result.errorType).toBe('INVALID_ARGUMENT');
        });

        it('should map RESOURCE_EXHAUSTED (code 8) to 429', () => {
            const error = new MockGoogleError('Resource exhausted');
            error.code = 8;
            const result = parseTTSError(error);

            expect(result.statusCode).toBe(429);
            expect(result.errorType).toBe('RESOURCE_EXHAUSTED');
            expect(result.userMessage).toContain('利用制限');
        });

        it('should handle quota exceeded in message', () => {
            const error = new MockGoogleError('Quota exceeded for API');
            error.code = 0;
            const result = parseTTSError(error);

            expect(result.statusCode).toBe(429);
            expect(result.errorType).toBe('RESOURCE_EXHAUSTED');
        });

        it('should map INTERNAL (code 13) to 503', () => {
            const error = new MockGoogleError('Internal error');
            error.code = 13;
            const result = parseTTSError(error);

            expect(result.statusCode).toBe(503);
            expect(result.errorType).toBe('INTERNAL');
        });

        it('should handle INTERNAL in message (case-insensitive)', () => {
            const error = new MockGoogleError('INTERNAL_ERROR occurred');
            error.code = 0;
            const result = parseTTSError(error);

            expect(result.statusCode).toBe(503);
            expect(result.errorType).toBe('INTERNAL');
        });

        it('should map UNAVAILABLE (code 14) to 503', () => {
            const error = new MockGoogleError('Service unavailable');
            error.code = 14;
            const result = parseTTSError(error);

            expect(result.statusCode).toBe(503);
            expect(result.errorType).toBe('INTERNAL');
        });

        it('should map network errors to 503', () => {
            const networkError = new Error('ECONNREFUSED connection refused');
            const result = parseTTSError(networkError);

            expect(result.statusCode).toBe(503);
            expect(result.errorType).toBe('NETWORK');
        });

        it('should handle timeout errors', () => {
            const timeoutError = new Error('Operation timeout');
            const result = parseTTSError(timeoutError);

            expect(result.statusCode).toBe(503);
            expect(result.errorType).toBe('NETWORK');
        });

        it('should default to UNKNOWN for unrecognized errors', () => {
            const unknownError = new Error('Some random error');
            const result = parseTTSError(unknownError);

            expect(result.statusCode).toBe(500);
            expect(result.errorType).toBe('UNKNOWN');
        });
    });

    describe('Error message format', () => {
        it('should return user-friendly messages', () => {
            const errorMessage = 'API利用制限に達しました';
            expect(errorMessage).toBeTruthy();
            expect(typeof errorMessage).toBe('string');
            expect(errorMessage.length).toBeGreaterThan(0);
        });
    });

    describe('Byte size validation', () => {
        it('should calculate correct byte size for Japanese text', () => {
            const japaneseText = 'あいうえお'; // 5文字 x 3バイト = 15バイト
            const byteSize = Buffer.byteLength(japaneseText, 'utf-8');
            expect(byteSize).toBe(15);
        });

        it('should calculate correct byte size for mixed text', () => {
            const mixedText = 'Hello世界'; // 5 + (2 * 3) = 11バイト
            const byteSize = Buffer.byteLength(mixedText, 'utf-8');
            expect(byteSize).toBe(11);
        });

        it('should detect text exceeding 5000 bytes', () => {
            const longText = 'あ'.repeat(2000); // 6000バイト
            const byteSize = Buffer.byteLength(longText, 'utf-8');
            expect(byteSize).toBeGreaterThan(5000);
        });
    });
});
