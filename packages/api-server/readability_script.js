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



async function safeFetch(url) {
    let currentUrl = url;
    let response;
    let redirectCount = 0;
    const maxRedirects = 10;
    const httpAgent = new http.Agent();
    const httpsAgents = new Map();

    const getAgent = (protocol, servername) => {
        if (protocol === 'http:') {
            return httpAgent;
        }

        if (!httpsAgents.has(servername)) {
            httpsAgents.set(servername, new https.Agent({ servername }));
        }

        return httpsAgents.get(servername);
    };

    while (redirectCount < maxRedirects) {
        const parsedUrl = new URL(currentUrl);
        if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
             throw new Error("Invalid protocol. Only http and https are allowed.");
        }

        let hostnameWithoutBrackets = parsedUrl.hostname;
        if (hostnameWithoutBrackets.startsWith('[') && hostnameWithoutBrackets.endsWith(']')) {
             hostnameWithoutBrackets = hostnameWithoutBrackets.slice(1, -1);
        }

        let addressToUse = hostnameWithoutBrackets;
        let familyToUse = null;

        if (!ipaddr.isValid(hostnameWithoutBrackets)) {
            const { address, family } = await dns.promises.lookup(hostnameWithoutBrackets);
            addressToUse = address;
            familyToUse = family;
        } else {
            try {
               const parsed = ipaddr.parse(hostnameWithoutBrackets);
               familyToUse = parsed.kind() === 'ipv6' ? 6 : 4;
            } catch (e) {
               familyToUse = 4;
            }
        }

        if (!isIpSafe(addressToUse)) {
             throw new Error(`SSRF Blocked: Access to ${addressToUse} is restricted`);
        }

        const originalHostHeader = parsedUrl.host;
        const originalHostname = hostnameWithoutBrackets;
        parsedUrl.hostname = familyToUse === 6 ? `[${addressToUse}]` : addressToUse;

        response = await fetch(parsedUrl.toString(), {
          agent: getAgent(parsedUrl.protocol, originalHostname),
          headers: {
            "Host": originalHostHeader,
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
          },
          redirect: 'manual'
        });

        if ([301, 302, 303, 307, 308].includes(response.status) && response.headers.has('location')) {
            const location = response.headers.get('location');
            response.body?.resume();
            currentUrl = new URL(location, currentUrl).toString();
            redirectCount++;
            continue;
        }

        break;
    }

    if (redirectCount >= maxRedirects) {
        throw new Error("Too many redirects");
    }
    return response;
}

async function extractContent(url) {
  try {
    // URLからHTMLを取得 (安全なフェッチを使用)
    const response = await safeFetch(url);

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

// コマンドライン引数からURLを取得
const url = process.argv[2];
if (!url) {
  console.error(JSON.stringify({ error: "URL is required" }));
  process.exit(1);
}

extractContent(url);
