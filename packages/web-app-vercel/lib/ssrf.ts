import dns from 'dns';
import ipaddr from 'ipaddr.js';
import { promisify } from 'util';
import http from 'http';
import https from 'https';
import { URL } from 'url';

const lookup = promisify(dns.lookup);

/**
 * Validates if a URL is safe to fetch (SSRF protection).
 * Rejects private IPs, loopback, link-local, and non-http/https protocols.
 */
export async function isSafeUrl(urlString: string): Promise<boolean> {
    try {
        const url = new URL(urlString);

        // Only allow http and https
        if (!['http:', 'https:'].includes(url.protocol)) {
            return false;
        }

        const hostname = url.hostname;

        // Block localhost explicitly to save a DNS lookup
        if (hostname === 'localhost' || hostname.endsWith('.localhost')) {
            return false;
        }

        // Resolve hostname to all IPs and check each resolved address
        const addresses = await lookup(hostname, { all: true }) as Array<{ address: string; family: number }>;

        if (!addresses || addresses.length === 0) {
            return false;
        }

        // Use allowlist policy: only unicast addresses are allowed
        for (const { address } of addresses) {
            if (!isAddressSafe(address)) {
                console.error(`SSRF Blocked: IP ${address} is not safe.`);
                return false;
            }
        }

        return true;
    } catch (error) {
        console.error('SSRF Check Error:', error);
        return false;
    }
}

/**
 * Helper to validate a single IP address using ipaddr.js
 */
function isAddressSafe(address: string): boolean {
    try {
        let ip = ipaddr.parse(address);

        // Convert IPv4-mapped IPv6 addresses to IPv4
        if (ip.kind() === 'ipv6' && (ip as ipaddr.IPv6).isIPv4MappedAddress()) {
            ip = (ip as ipaddr.IPv6).toIPv4Address();
        }

        const range = ip.range();

        // Allow unicast only
        // Note: ipaddr.js classifies public IPs as 'unicast'
        return range === 'unicast';
    } catch {
        return false;
    }
}

/**
 * Custom DNS lookup function that validates the resolved IP against SSRF rules.
 * Use this with http(s).request options: { lookup: safeLookup }
 */
export function safeLookup(
    hostname: string,
    options: any,
    callback: (err: NodeJS.ErrnoException | null, address: string, family: number) => void
): void {
    // Always request all addresses to check for any unsafe IPs (e.g. DNS rebinding via multiple A records)
    dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
        if (err) return callback(err, '', 0);

        if (!addresses || (Array.isArray(addresses) && addresses.length === 0)) {
             const error = new Error(`DNS lookup for ${hostname} returned no addresses`);
             (error as any).code = 'ENOTFOUND';
             return callback(error as NodeJS.ErrnoException, '', 0);
        }

        // Ensure addresses is an array
        const addrList = (Array.isArray(addresses) ? addresses : [addresses]) as { address: string; family: number }[];

        for (const { address } of addrList) {
            if (!isAddressSafe(address)) {
                const error = new Error(`SSRF: Blocked access to unsafe address ${address}`);
                (error as any).code = 'ENOTFOUND'; // Simulate DNS failure for blocked IPs
                return callback(error as NodeJS.ErrnoException, '', 0);
            }
        }

        // Prefer IPv4 to avoid connectivity issues in environments where IPv6 is present but broken (e.g. some CI)
        const ipv4 = addrList.find(a => a.family === 4);
        const selected = ipv4 || addrList[0];

        callback(null, selected.address, selected.family);
    });
}

/**
 * A fetch-like wrapper that uses safeLookup to prevent SSRF/DNS Rebinding.
 * Only supports GET requests and basic text response handling as needed by route.ts.
 */
export function safeFetch(url: string, options: { signal?: AbortSignal, headers?: Record<string, string> } = {}): Promise<any> {
    return new Promise((resolve, reject) => {
        try {
            const urlObj = new URL(url);

            if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') {
                return reject(new Error('Only http and https are supported'));
            }

            const protocol = urlObj.protocol === 'https:' ? https : http;

            const requestOptions = {
                method: 'GET',
                headers: {
                    ...options.headers,
                    // Prevent server from sending compressed content which http.request doesn't handle automatically
                    'Accept-Encoding': 'identity'
                },
                signal: options.signal,
                lookup: safeLookup
            };

            const req = protocol.request(url, requestOptions, (res) => {
                const response = {
                    ok: !!(res.statusCode && res.statusCode >= 200 && res.statusCode < 300),
                    status: res.statusCode || 0,
                    statusText: res.statusMessage || '',
                    headers: {
                        get: (name: string) => {
                            const val = res.headers[name.toLowerCase()];
                            if (Array.isArray(val)) return val[0];
                            return val || null;
                        }
                    },
                    text: () => {
                        return new Promise<string>((resolveText, rejectText) => {
                            const chunks: Buffer[] = [];
                            const MAX_RESPONSE_SIZE = 10 * 1024 * 1024; // 10MB
                            let totalLength = 0;
                            res.on('data', (chunk) => {
                                totalLength += chunk.length;
                                if (totalLength > MAX_RESPONSE_SIZE) {
                                    res.destroy(new Error(`Response size exceeds maximum allowed size of ${MAX_RESPONSE_SIZE} bytes`));
                                    return;
                                }
                                chunks.push(Buffer.from(chunk));
                            });
                            res.on('end', () => resolveText(Buffer.concat(chunks).toString('utf-8')));
                            res.on('error', rejectText);
                        });
                    },
                    body: {
                        cancel: async () => {
                            res.destroy();
                        }
                    }
                };

                resolve(response);
            });

            req.on('error', (err) => {
                 reject(err);
            });

            req.end();

        } catch (error) {
            reject(error);
        }
    });
}
