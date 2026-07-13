import { NextRequest } from 'next/server';

export class CorsError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'CorsError';
    }
}


export function getCorsHeaders(request: NextRequest): Record<string, string> {
    const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean);

    // The check is moved inside the function to avoid throwing an error during Next.js static build phase
    if (process.env.NODE_ENV === 'production' && allowedOrigins.length === 0) {
        console.error('ALLOWED_ORIGINS must be configured in production. Set it to a comma-separated list of allowed origins.');
        throw new CorsError('Server configuration error: ALLOWED_ORIGINS is not set.');
    }

    const origin = request?.headers?.get?.('origin') ?? null;

    const headers: Record<string, string> = {
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        Vary: 'Origin',
    };

    if (origin) {
        if (allowedOrigins.length > 0) {
            if (!allowedOrigins.includes(origin)) {
                throw new CorsError('Origin not allowed');
            }
            headers['Access-Control-Allow-Origin'] = origin;
            headers['Access-Control-Allow-Credentials'] = 'true';
        } else if (process.env.NODE_ENV === 'production') {
            // If allowedOrigins is empty in production, it's already caught above.
            // But defensively, we should not allow requests if no origins are configured.
             throw new CorsError('Origin not allowed');
        }
    }

    return headers;
}
