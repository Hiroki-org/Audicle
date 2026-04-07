import { NextRequest } from 'next/server';

const allowedOrigins = new Set(
    (process.env.ALLOWED_ORIGINS || '')
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean)
);

if (process.env.NODE_ENV === 'production' && allowedOrigins.size === 0) {
    throw new Error('ALLOWED_ORIGINS must be configured in production. Set it to a comma-separated list of allowed origins.');
}

export function getCorsHeaders(request: NextRequest | Request) {
    const origin = request?.headers?.get?.('origin') ?? null;

    const headers: Record<string, string> = {
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        Vary: 'Origin',
    };

    if (origin && allowedOrigins.has(origin)) {
        headers['Access-Control-Allow-Origin'] = origin;
        headers['Access-Control-Allow-Credentials'] = 'true';
    }

    return headers;
}
