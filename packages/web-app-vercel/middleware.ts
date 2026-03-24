import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { auth } from "@/lib/auth";

export async function middleware(request: NextRequest) {
    // APIルート、認証ルート、デバッグルートはスキップ
    const pathname = request.nextUrl.pathname;
    if (pathname.startsWith('/api') || pathname.startsWith('/auth') || pathname === '/debug') {
        return NextResponse.next();
    }

    // 認証チェック
    const session = await auth();

    if (!session) {
        const signInUrl = new URL('/auth/signin', request.url);
        return NextResponse.redirect(signInUrl);
    }

    return NextResponse.next();
}

export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};