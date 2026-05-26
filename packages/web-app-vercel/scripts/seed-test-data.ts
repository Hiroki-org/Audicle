import { createClient } from "@supabase/supabase-js";
import { createHash } from "crypto";
import { config } from "dotenv";
import { resolve } from "path";

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

const TEST_USER_EMAIL = process.env.TEST_USER_EMAIL || "test@example.com";
const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD || "password";

console.log(`[SEED] Using TEST_USER_EMAIL: ${TEST_USER_EMAIL}`);

async function ensureTestUser() {
    console.log(`[SEED] Ensuring auth user for ${TEST_USER_EMAIL}...`);

    // Check if we're in a CI environment with placeholder URL
    if (supabaseUrl.includes('your-project-id') || supabaseUrl.includes('ohoaxvgkwnrljmxqrggo.supabase.co') || process.env.CI === 'true') {
        console.log("   Skipping actual user creation due to placeholder database URL / CI environment.");
        return "placeholder-user-id";
    }

    // Try to create user
    const { data, error } = await supabase.auth.admin.createUser({
        email: TEST_USER_EMAIL,
        password: TEST_USER_PASSWORD,
        email_confirm: true
    });

    if (error) {
        // If user already exists, we try to find their ID
        const isAlreadyRegistered = error.status === 422 || error.message?.includes("already registered") || error.code?.includes("email_exists");
        
        if (isAlreadyRegistered) {
            console.log("   User already exists. Fetching ID by listing users...");
            
            // Pagination handling to find user
            let page = 1;
            const perPage = 50;
            let foundUser = null;
            
            while (!foundUser) {
                const { data: listData, error: listError } = await supabase.auth.admin.listUsers({
                    page: page,
                    perPage: perPage
                });
                
                if (listError) {
                    throw new Error(`Failed to list users to find existing one: ${listError.message}`);
                }
                
                if (!listData.users || listData.users.length === 0) {
                    break; // No more users
                }
                
                foundUser = listData.users.find(u => u.email === TEST_USER_EMAIL);
                
                if (foundUser) {
                    console.log(`   Found existing user ID: ${foundUser.id}`);
                    return foundUser.id;
                }

                // If we got fewer users than perPage, we're on the last page
                if (listData.users.length < perPage) {
                    break;
                }
                
                // Safety break to prevent infinite loops if we have thousands of users (unlikely in test)
                if (page > 20) {
                    break; 
                }
                page++;
            }
            
            throw new Error(`User ${TEST_USER_EMAIL} reportedly exists but was not found in user list after checking ${page} pages`);
        }
        throw error;
    }
    console.log(`   Created new user ID: ${data.user.id}`);
    return data.user.id;
}

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
        } catch {
            console.log("⚠️ マイグレーションの手動実行が必要かもしれません");
        }
    } else {
        console.log("✓ マイグレーションを完了しました");
    }
}

