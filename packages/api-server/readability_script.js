const { Readability } = require("@mozilla/readability");
const { JSDOM } = require("jsdom");
const fetch = require("node-fetch");
const dns = require("dns");
const http = require("http");
const https = require("https");
const ipaddr = require("ipaddr.js");

// SSRF Protection: Validate IP Address
function isIpSafe(ip) {
  try {
    const addr = ipaddr.parse(ip);
    const range = addr.range();

    // Check if IPv4-mapped IPv6 address (e.g. ::ffff:127.0.0.1)
    if (addr.kind() === 'ipv6' && addr.isIPv4MappedAddress()) {
        const ipv4 = addr.toIPv4Address();
        return ipv4.range() === 'unicast';
    }

    // Allow only unicast (public) addresses
    // This blocks:
    // - private (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16)
    // - loopback (127.0.0.0/8, ::1)
    // - linkLocal (169.254.0.0/16, fe80::/10)
    // - carrierGradeNat (100.64.0.0/10)
    // - etc.
    return range === 'unicast';
  } catch (e) {
    return false;
  }
}

// Custom lookup function compatible with dns.lookup signature
function safeLookup(hostname, options, callback) {
    // Standardize arguments
    if (typeof options === 'function') {
        callback = options;
        options = {};
    }

    // Call the original dns.lookup
    dns.lookup(hostname, options, (err, address, family) => {
        if (err) {
            return callback(err, address, family);
        }

        // Handle both single string and array of objects (if { all: true } was passed)
        if (Array.isArray(address)) {
             for (const addrObj of address) {
                 if (!isIpSafe(addrObj.address)) {
                     const error = new Error(`SSRF Blocked: Access to ${addrObj.address} is restricted`);
                     error.code = 'ENOTFOUND';
                     return callback(error);
                 }
             }
        } else {
             if (!isIpSafe(address)) {
                const error = new Error(`SSRF Blocked: Access to ${address} is restricted`);
                error.code = 'ENOTFOUND';
                return callback(error);
            }
        }

        callback(null, address, family);
    });
}

// Create agents with the safe lookup
const httpAgent = new http.Agent({ lookup: safeLookup });
const httpsAgent = new https.Agent({ lookup: safeLookup });

function getAgent(parsedUrl) {
    if (parsedUrl.protocol == 'http:') {
        return httpAgent;
    } else {
        return httpsAgent;
    }
}

async function extractContent(url) {
  try {
    // Basic protocol check before fetching
    const parsedUrl = new URL(url);
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
         throw new Error("Invalid protocol. Only http and https are allowed.");
    }

    // If the URL is an IP address, validate it immediately
    if (ipaddr.isValid(parsedUrl.hostname)) {
        if (!isIpSafe(parsedUrl.hostname)) {
             throw new Error(`SSRF Blocked: Access to ${parsedUrl.hostname} is restricted`);
        }
    }

    // URLからHTMLを取得
    const response = await fetch(url, {
      agent: getAgent,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const html = await response.text();

    // JSDOMでHTMLをパース
    const dom = new JSDOM(html, { url });
    const doc = dom.window.document;

    // Readabilityで本文抽出
    const reader = new Readability(doc);
    const article = reader.parse();

    if (!article) {
      throw new Error("Failed to extract content");
    }

    // テキストを段落ごとに分割（簡易版）
    const chunks = article.textContent
      .split(/\n\s*\n/) // 空行で分割
      .map((chunk) => chunk.trim())
      .filter((chunk) => chunk.length > 10) // 短すぎるチャンクを除外
      .slice(0, 50); // 最大50チャンクに制限

    const result = {
      title: article.title || "",
      chunks: chunks,
    };

    process.stdout.write(JSON.stringify(result) + "\n");
  } catch (error) {
    console.error(JSON.stringify({ error: error.message }));
    process.exit(1);
  }
}

if (require.main === module) {
  // コマンドライン引数からURLを取得
  const url = process.argv[2];
  if (!url) {
    console.error(JSON.stringify({ error: "URL is required" }));
    process.exit(1);
  }

  extractContent(url);
} else {
  module.exports = { isIpSafe };
}
