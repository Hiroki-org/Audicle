import { calculateTextHash } from '@/lib/textHash';

// 記事ハッシュ計算関数を追加
export function calculateArticleHash(chunks: string[]): string {
    const content = chunks.join('\n');
    return calculateTextHash(content, 0).substring(0, 16);
}
