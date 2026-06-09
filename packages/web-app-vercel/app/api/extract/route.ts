import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders, CorsError } from '@/lib/cors';
import { Readability } from "@mozilla/readability";
import { normalizeArticleText } from "@/lib/parseArticle";
import { parseHTML } from "linkedom";
import { ExtractResponse } from "@/types/api";
import { isSafeUrl } from "@/lib/ssrf";
import dns from "dns";
import ipaddr from "ipaddr.js";

// Node.js runtimeを明示的に指定（JSDOMはEdge Runtimeで動作しない）
export const runtime = "nodejs";
// 動的レンダリングを強制（キャッシュを無効化）
export const dynamic = "force-dynamic";

export async function OPTIONS(request: NextRequest) {
    try {
        const headers = getCorsHeaders(request);
        return NextResponse.json({}, { headers });
    } catch (error) {
        if (error instanceof CorsError) {
            return new NextResponse(null, { status: 403, statusText: "Forbidden" });
        }
        throw error;
    }
}

export async function POST(request: NextRequest) {
  let corsHeaders: Record<string, string>;
    try {
        corsHeaders = getCorsHeaders(request);
    } catch (error) {
        if (error instanceof CorsError) {
            return NextResponse.json({ error: "Forbidden: Origin not allowed" }, { status: 403 });
        }
        throw error;
    }

  try {
    const { url } = await request.json();
    if (!url || typeof url !== "string") {
      return NextResponse.json(
        { error: "URL is required" },
        { status: 400, headers: corsHeaders },
      );
    }

    // URLのバリデーション
    try {
      new URL(url);
    } catch {
      return NextResponse.json(
        { error: "Invalid URL format" },
        { status: 400, headers: corsHeaders },
      );
    }

    // SSRFチェック (initial check)
    if (!(await isSafeUrl(url))) {
      console.warn("[Extract API] SSRF attempt blocked:", url);
      return NextResponse.json(
        { error: "Access to this URL is restricted for security reasons" },
        { status: 403, headers: corsHeaders },
      );
    }

    // HTMLを取得 (with secure redirect handling and SSRF dispatcher)
    const html = await fetchWithTimeout(url);

    // linkedomでパース
    const { document } = parseHTML(html);

    // Readabilityで本文抽出
    const article = new Readability(document).parse();

    if (!article) {
      return NextResponse.json(
        { error: "Failed to extract content from URL" },
        { status: 422, headers: corsHeaders },
      );
    }

    // テキストコンテンツの取得（重複やUIテキスト混入を防ぐため normalizeArticleText を利用）
    const textContent =
      normalizeArticleText(article.content || "") || article.textContent || "";

    const response: ExtractResponse = {
      title: article.title || "",
      content: article.content || textContent,
      textLength: textContent.length,
      author: article.byline || undefined,
      siteName: article.siteName || undefined,
    };

    return NextResponse.json(response, {
      headers: corsHeaders,
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400, headers: corsHeaders },
      );
    }

    if (error instanceof TimeoutError) {
      return NextResponse.json(
        { error: "Request timeout - URL took too long to fetch" },
        { status: 408, headers: corsHeaders },
      );
    }

    if (error instanceof AuthenticationRequiredError) {
      return NextResponse.json(
        {
          error:
            "このURLは認証が必要なサイトです。ログインが必要なページは読み込めません。",
        },
        { status: error.statusCode, headers: corsHeaders },
      );
    }

    if (error instanceof SSRFBlockedError) {
      return NextResponse.json(
        {
          error:
            "Access to the redirect URL is restricted for security reasons",
        },
        { status: 403, headers: corsHeaders },
      );
    }

    if (error instanceof TooManyRedirectsError) {
      return NextResponse.json(
        { error: "Too many redirects" },
        { status: 400, headers: corsHeaders },
      );
    }

    console.error("Extract error:", error);
    return NextResponse.json(
      { error: "Failed to extract content" },
      { status: 500, headers: corsHeaders },
    );
  }
}

// Configure undici agent for custom fetch behavior
import { Agent, setGlobalDispatcher } from "undici";

