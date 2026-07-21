import crypto from 'crypto';

/**
 * テキストのSHA-256ハッシュを計算（サーバーサイド用）
 */
export function calculateTextHash(text: string, index: number): string {
    return crypto.createHash('sha256').update(`${text}:${index}`, 'utf8').digest('hex');
}
