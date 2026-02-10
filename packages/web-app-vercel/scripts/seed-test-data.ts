import { createClient } from "@supabase/supabase-js";
import { createHash } from "crypto";
import { config } from "dotenv";
import { resolve } from "path";
import { readFileSync } from "fs";

// .env.test.local を読み込む
config({ path: resolve(__dirname, "../.env.test.local") });
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

if (!supabaseUrl || !supabaseServiceKey) {
    console.error("❌ 環境変数が設定されていません");
    console.error("📝 .env.test.local ファイルを作成して以下を設定してください：");
    console.error("   NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co");
    console.error("   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const TEST_USER_ID = "test-user-id-123";
const TEST_USER_EMAIL = process.env.TEST_USER_EMAIL || "test@example.com";

console.log(`[SEED] Using TEST_USER_EMAIL: ${TEST_USER_EMAIL}`);

async function runMigrations() {
    console.log("マイグレーションを実行中...");

    // articles テーブルの制約を修正
    // owner_email, url の複合ユニーク制約が必要
    const migrationSql = `
        -- Drop existing constraint if exists (ignore error if not exists)
        DO $$ BEGIN
            ALTER TABLE public.articles DROP CONSTRAINT IF EXISTS articles_url_key;
        EXCEPTION WHEN others THEN NULL; END $$;
        
        -- Add composite unique constraint (ignore if already exists)
        DO $$ BEGIN
            ALTER TABLE public.articles ADD CONSTRAINT articles_owner_email_url_key UNIQUE (owner_email, url);
        EXCEPTION WHEN duplicate_table THEN NULL; END $$;
        
        -- Ensure playlist_items has correct constraint
        DO $$ BEGIN
            ALTER TABLE public.playlist_items DROP CONSTRAINT IF EXISTS playlist_items_playlist_id_article_id_key;
        EXCEPTION WHEN others THEN NULL; END $$;
        
        DO $$ BEGIN
            ALTER TABLE public.playlist_items ADD CONSTRAINT playlist_items_playlist_id_article_id_key UNIQUE (playlist_id, article_id);
        EXCEPTION WHEN duplicate_table THEN NULL; END $$;
    `;

    const { error } = await supabase.rpc('exec_sql', { sql: migrationSql }).single();

    // exec_sql RPC がない場合は直接SQLを実行（Supabase Dashboard経由で手動実行が必要な場合あり）
    if (error) {
        console.log("⚠️ RPC経由でのマイグレーション実行に失敗。直接クエリを試行...");
        console.log("   エラー:", error.message);

        // 代替: 個別のクエリで試行
        try {
            // 既存の制約を確認
            const { data: constraints } = await supabase
                .from('articles')
                .select('id')
                .limit(1);

            if (constraints !== null) {
                console.log("✓ articles テーブルにアクセス可能");
            }
        } catch (e) {
            console.log("⚠️ マイグレーションの手動実行が必要かもしれません");
        }
    } else {
        console.log("✓ マイグレーションを完了しました");
    }
}

async function seedTestData() {
    console.log("テストデータの投入を開始します...");

    // マイグレーションを先に実行
    await runMigrations();

    // 1. テストユーザーの設定
    console.log("1. ユーザー設定を作成中...");
    const { error: userError } = await supabase
        .from("user_settings")
        .upsert({
            user_id: TEST_USER_ID,
            playback_speed: 1.0,
            voice_model: "ja-JP-Standard-B",
            language: "ja-JP",
            color_theme: "ocean",
        });

    if (userError) {
        console.error("ユーザー設定の作成に失敗:", userError);
        process.exit(1);
    }

    console.log("✓ ユーザー設定を作成しました");

    // 2. テスト記事の作成（E2Eで必要な件数を確保）
    console.log("2. テスト記事を作成中...");
    const articles = [
        // E2Eテスト用の固定記事（Apple, Banana, Cherry）
        // 抽出処理が成功するように、実際に存在するURL（example.comのルート）を使用し、クエリパラメータで識別する
        {
            owner_email: TEST_USER_EMAIL,
            url: "https://example.com/?id=apple",
            title: "Apple",
            thumbnail_url: "https://via.placeholder.com/300",
        },
        {
            owner_email: TEST_USER_EMAIL,
            url: "https://example.com/?id=banana",
            title: "Banana",
            thumbnail_url: "https://via.placeholder.com/300",
        },
        {
            owner_email: TEST_USER_EMAIL,
            url: "https://example.com/?id=cherry",
            title: "Cherry",
            thumbnail_url: "https://via.placeholder.com/300",
        },
        // その他の記事
        {
            owner_email: TEST_USER_EMAIL,
            url: "https://example.com/article-1",
            title: "テスト記事1",
            thumbnail_url: "https://via.placeholder.com/300",
        },
        {
            owner_email: TEST_USER_EMAIL,
            url: "https://example.com/article-2",
            title: "テスト記事2",
            thumbnail_url: "https://via.placeholder.com/300",
        },
        {
            owner_email: TEST_USER_EMAIL,
            url: "https://example.com/popular-1",
            title: "人気記事1 - TypeScript入門",
            thumbnail_url: "https://via.placeholder.com/300",
        },
        {
            owner_email: TEST_USER_EMAIL,
            url: "https://example.com/popular-2",
            title: "人気記事2 - Next.js完全ガイド",
            thumbnail_url: "https://via.placeholder.com/300",
        },
        {
            owner_email: TEST_USER_EMAIL,
            url: "https://example.com/popular-3",
            title: "人気記事3 - Supabase実践",
            thumbnail_url: "https://via.placeholder.com/300",
        },
    ];

    // select + insert/update パターンで記事を作成（upsertを避ける）
    interface Article {
        id: string;
        owner_email: string;
        url: string;
        title: string;
        thumbnail_url: string;
    }
    const createdArticles: Article[] = [];
    for (const article of articles) {
        // 既存の記事を検索
        const { data: existing } = await supabase
            .from("articles")
            .select()
            .eq("url", article.url)
            .single();

        if (existing) {
            // 既存の記事を更新
            const { data: updated, error: updateError } = await supabase
                .from("articles")
                .update({
                    owner_email: article.owner_email,
                    title: article.title,
                    thumbnail_url: article.thumbnail_url,
                })
                .eq("id", existing.id)
                .select()
                .single();

            if (updateError) {
                console.error("記事の更新に失敗:", updateError);
                process.exit(1);
            }
            if (updated) createdArticles.push(updated);
        } else {
            // 新規作成
            const { data: created, error: createError } = await supabase
                .from("articles")
                .insert(article)
                .select()
                .single();

            if (createError) {
                console.error("記事の作成に失敗:", createError);
                process.exit(1);
            }
            if (created) createdArticles.push(created);
        }
    }

    if (createdArticles.length === 0) {
        console.error("記事の作成に失敗: 作成された記事がありません");
        process.exit(1);
    }
    console.log(`✓ ${createdArticles.length}件の記事を作成しました`);

    // 3. 人気記事の統計データを作成（access_count >= 5）
    console.log("3. 人気記事の統計データを作成中...");
    const popularArticles = createdArticles.slice(2);
    const fixedAccessCounts = [15, 20, 25];

    const statsData = popularArticles.map((article, i) => {
        const articleHash = createHash("sha256").update(article.url).digest("hex");
        return {
            article_hash: articleHash,
            url: article.url,
            title: article.title,
            domain: "example.com",
            access_count: fixedAccessCounts[i] ?? 10,
            unique_users: 10,
            cache_hit_rate: 0.85,
            is_fully_cached: true,
            last_accessed_at: new Date().toISOString(),
        };
    });

    if (statsData.length > 0) {
        const { error: statsError } = await supabase
            .from("article_stats")
            .upsert(statsData, { onConflict: "article_hash" });

        if (statsError) {
            console.error("統計データの作成に失敗:", statsError);
            process.exit(1);
        }
    }

    console.log(
        `✓ 人気記事の統計データを作成しました（${popularArticles.length}件，access_count: ${fixedAccessCounts.join(", ")}）`
    );

    // 4. 音声キャッシュインデックス
    console.log("4. 音声キャッシュインデックスを作成中...");

    const cacheIndexData = popularArticles.map((article, i) => ({
        article_url: article.url,
        voice: "ja-JP",
        cached_chunks: ["chunk-1", "chunk-2"],
        completed_playback: true,
        read_count: 5 + i,
    }));

    if (cacheIndexData.length > 0) {
        const { error: cacheError } = await supabase
            .from("audio_cache_index")
            .upsert(cacheIndexData, { onConflict: "article_url,voice" });

        if (cacheError) {
            console.error("キャッシュインデックスの作成に失敗:", cacheError);
            process.exit(1);
        }
    }
    console.log("✓ 音声キャッシュインデックスを作成しました");

    // 5. デフォルトプレイリストの作成
    console.log("5. デフォルトプレイリストを作成中...");

    await supabase
        .from("playlists")
        .delete()
        .eq("owner_email", TEST_USER_EMAIL)
        .eq("is_default", true);

    const { data: defaultPlaylist, error: playlistError } = await supabase
        .from("playlists")
        .insert({
            owner_email: TEST_USER_EMAIL,
            name: "デフォルトプレイリスト",
            description: "テスト用デフォルトプレイリスト",
            is_default: true,
            visibility: "private",
        })
        .select()
        .single();

    if (playlistError || !defaultPlaylist) {
        console.error("プレイリストの作成に失敗:", playlistError);
        process.exit(1);
    }
    console.log("✓ デフォルトプレイリストを作成しました");

    // 6. プレイリストアイテムの追加（3件）
    console.log("6. プレイリストアイテムを追加中...");

    const playlistItems = [];
    for (let i = 0; i < 3 && i < createdArticles.length; i += 1) {
        const article = createdArticles[i];
        playlistItems.push({
            playlist_id: defaultPlaylist.id,
            article_id: article.id,
            position: i,
        });
    }

    if (playlistItems.length > 0) {
        const { error: itemError } = await supabase.from("playlist_items").insert(playlistItems);

        if (itemError) {
            console.error("プレイリストアイテムの追加に失敗:", itemError);
            process.exit(1);
        }
    }
    console.log("✓ プレイリストアイテムを追加しました");

    console.log("\n✅ テストデータの投入が完了しました！");
    console.log(`   - ユーザー: ${TEST_USER_EMAIL}`);
    console.log(`   - 記事: ${createdArticles.length}件`);
    console.log(`   - 人気記事: ${popularArticles.length}件`);
    console.log("   - プレイリスト: 1件（3記事含む）");
}

seedTestData().catch((error) => {
    console.error("エラーが発生しました:", error);
    process.exit(1);
});
