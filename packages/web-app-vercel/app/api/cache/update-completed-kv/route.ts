import { NextRequest, NextResponse } from 'next/server';
import { getKv } from '@/lib/kv';
import { parseArticleMetadata, serializeArticleMetadata } from '@/lib/kv-helpers';
import { auth } from '@/lib/auth';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
    try {
        // 認証チェック追加
        const session = await auth();
        if (!session?.user) {
            console.error('[KV Update] ❌ Unauthorized', { requestId: request.headers.get('x-request-id') });
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { articleUrl, voice, completed } = await request.json();

        if (!articleUrl || !voice || typeof completed !== 'boolean') {
            return NextResponse.json(
                { error: 'Missing required fields: articleUrl, voice, completed' },
                { status: 400 }
            );
        }

        const kv = await getKv();
        if (!kv) {
            return NextResponse.json(
                { error: 'KV client is not configured' },
                { status: 500 }
            );
        }

        const metadataKey = `article:${articleUrl}:${voice}`;

        const existing = await kv.hgetall(metadataKey);
        const metadata = parseArticleMetadata(existing);

        if (!metadata) {
            return NextResponse.json(
                { error: 'Article metadata not found' },
                { status: 404 }
            );
        }

        await kv.hset(
            metadataKey,
            serializeArticleMetadata({
                completedPlayback: completed,
                lastUpdated: new Date().toISOString(),
            })
        );

        return NextResponse.json({
            success: true,
            articleUrl,
            voice,
            completedPlayback: completed,
        });
    } catch (error) {
        console.error('[KV Update] ❌ Error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
