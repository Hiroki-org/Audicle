import { NextRequest } from 'next/server';

export function getCorsHeaders(request: NextRequest): Record<string, string> {
    const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean);

    // The check is moved inside the function to avoid throwing an error during Next.js static build phase
    if (process.env.NODE_ENV === 'production' && allowedOrigins.length === 0) {
        console.error('ALLOWED_ORIGINS must be configured in production. Set it to a comma-separated list of allowed origins.');
    }

    const origin = request?.headers?.get?.('origin') ?? null;

    const headers: Record<string, string> = {
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        Vary: 'Origin',
    };

    if (origin && allowedOrigins.includes(origin)) {
        headers['Access-Control-Allow-Origin'] = origin;
        headers['Access-Control-Allow-Credentials'] = 'true';
    }

    return headers;
}
