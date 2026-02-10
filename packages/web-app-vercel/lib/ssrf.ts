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
            const ip = ipaddr.parse(address);
            if (ip.range() !== 'unicast') {
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
             // Should not happen on success, but just in case
             // Fallback to error or empty string if no addresses found
             const error = new Error(`DNS lookup for ${hostname} returned no addresses`);
             (error as any).code = 'ENOTFOUND';
             return callback(error as NodeJS.ErrnoException, '', 0);
        }

        // Ensure addresses is an array (dns.lookup with all: true returns array of objects)
        const addrList = (Array.isArray(addresses) ? addresses : [addresses]) as { address: string; family: number }[];

        for (const { address } of addrList) {
            try {
                const ip = ipaddr.parse(address);
                if (ip.range() !== 'unicast') {
                    const error = new Error(`SSRF: Blocked access to non-unicast address ${address}`);
                    (error as any).code = 'ENOTFOUND'; // Simulate DNS failure for blocked IPs
                    return callback(error as NodeJS.ErrnoException, '', 0);
                }
            } catch (_e) {
                 const error = new Error(`SSRF: Invalid IP ${address}`);
                 (error as any).code = 'EINVAL';
                 return callback(error as NodeJS.ErrnoException, '', 0);
            }
        }

        // If all addresses are safe, use the first one (as http.request expects a single address for the connection)
        const first = addrList[0];
        callback(null, first.address, first.family);
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
                headers: options.headers,
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
                            res.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
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