// Custom DNS lookup function that checks each resolved IP to prevent DNS rebinding (TOCTOU)
const customLookup = (
  hostname: string,
  options: dns.LookupOptions,
  callback: (err: NodeJS.ErrnoException | null, address: any, family: number) => void
) => {
  dns.lookup(hostname, options, (err, address, family) => {
    if (err) return callback(err, address, family);

    let isSafe = true;

    // Check if the resolved address is safe
    if (Array.isArray(address)) {
      for (const item of address) {
        try {
          const ip = ipaddr.parse(item.address);
          if (ip.range() !== "unicast") {
            isSafe = false;
            break;
          }
        } catch {
          isSafe = false;
          break;
        }
      }
    } else {
      try {
        const ip = ipaddr.parse(address as unknown as string);
        if (ip.range() !== "unicast") {
          isSafe = false;
        }
      } catch {
        isSafe = false;
      }
    }

    if (!isSafe) {
      const blockError = new Error("SSRF blocked: Hostname resolved to unsafe IP during fetch");
      blockError.name = "SSRFBlockedError";
      return callback(blockError as NodeJS.ErrnoException, address, family);
    }

    callback(null, address, family);
  });
};

const agentOptions: any = {
  connect: {
    lookup: customLookup,
  },
};

// In test/CI environments, we might need to ignore SSL errors for internal services or proxies
if (process.env.NODE_ENV === "test" || process.env.CI === "true") {
  agentOptions.connect.rejectUnauthorized = false;
}

// Initialize global dispatcher using the agent with our custom lookup
const agent = new Agent(agentOptions);
setGlobalDispatcher(agent);


/**
 * タイムアウト付きでURLをフェッチ
 * Vercelのサーバーレス関数は10秒制限があるため、8秒に設定
 *
 * NOTE: SSRF保護のため、リダイレクトは手動で処理し、ホップごとに `isSafeUrl` をチェックします。
 */
async function fetchWithTimeout(
  url: string,
  timeout: number = 8000,
): Promise<string> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  const maxRedirects = 5;
  let currentUrl = url;
  let redirectCount = 0;

  try {
    while (redirectCount < maxRedirects) {
      // Use standard fetch (which now respects global dispatcher in Node 18+)
      const response = await fetch(currentUrl, {
        signal: controller.signal,
        redirect: "manual", // 自動リダイレクトを無効化
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        },
        // @ts-ignore - duplex is needed for some fetch implementations but not in standard type
        duplex: "half",
      });

      // 認証が必要なサイトの場合は専用エラーをスロー
      if (response.status === 401 || response.status === 403) {
        throw new AuthenticationRequiredError(
          `このURLには認証が必要です（HTTP ${response.status}）`,
          response.status,
        );
      }

      // リダイレクト処理
      if (response.status >= 300 && response.status < 400) {
        // レスポンスボディを破棄してリソースを解放
        // biome-ignore lint/suspicious/noExplicitAny: response.body might be missing in some environments
        await response.body?.cancel();

        const location = response.headers.get("Location");
        if (!location) {
          throw new Error(
            `HTTP ${response.status} Redirect without Location header`,
          );
        }

        // 相対パスの場合は絶対パスに変換
        const nextUrlObj = new URL(location, currentUrl);
        const nextUrl = nextUrlObj.toString();

        // SSRFチェック（リダイレクト先もチェック）
        if (!(await isSafeUrl(nextUrl))) {
          console.warn("[Extract API] Blocked unsafe redirect to:", nextUrl);
          throw new SSRFBlockedError(
            "Access to the redirect URL is restricted for security reasons",
          );
        }

        currentUrl = nextUrl;
        redirectCount++;
        continue;
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.text();
    }

    throw new TooManyRedirectsError("Too many redirects");
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new TimeoutError("Fetch timeout");
    }
    // Convert fetch custom lookup error to SSRFBlockedError if applicable
    if (error instanceof Error && (error.name === "SSRFBlockedError" || (error.cause && (error.cause as Error).name === "SSRFBlockedError"))) {
       throw new SSRFBlockedError("Access to the redirect URL is restricted for security reasons");
    }
    throw error;
  } finally {
    clearTimeout(id);
  }
}

class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TimeoutError";
  }
}

class AuthenticationRequiredError extends Error {
  statusCode: number;
  constructor(message: string, statusCode: number = 403) {
    super(message);
    this.name = "AuthenticationRequiredError";
    this.statusCode = statusCode;
  }
}

class SSRFBlockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SSRFBlockedError";
  }
}

class TooManyRedirectsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TooManyRedirectsError";
  }
}
