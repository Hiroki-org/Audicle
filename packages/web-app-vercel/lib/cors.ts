import { NextRequest } from 'next/server';

export class CorsError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'CorsError';
    }
}

let cachedAllowedOriginsEnv: string | undefined;
let cachedAllowedOrigins = new Set<string>();

function getAllowedOrigins(): Set<string> {
    const allowedOriginsEnv = process.env.ALLOWED_ORIGINS || '';
    if (allowedOriginsEnv !== cachedAllowedOriginsEnv) {
        cachedAllowedOriginsEnv = allowedOriginsEnv;
        cachedAllowedOrigins = new Set(
            allowedOriginsEnv
                .split(',')
                .map((origin) => origin.trim())
                .filter(Boolean),
        );
    }
    return cachedAllowedOrigins;
}

export function getCorsHeaders(request: NextRequest): Record<string, string> {
    const origin = request?.headers?.get?.('origin') ?? null;
    const allowedOrigins = getAllowedOrigins();

    const headers: Record<string, string> = {
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        Vary: 'Origin',
    };

    if (origin) {
        if (allowedOrigins.size === 0) {
            if (process.env.NODE_ENV === 'production') {
                console.error('ALLOWED_ORIGINS must be configured in production. Set it to a comma-separated list of allowed origins.');
            }
            throw new CorsError('Allowed origins are not configured');
        }

        if (!allowedOrigins.has(origin)) {
            throw new CorsError('Origin not allowed');
        }

        headers['Access-Control-Allow-Origin'] = origin;
        headers['Access-Control-Allow-Credentials'] = 'true';
    }

    return headers;
}
