import jwt from 'jsonwebtoken';

const EXTENSION_TOKEN_AUDIENCE = 'audicle-extension';
const DEFAULT_EXTENSION_TOKEN_EXPIRY_SECONDS = 60 * 60 * 24 * 7;

type ExtensionTokenPayload = {
    sub: string;
    email: string;
    aud: string;
    iat?: number;
    exp?: number;
};

function getExtensionAuthSecret(): string {
    const secret = process.env.EXTENSION_AUTH_SECRET || process.env.AUTH_SECRET;
    if (!secret) {
        throw new Error('EXTENSION_AUTH_SECRET or AUTH_SECRET must be configured');
    }
    return secret;
}

function getExtensionTokenExpirySeconds(): number {
    const raw = Number(process.env.EXTENSION_TOKEN_EXPIRY_SECONDS);
    if (!Number.isFinite(raw) || raw <= 0) {
        return DEFAULT_EXTENSION_TOKEN_EXPIRY_SECONDS;
    }
    return raw;
}

function getAllowedRedirectOrigins(): string[] {
    const configuredOrigins = (process.env.ALLOWED_EXTENSION_REDIRECT_ORIGINS || '')
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean);

    if (process.env.NODE_ENV === 'production') {
        return configuredOrigins;
    }

    if (configuredOrigins.length > 0) {
        return configuredOrigins;
    }

    return [];
}

export function validateExtensionRedirectUri(redirectUri: string): boolean {
    let parsed: URL;
    try {
        parsed = new URL(redirectUri);
    } catch {
        return false;
    }

    if (parsed.protocol !== 'https:') {
        return false;
    }

    if (!parsed.hostname.endsWith('.chromiumapp.org')) {
        return false;
    }

    if (parsed.pathname !== '/audicle-auth') {
        return false;
    }

    const allowedOrigins = getAllowedRedirectOrigins();
    if (allowedOrigins.length === 0) {
        return process.env.NODE_ENV !== 'production';
    }

    return allowedOrigins.includes(parsed.origin);
}

export function createExtensionToken(user: { id?: string | null; email?: string | null }) {
    if (!user?.id || !user?.email) {
        throw new Error('User id and email are required');
    }

    const expiresInSeconds = getExtensionTokenExpirySeconds();
    const issuedAtSeconds = Math.floor(Date.now() / 1000);
    const expiresAtSeconds = issuedAtSeconds + expiresInSeconds;

    const payload: ExtensionTokenPayload = {
        sub: user.id,
        email: user.email,
        aud: EXTENSION_TOKEN_AUDIENCE,
        iat: issuedAtSeconds,
        exp: expiresAtSeconds,
    };

    const token = jwt.sign(payload, getExtensionAuthSecret(), {
        algorithm: 'HS256',
    });

    return {
        token,
        expiresAt: expiresAtSeconds * 1000,
        email: user.email,
    };
}

export function verifyExtensionToken(token: string): { sub: string; email: string } {
    const decoded = jwt.verify(token, getExtensionAuthSecret(), {
        algorithms: ['HS256'],
        audience: EXTENSION_TOKEN_AUDIENCE,
    }) as ExtensionTokenPayload;

    if (!decoded?.sub || !decoded?.email) {
        throw new Error('Invalid extension token payload');
    }

    return {
        sub: decoded.sub,
        email: decoded.email,
    };
}