async function seedTestData() {
    console.log("テストデータの投入を開始します...");

    if (supabaseUrl.includes('your-project-id') || supabaseUrl.includes('ohoaxvgkwnrljmxqrggo.supabase.co')) {
        console.log("   [CI/Placeholder] Dummy Supabase URL detected, skipping database seeding entirely.");
        return;
    }

    // 0. ユーザーIDの確保
    const TEST_USER_ID = await ensureTestUser();
    
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
            url: "https://example.com/?id=apple", // root is 200 OK
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
            url: "https://example.com/?id=article-1",
            title: "テスト記事1",
            thumbnail_url: "https://via.placeholder.com/300",
        },
        {
            owner_email: TEST_USER_EMAIL,
            url: "https://example.com/?id=article-2",
            title: "テスト記事2",
            thumbnail_url: "https://via.placeholder.com/300",
        },
        {
            owner_email: TEST_USER_EMAIL,
            url: "https://example.com/?id=popular-1",
            title: "人気記事1 - TypeScript入門",
            thumbnail_url: "https://via.placeholder.com/300",
        },
        {
            owner_email: TEST_USER_EMAIL,
            url: "https://example.com/?id=popular-2",
            title: "人気記事2 - Next.js完全ガイド",
            thumbnail_url: "https://via.placeholder.com/300",
        },
        {
            owner_email: TEST_USER_EMAIL,
            url: "https://example.com/?id=popular-3",
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
    const urls = articles.map(a => a.url);

    const emails = Array.from(new Set(articles.map(a => a.owner_email)));
    // 既存の記事を一括検索 (urlとowner_emailでフィルタ)
    const { data: existingData, error: selectError } = await supabase
        .from("articles")
        .select()
        .in("url", urls)
        .in("owner_email", emails);

    if (selectError) {
        console.error("記事の検索に失敗:", selectError);
        process.exit(1);
    }

    const existingArticles = existingData || [];

    // (owner_email, url)をキーにした既存記事のマップを作成
    const existingMap = new Map();
    for (const existing of existingArticles) {
        existingMap.set(existing.owner_email + "||" + existing.url, existing);
    }

    const toInsert: typeof articles = [];
    const toUpdate: typeof articles = [];

    // 重複を避けるためのSet (owner_email + url)
    const processedKeys = new Set();

    for (const article of articles) {
        const key = article.owner_email + "||" + article.url;
        if (processedKeys.has(key)) continue;
        processedKeys.add(key);

        const existing = existingMap.get(key);
        if (existing) {
            toUpdate.push(article);
        } else {
            toInsert.push(article);
        }
    }

    const createdArticlesMap = new Map<string, Article>();

    // 新規記事を一括作成
    if (toInsert.length > 0) {
        const { data: created, error: createError } = await supabase
            .from("articles")
            .insert(toInsert)
            .select();

        if (createError) {
            console.error("記事の一括作成に失敗:", createError);
            process.exit(1);
        }
        if (created) {
            for (const c of created) {
                createdArticlesMap.set(c.owner_email + "||" + c.url, c as Article);
            }
        }
    }

    // 既存記事を更新
    if (toUpdate.length > 0) {
        const batchUpdateData = toUpdate.map((article) => {
            const key = article.owner_email + "||" + article.url;
            const existing = existingMap.get(key);

            if (!existing) {
                // This shouldn't happen due to the logic above, but added for safety and TS
                return null;
            }

            return {
                id: existing.id,
                owner_email: article.owner_email,
                title: article.title,
                thumbnail_url: article.thumbnail_url,
                url: article.url, // required if we are mapping createdArticlesMap with url below
            };
        }).filter((item) => item !== null) as { id: string; owner_email: string; title: string; thumbnail_url: string; url: string }[];

        const { data: updatedItems, error: updateError } = await supabase
            .from("articles")
            .upsert(batchUpdateData, { onConflict: "id" })
            .select();

        if (updateError) {
            console.error("記事の更新に失敗:", updateError);
            process.exit(1);
        }

        if (updatedItems) {
            for (const updated of updatedItems) {
                createdArticlesMap.set(updated.owner_email + "||" + updated.url, updated as Article);
            }
        }
    }

    // 元の配列の順序を維持して結果を構築
    const createdArticles: Article[] = [];
    const addedKeys = new Set<string>();

    for (const article of articles) {
        const key = article.owner_email + "||" + article.url;
        const created = createdArticlesMap.get(key);
        // 重複を防ぐ (O(1)のSetでチェック)
        if (created && !addedKeys.has(key)) {
            createdArticles.push(created);
            addedKeys.add(key);
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

    if (popularArticles.length > 0) {
        const now = new Date().toISOString();
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
                last_accessed_at: now,
            };
        });

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
    if (popularArticles.length > 0) {
        const now = new Date().toISOString();
        const cacheData = popularArticles.map((article, i) => ({
            article_url: article.url,
            voice: "ja-JP",
            cached_chunks: ["chunk-1", "chunk-2"],
            completed_playback: true,
            read_count: 5 + i,
            last_accessed: now,
        }));

        const { error: cacheError } = await supabase
            .from("audio_cache_index")
            .upsert(cacheData, { onConflict: "article_url,voice" });

        if (cacheError) {
            console.error("キャッシュインデックスの作成に失敗:", cacheError);
            process.exit(1);
        }
    }
    console.log("✓ 音声キャッシュインデックスを作成しました");

    // 5. デフォルトプレイリストの作成
    console.log("5. デフォルトプレイリストを作成中...");

    const { data: existingDefaultPlaylists, error: existingDefaultPlaylistsError } = await supabase
        .from("playlists")
        .select("id")
        .eq("owner_email", TEST_USER_EMAIL)
        .eq("is_default", true);

    if (existingDefaultPlaylistsError) {
        console.error("既存プレイリストの取得に失敗:", existingDefaultPlaylistsError);
        process.exit(1);
    }

    const existingDefaultPlaylistIds = existingDefaultPlaylists?.map((playlist) => playlist.id) ?? [];
    if (existingDefaultPlaylistIds.length > 0) {
        const { error: itemsDeleteError } = await supabase
            .from("playlist_items")
            .delete()
            .in("playlist_id", existingDefaultPlaylistIds);
        if (itemsDeleteError) {
            console.error("プレイリストアイテムの削除に失敗:", itemsDeleteError);
            process.exit(1);
        }
    }

    const { error: playlistsDeleteError } = await supabase
        .from("playlists")
        .delete()
        .eq("owner_email", TEST_USER_EMAIL)
        .eq("is_default", true);
    if (playlistsDeleteError) {
        console.error("既存プレイリストの削除に失敗:", playlistsDeleteError);
        process.exit(1);
    }

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
    const defaultPlaylistItems = createdArticles.slice(0, 3).map((article, i) => ({
        playlist_id: defaultPlaylist.id,
        article_id: article.id,
        position: i,
    }));

    if (defaultPlaylistItems.length > 0) {
        const { error: itemError } = await supabase.from("playlist_items").insert(defaultPlaylistItems);

        if (itemError) {
            console.error("プレイリストアイテムの追加に失敗:", itemError);
            process.exit(1);
        }
    }
    console.log("✓ プレイリストアイテムを追加しました");

    // 7. ソートテスト用プレイリストの作成
    console.log("7. ソートテスト用プレイリストを作成中...");

    await supabase
        .from("playlists")
        .delete()
        .eq("owner_email", TEST_USER_EMAIL)
        .eq("name", "ソートテスト用プレイリスト");

    const { data: sortTestPlaylist, error: sortPlaylistError } = await supabase
        .from("playlists")
        .insert({
            owner_email: TEST_USER_EMAIL,
            name: "ソートテスト用プレイリスト",
            description: "ソート順序の確認用プレイリスト",
            is_default: false,
            visibility: "private",
        })
        .select()
        .single();

    if (sortPlaylistError || !sortTestPlaylist) {
        console.error("ソートテスト用プレイリストの作成に失敗:", sortPlaylistError);
        process.exit(1);
    }
    console.log("✓ ソートテスト用プレイリストを作成しました");

    // 8. ソートテスト用プレイリストにアイテムを追加
    console.log("8. ソートテスト用プレイリストにアイテムを追加中...");
    const sortTestPlaylistItems = createdArticles.slice(0, 3).map((article, i) => ({
        playlist_id: sortTestPlaylist.id,
        article_id: article.id,
        position: i,
    }));

    if (sortTestPlaylistItems.length > 0) {
        const { error: itemError } = await supabase.from("playlist_items").insert(sortTestPlaylistItems);

        if (itemError) {
            console.error("ソートテスト用プレイリストアイテムの追加に失敗:", itemError);
            process.exit(1);
        }
    }
    console.log("✓ ソートテスト用プレイリストアイテムを追加しました");

    console.log("\n✅ テストデータの投入が完了しました！");
    console.log(`   - ユーザー: ${TEST_USER_EMAIL} (ID: ${TEST_USER_ID})`);
    console.log(`   - 記事: ${createdArticles.length}件`);
    console.log(`   - 人気記事: ${popularArticles.length}件`);
    console.log("   - プレイリスト: 1件（3記事含む）");
}

seedTestData().catch((error) => {
    console.error("エラーが発生しました:", error);
    process.exit(1);
});
