import dns from "dns";
import ipaddr from "ipaddr.js";
import { promisify } from "util";

const lookup = promisify(dns.lookup);

export interface ValidatedUrl {
  isSafe: boolean;
  ipAddress?: string;
  family?: number;
}

/**
 * Validates if a URL is safe to fetch (SSRF protection).
 * Rejects private IPs, loopback, link-local, and non-http/https protocols.
 * Returns the validated IP address to prevent TOCTOU (Time-of-Check to Time-of-Use) attacks.
 */
export async function validateAndResolveUrl(
  urlString: string,
): Promise<ValidatedUrl> {
  try {
    const url = new URL(urlString);

    // Only allow http and https
    if (!["http:", "https:"].includes(url.protocol)) {
      return { isSafe: false };
    }

    const hostname = url.hostname;

    // Block localhost explicitly to save a DNS lookup
    if (hostname === "localhost" || hostname.endsWith(".localhost")) {
      return { isSafe: false };
    }

    // Resolve hostname to all IPs and check each resolved address
    const addresses = (await lookup(hostname, { all: true })) as Array<{
      address: string;
      family: number;
    }>;

    if (!addresses || addresses.length === 0) {
      return { isSafe: false };
    }

    // Use allowlist policy: only unicast addresses are allowed
    for (const { address } of addresses) {
      const ip = ipaddr.parse(address);
      if (ip.range() !== "unicast") {
        return { isSafe: false };
      }
    }

    // Return the first resolved address for TOCTOU prevention
    const selectedAddress = addresses[0];

    return {
      isSafe: true,
      ipAddress: selectedAddress.address,
      family: selectedAddress.family,
    };
  } catch (error) {
    console.error("SSRF Check Error:", error);
    return { isSafe: false };
  }
}

/**
 * Validates if a URL is safe to fetch (SSRF protection).
 * Rejects private IPs, loopback, link-local, and non-http/https protocols.
 */
export async function isSafeUrl(urlString: string): Promise<boolean> {
  const result = await validateAndResolveUrl(urlString);
  return result.isSafe;
}
