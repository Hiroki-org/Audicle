import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createExtensionToken, validateExtensionRedirectUri } from '@/lib/extension-auth';

function appendAuthInfoToRedirectUri(
    redirectUri: string,
    data: { accessToken: string; expiresAt: number; email: string }
): string {
    const hashParams = new URLSearchParams({
        access_token: data.accessToken,
        expires_at: String(data.expiresAt),
        email: data.email,
    });
    return `${redirectUri}#${hashParams.toString()}`;
}

export async function GET(request: NextRequest) {
    const redirectUri = request.nextUrl.searchParams.get('redirect_uri');

    if (!redirectUri || !validateExtensionRedirectUri(redirectUri)) {
        return NextResponse.json({ error: 'Invalid redirect_uri' }, { status: 400 });
    }

    const session = await auth();
    if (!session?.user?.email || !session.user.id) {
        const callbackUrl = `/extension/login?redirect_uri=${encodeURIComponent(redirectUri)}`;
        const signInUrl = `/auth/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`;
        return NextResponse.redirect(new URL(signInUrl, request.url));
    }

    const ALLOWED_EMAILS = process.env.ALLOWED_EMAILS?.split(',').map(e => e.trim().toLowerCase()).filter(Boolean) ?? [];
    if (ALLOWED_EMAILS.length > 0 && !ALLOWED_EMAILS.includes(session.user.email.toLowerCase())) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const { token, expiresAt, email } = createExtensionToken({
        id: session.user.id,
        email: session.user.email,
    });

    return NextResponse.redirect(
        appendAuthInfoToRedirectUri(redirectUri, {
            accessToken: token,
            expiresAt,
            email,
        })
    );
}
