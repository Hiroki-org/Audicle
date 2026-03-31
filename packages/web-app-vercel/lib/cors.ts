import { NextRequest } from 'next/server';

export function getCorsHeaders(request: NextRequest): Record<string, string> {
    let origin: string | null = null;
    if (request && request.headers && typeof request.headers.get === 'function') {
        origin = request.headers.get('origin');
    }

    const allowedOriginsStr = process.env.ALLOWED_ORIGINS || '';
    const allowedOrigins = allowedOriginsStr.split(',').map(o => o.trim()).filter(Boolean);

    // If no origin is present (e.g., server-to-server request) or allowedOrigins is not configured,
    // we don't need to return wildcard CORS headers. Return an empty object or restricted headers.
    // However, if we must return CORS headers, we should restrict them.

    const headers: Record<string, string> = {
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
    };

    // If the origin is in the allowed list, we reflect it.
    if (origin && allowedOrigins.includes(origin)) {
        headers['Access-Control-Allow-Origin'] = origin;
    }

    return headers;
}
