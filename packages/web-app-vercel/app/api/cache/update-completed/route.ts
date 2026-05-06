import { NextRequest, NextResponse } from 'next/server';
import { updateCompletedPlayback } from '@/lib/db/cacheIndex';
import { auth } from '@/lib/auth';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
    try {
        // 認証チェック追加
        const session = await auth();
        if (!session?.user) {
            console.error('[Cache Update Completed] ❌ Unauthorized', { requestId: request.headers.get('x-request-id') });
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { articleUrl, voice, completed } = await request.json();

        if (!articleUrl || !voice || typeof completed !== 'boolean') {
            return NextResponse.json(
                { error: 'articleUrl, voice, and completed are required' },
                { status: 400 }
            );
        }

        await updateCompletedPlayback(articleUrl, voice, completed);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('[Cache Update Completed API] Error:', error);
        return NextResponse.json(
            { error: 'Failed to update completed playback' },
            { status: 500 }
        );
    }
}
