import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { hashEmail } from "@/lib/emailHash";

interface ArticleStatsRequest {
  articleHash: string;
  url: string;
  title: string;
  domain: string;
  cacheHits: number;
  cacheMisses: number;
  isFullyCached: boolean;
}

interface ArticleStatsResponse {
  success: boolean;
  accessCount: number;
  cacheHitRate: number;
}

/**
 * POST /api/stats/article
 * 記事アクセス統計を記録
 */
export async function POST(request: NextRequest) {
  try {
    // セッション認証
    const session = await auth();
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // リクエストボディの検証（型チェック含む）
    const body: ArticleStatsRequest = await request.json();
    const {
      articleHash,
      url,
      title,
      domain,
      cacheHits,
      cacheMisses,
      isFullyCached,
    } = body;

    // すべての必須フィールドを検証
    if (
      !articleHash ||
      !url ||
      !title ||
      !domain ||
      typeof cacheHits !== "number" ||
      typeof cacheMisses !== "number" ||
      typeof isFullyCached !== "boolean"
    ) {
      return NextResponse.json(
        { error: "Missing or invalid required fields" },
        { status: 400 },
      );
    }

    // メールアドレスをハッシュ化（ユーザー識別用）
    const userHash = hashEmail(session.user.email);

    // キャッシュヒット率を計算
    const totalRequests = cacheHits + cacheMisses;
    const cacheHitRate = totalRequests > 0 ? cacheHits / totalRequests : 0;

    // Supabase RPC関数を呼び出し
    const { data, error } = await supabase.rpc("increment_article_stats", {
      p_article_hash: articleHash,
      p_user_id_hash: userHash,
      p_url: url,
      p_title: title,
      p_domain: domain,
      p_cache_hits: cacheHits,
      p_cache_misses: cacheMisses,
      p_is_fully_cached: isFullyCached,
    });

    if (error) {
      console.error("Supabase RPC error:", error);
      return NextResponse.json(
        { error: "Failed to record stats" },
        { status: 500 },
      );
    }

    // レスポンス作成
    const response: ArticleStatsResponse = {
      success: true,
      accessCount: data?.access_count || 1,
      cacheHitRate: parseFloat((cacheHitRate * 100).toFixed(2)),
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error("Stats recording error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
