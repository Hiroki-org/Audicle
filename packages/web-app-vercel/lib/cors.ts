import { NextRequest } from 'next/server';

export function getCorsHeaders(request: NextRequest | Request) {
    const origin = request?.headers?.get?.('origin');
    const allowedOriginsStr = process.env.ALLOWED_ORIGINS || '';
    if (process.env.NODE_ENV === 'production' && !allowedOriginsStr) {
        // Only log warning instead of throwing an error to avoid breaking the build process
        console.warn('WARNING: ALLOWED_ORIGINS should be configured in production.');
    }
    const allowedOrigins = allowedOriginsStr.split(',').map(o => o.trim()).filter(Boolean);

    const headers: Record<string, string> = {
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (origin && allowedOrigins.includes(origin)) {
        headers['Access-Control-Allow-Origin'] = origin;
    }

    return headers;
}
