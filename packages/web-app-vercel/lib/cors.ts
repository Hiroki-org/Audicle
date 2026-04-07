export function getCorsHeaders(requestOrigin: string | null): Record<string, string> {
    const allowedOriginsStr = process.env.ALLOWED_ORIGINS || '';
    const allowedOrigins = allowedOriginsStr.split(',').map(o => o.trim()).filter(Boolean);

    const corsHeaders: Record<string, string> = {
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (requestOrigin && allowedOrigins.includes(requestOrigin)) {
        corsHeaders['Access-Control-Allow-Origin'] = requestOrigin;
    }

    return corsHeaders;
}
