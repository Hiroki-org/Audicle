const { Readability } = require("@mozilla/readability");
const { JSDOM } = require("jsdom");
const fetch = require("node-fetch");
const dns = require("dns");
const ipaddr = require("ipaddr.js");
const http = require("http");
const https = require("https");
const { URL } = require("url");

function isPrivateIP(address) {
  try {
    const ip = ipaddr.parse(address);
    const range = ip.range();

    if (ip.kind() === "ipv6" && ip.isIPv4MappedAddress()) {
        const ipv4 = ip.toIPv4Address();
        const v4Range = ipv4.range();
        return (
            v4Range === "private" ||
            v4Range === "loopback" ||
            v4Range === "linkLocal" ||
            v4Range === "reserved" ||
            v4Range === "carrierGradeNat" ||
            ipv4.toNormalizedString() === "0.0.0.0"
        );
    }

    return (
      range === "private" ||
      range === "loopback" ||
      range === "linkLocal" ||
      range === "reserved" ||
      range === "uniqueLocal" ||
      range === "carrierGradeNat" ||
      ip.toNormalizedString() === "0.0.0.0" ||
      ip.toNormalizedString() === "::"
    );
  } catch (e) {
    return true;
  }
}

function safeLookup(hostname, options, callback) {
  // Always request all addresses to check for any unsafe IPs (e.g. DNS rebinding via multiple A records)
  dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err);

    if (!addresses || (Array.isArray(addresses) && addresses.length === 0)) {
        return callback(new Error("No address found"));
    }

    // Ensure addresses is an array
    const addrList = (Array.isArray(addresses) ? addresses : [addresses]);

    for (const { address } of addrList) {
        if (isPrivateIP(address)) {
            return callback(new Error(`Access to private network is denied: ${address}`));
        }
    }

    // Prefer IPv4
    const ipv4 = addrList.find(a => a.family === 4);
    const selected = ipv4 || addrList[0];

    callback(null, selected.address, selected.family);
  });
}

const httpAgent = new http.Agent({ lookup: safeLookup });
const httpsAgent = new https.Agent({ lookup: safeLookup });

async function fetchWithRedirects(initialUrl) {
  let currentUrl = initialUrl;
  let redirects = 0;
  const maxRedirects = 5;

  while (redirects <= maxRedirects) {
    let parsed;
    try {
        parsed = new URL(currentUrl);
    } catch(e) {
        throw new Error("Invalid URL: " + currentUrl);
    }

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        throw new Error("Invalid URL scheme: " + parsed.protocol);
    }

    const agent = parsed.protocol === 'http:' ? httpAgent : httpsAgent;

    const response = await fetch(currentUrl, {
      agent: agent,
      redirect: "manual",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      },
      timeout: 10000,
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) {
        throw new Error("Redirect with no Location header");
      }

      currentUrl = new URL(location, currentUrl).toString();
      redirects++;
      continue;
    }

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return { response, finalUrl: currentUrl };
  }

  throw new Error("Too many redirects");
}

async function extractContent(url) {
  try {
    const { response, finalUrl } = await fetchWithRedirects(url);
    const html = await response.text();

    const dom = new JSDOM(html, { url: finalUrl });
    const doc = dom.window.document;

    const reader = new Readability(doc);
    const article = reader.parse();

    if (!article) {
      throw new Error("Failed to extract content");
    }

    const chunks = article.textContent
      .split(/\n\s*\n/)
      .map((chunk) => chunk.trim())
      .filter((chunk) => chunk.length > 10)
      .slice(0, 50);

    const result = {
      title: article.title || "",
      chunks: chunks,
    };

    console.log(JSON.stringify(result));
  } catch (error) {
    console.error(JSON.stringify({ error: error.message }));
    process.exit(1);
  }
}

const urlArg = process.argv[2];
if (!urlArg) {
  console.error(JSON.stringify({ error: "URL is required" }));
  process.exit(1);
}

extractContent(urlArg);
