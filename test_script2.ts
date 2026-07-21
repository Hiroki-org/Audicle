import { NextResponse } from 'next/server';
import { POST } from './packages/web-app-vercel/app/api/playlists/bulk_update/route';

async function run() {
    process.env.AUTH_ENV = 'test';
    const mockRequest = {
        json: async () => ({
            articleId: 'mock-article-id',
            addToPlaylistIds: ['playlist-1'],
            removeFromPlaylistIds: ['playlist-2']
        })
    } as Request;

    try {
        const response = await POST(mockRequest);
        console.log("Status:", response.status);
        if (response.status === 500) {
            const data = await response.json();
            console.log("Error data:", data);
        }
    } catch (e) {
        console.error("Caught error:", e);
    }
}
run();
