import { NextRequest } from 'next/server';

export function getCorsHeaders(request: NextRequest) {
    const origin = request.headers.get('origin');
    const allowedOriginsStr = process.env.ALLOWED_ORIGINS || '';
    const allowedOrigins = allowedOriginsStr.split(',').map(o => o.trim()).filter(Boolean);

    const headers: Record<string, string> = {
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Credentials': 'true',
        Vary: 'Origin',
    };

    if (origin && allowedOrigins.includes(origin)) {
        headers['Access-Control-Allow-Origin'] = origin;
    }

    return headers;
}
