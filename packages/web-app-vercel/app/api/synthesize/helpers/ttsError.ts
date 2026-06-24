import { GoogleError } from 'google-gax';

/**
 * Google Cloud TTS APIエラーの種類
 */
export interface TTSErrorInfo {
    statusCode: number;
    userMessage: string;
    errorType: 'INVALID_ARGUMENT' | 'RESOURCE_EXHAUSTED' | 'INTERNAL' | 'NETWORK' | 'UNKNOWN';
}

/**
 * Google Cloud TTS APIエラーをパースして適切なエラー情報を返す
 */
export function parseTTSError(error: unknown): TTSErrorInfo {
    // GoogleErrorの場合（gRPCエラー）
    if (error instanceof GoogleError) {
        const code = error.code;
        const message = error.message ? error.message.toLowerCase() : '';

        // INVALID_ARGUMENT (3): テキストが長すぎる、無効な入力など
        if (code === 3 || message.includes('invalid_argument')) {
            return {
                statusCode: 400,
                userMessage: 'テキストが長すぎるか、無効な入力です。チャンクサイズを確認してください。',
                errorType: 'INVALID_ARGUMENT',
            };
        }

        // RESOURCE_EXHAUSTED (8): クォータ超過
        if (code === 8 || message.includes('resource_exhausted') || message.includes('quota')) {
            return {
                statusCode: 429,
                userMessage: 'API利用制限に達しました。しばらく待ってから再試行してください。',
                errorType: 'RESOURCE_EXHAUSTED',
            };
        }

        // INTERNAL (13), UNAVAILABLE (14): Google側の内部エラー/サービス利用不可
        if (code === 13 || code === 14 || message.includes('internal') || message.includes('unavailable')) {
            return {
                statusCode: 503,
                userMessage: 'Google Cloud TTSサービスで一時的なエラーが発生しました。しばらく待ってから再試行してください。',
                errorType: 'INTERNAL',
            };
        }
        // その他のGoogleErrorは不明なエラーとしてフォールバック
    } else if (error instanceof Error) {
        // ネットワークエラー
        const message = error.message.toLowerCase();
        if (message.includes('network') || message.includes('timeout') || message.includes('econnrefused') || message.includes('enotfound')) {
            return {
                statusCode: 503,
                userMessage: 'ネットワークエラーが発生しました。接続を確認してください。',
                errorType: 'NETWORK',
            };
        }
    }

    // その他の不明なエラー
    return {
        statusCode: 500,
        userMessage: '音声合成中にエラーが発生しました。再試行してください。',
        errorType: 'UNKNOWN',
    };
}

/**
 * TTS固有のエラークラス
 */
export class TTSError extends Error {
    statusCode: number;
    errorType: string;

    constructor(message: string, errorType: string, statusCode: number) {
        super(message);
        this.name = 'TTSError';
        this.errorType = errorType;
        this.statusCode = statusCode;
    }
}
