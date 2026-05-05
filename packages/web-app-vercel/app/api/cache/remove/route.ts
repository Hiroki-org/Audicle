import { NextRequest, NextResponse } from 'next/server';
import { removeCachedChunk } from '@/lib/db/cacheIndex';
import { auth } from '@/lib/auth';
import { calculateTextHash } from '@/lib/textHash';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
    try {
        // 認証チェック追加
        const session = await auth();
        if (!session?.user) {
            console.error('[Cache Remove API] ❌ Unauthorized', { requestId: request.headers.get('x-request-id') });
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { articleUrl, voice, text, index } = await request.json();

        if (!articleUrl || !voice || !text || index === undefined) {
            return NextResponse.json(
                { error: 'articleUrl, voice, text, and index are required' },
                { status: 400 }
            );
        }

        // テキストからハッシュを計算
        const textHash = calculateTextHash(text, index);

        // Supabaseインデックスから削除
        await removeCachedChunk(articleUrl, voice, textHash);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('[Cache Remove API] Error:', error);
        return NextResponse.json(
            { error: 'Failed to remove cached chunk' },
            { status: 500 }
        );
    }
}
