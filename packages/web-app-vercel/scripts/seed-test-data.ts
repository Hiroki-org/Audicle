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

// Disable native fetch behavior if the CI environment is overriding DNS poorly.
// Since undici fetch fails on some CI due to DNS: getaddrinfo ENOTFOUND.
const customFetch = async (url: string | URL | Request, init?: RequestInit): Promise<Response> => {
    let retries = 5;
    let delay = 2000;
    while (true) {
        try {
            return await globalThis.fetch(url, init);
        } catch (error: any) {
            if (retries <= 0 || !error.message || (!error.message.includes("fetch") && !error.message.includes("ENOTFOUND") && !error.message.includes("ECONNREFUSED"))) {
                throw error;
            }
            console.log(`[SEED] Fetch failed (${error.message}). Retrying in ${delay}ms... (${retries} attempts left)`);
            await new Promise(res => setTimeout(res, delay));
            retries--;
            delay *= 2; // Exponential backoff
        }
    }
};

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
    },
    global: {
        fetch: customFetch as any
    }
});

const TEST_USER_EMAIL = process.env.TEST_USER_EMAIL || "test@example.com";
const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD || "password";

console.log(`[SEED] Using TEST_USER_EMAIL: ${TEST_USER_EMAIL}`);

// Retry wrapper for supabase admin calls that might not use the custom fetch directly
async function retryWithBackoff<T>(operation: () => Promise<T>, maxRetries = 5, baseDelay = 2000): Promise<T> {
    let retries = 0;
    while (true) {
        try {
            return await operation();
        } catch (error: any) {
            if (retries >= maxRetries) {
                throw error;
            }
            // Check if it's a fetch/network error
            if (error.message && (error.message.includes('fetch') || error.message.includes('ENOTFOUND') || error.message.includes('ECONNREFUSED') || error.message.includes('fetch failed'))) {
                const delay = baseDelay * Math.pow(2, retries);
                console.log(`[SEED] Network error detected: ${error.message}. Retrying in ${delay}ms... (${retries + 1}/${maxRetries})`);
                await new Promise(res => setTimeout(res, delay));
                retries++;
            } else {
                throw error; // If it's a regular API error (like 400 Bad Request), don't retry.
            }
        }
    }
}

async function ensureTestUser() {
    console.log(`[SEED] Ensuring auth user for ${TEST_USER_EMAIL}...`);
    // Try to create user
    const { data, error } = await retryWithBackoff(async () => {
        return await supabase.auth.admin.createUser({
            email: TEST_USER_EMAIL,
            password: TEST_USER_PASSWORD,
            email_confirm: true
        });
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
                const { data: listData, error: listError } = await retryWithBackoff(async () => {
                    return await supabase.auth.admin.listUsers({
                        page: page,
                        perPage: perPage
                    });
                });
                
                if (listError) {
                    console.error("   Failed to list users:", listError);
                    process.exit(1);
                }
                
                foundUser = listData.users.find((u: any) => u.email === TEST_USER_EMAIL);
                
                if (!foundUser) {
                    if (listData.users.length < perPage) {
                        // Reached the end of the list
                        break;
                    }
                    page++;
                }
            }
            
            if (foundUser) {
                console.log(`   Found existing user ID: ${foundUser.id}`);
                return foundUser.id;
            } else {
                console.error("   User marked as already registered but could not be found in the user list.");
                process.exit(1);
            }
        }

        console.error("Failed to create test user:", error);
        process.exit(1);
    }

    if (!data?.user) {
        console.error("User creation succeeded but no user returned");
        process.exit(1);
    }

    console.log(`   Created new user ID: ${data.user.id}`);
    return data.user.id;
}

const getArticleHash = (text: string) => {
    return createHash("sha256").update(text).digest("hex");
};

async function runMigrations() {
    console.log("マイグレーションの実行を確認中...");

    // Check if articles table exists (as a proxy for migrations)
    const { error } = await retryWithBackoff(async () => {
        return await supabase
            .from("articles")
            .select("id")
            .limit(1);
    });

    if (error) {
        console.log("テーブルが見つからないかエラーが発生しました。");
        console.log("Supabaseのローカル環境を起動しているか確認してください:");
        console.log("npx supabase start");
        console.log("npx supabase db push");

        // Wait for user to potentially run migrations manually
        console.log("マイグレーションが完了するのを待ちます (5秒)...");
        await new Promise(resolve => setTimeout(resolve, 5000));

        // Second check
        try {
            const { error: secondCheckError } = await retryWithBackoff(async () => {
                return await supabase
                    .from("articles")
                    .select("id")
                    .limit(1);
            });
            if (secondCheckError) {
                console.warn("⚠️ まだエラーが発生しています。シードを続行しますが、失敗する可能性があります。");
            } else {
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

    // 0. ユーザーIDの確保
    const TEST_USER_ID = await ensureTestUser();
    
    // マイグレーションを先に実行
    await runMigrations();

    // 1. テストユーザーの設定
    console.log("1. ユーザー設定を作成中...");
    const { error: userError } = await retryWithBackoff(async () => {
        return await supabase
            .from("user_settings")
            .upsert({
                user_id: TEST_USER_ID,
                playback_speed: 1.0,
                voice_model: "ja-JP-Standard-B",
                language: "ja-JP",
                color_theme: "ocean",
            });
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
        {
            owner_email: TEST_USER_EMAIL,
            url: "https://example.com/article-apple",
            title: "Apple Ecosystem Basics",
            text_content: "Apple provides a seamless ecosystem between iOS, iPadOS, and macOS. Continuity features make it easy.",
            thumbnail_url: "https://example.com/apple.jpg",
            domain_name: "example.com",
            favicon_url: "https://example.com/favicon.ico",
        },
        {
            owner_email: TEST_USER_EMAIL,
            url: "https://example.com/article-banana",
            title: "Banana Nutrition Guide",
            text_content: "Bananas are high in potassium and provide quick energy for athletes. They are easy to digest.",
            thumbnail_url: "https://example.com/banana.jpg",
            domain_name: "example.com",
            favicon_url: "https://example.com/favicon.ico",
        },
        {
            owner_email: TEST_USER_EMAIL,
            url: "https://example.com/article-cherry",
            title: "Cherry Picking Best Practices",
            text_content: "When picking cherries, look for firm, bright fruits. Leave the stems on to preserve freshness.",
            thumbnail_url: "https://example.com/cherry.jpg",
            domain_name: "example.com",
            favicon_url: "https://example.com/favicon.ico",
        },
        // 人気記事テスト用の記事（11件以上）
        ...Array.from({ length: 15 }).map((_, i) => ({
            owner_email: TEST_USER_EMAIL,
            url: `https://example.com/popular-${i + 1}`,
            title: `Popular Topic ${i + 1}`,
            text_content: `This is a popular article content ${i + 1}.`.repeat(10),
            thumbnail_url: `https://example.com/popular${i + 1}.jpg`,
            domain_name: "example.com",
            favicon_url: "https://example.com/favicon.ico",
        })),
    ];

    // 全ての記事にIDを付与
    type Article = {
        id?: string;
        owner_email: string;
        url: string;
        title: string;
        text_content: string;
        thumbnail_url: string;
        domain_name: string;
        favicon_url: string;
    };

    const urls = articles.map(a => a.url);

    const emails = Array.from(new Set(articles.map(a => a.owner_email)));
    // 既存の記事を一括検索 (urlとowner_emailでフィルタ)
    const { data: existingData, error: selectError } = await retryWithBackoff(async () => {
        return await supabase
            .from("articles")
            .select()
            .in("url", urls)
            .in("owner_email", emails);
    });

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

    // 各記事を振り分け
    for (const article of articles) {
        const key = article.owner_email + "||" + article.url;
        const existing = existingMap.get(key);
        if (existing) {
            // Update mode: map the ID to the existing record
            toUpdate.push(article);
        } else {
            toInsert.push(article);
        }
    }

    const createdArticlesMap = new Map<string, Article>();

    // 新規記事を一括作成
    if (toInsert.length > 0) {
        const { data: created, error: createError } = await retryWithBackoff(async () => {
            return await supabase
                .from("articles")
                .insert(toInsert)
                .select();
        });

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
            if (!existing) return null;

            return {
                id: existing.id,
                owner_email: article.owner_email,
                title: article.title,
                thumbnail_url: article.thumbnail_url,
                url: article.url, // required if we are mapping createdArticlesMap with url below
            };
        }).filter((item) => item !== null) as { id: string; owner_email: string; title: string; thumbnail_url: string; url: string }[];

        const { data: updatedItems, error: updateError } = await retryWithBackoff(async () => {
            return await supabase
                .from("articles")
                .upsert(batchUpdateData, { onConflict: "id" })
                .select();
        });

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
        if (created) {
             // 重複追加を防ぐ (articles配列内に同じものがある場合)
            if(!addedKeys.has(key)){
                createdArticles.push(created);
                addedKeys.add(key);
            }
        }
    }
    console.log(`✓ ${createdArticles.length}件のテスト記事を作成/更新しました`);

    // 3. 人気記事の統計データを作成
    console.log("3. 人気記事の統計データを作成中...");
    const popularArticles = createdArticles.filter((a) => a.url.includes("popular"));

    // テスト用にアクセス数を固定（降順）
    const fixedAccessCounts = [1500, 1200, 1000, 800, 600, 500, 400, 300, 200, 150, 100, 80, 50, 30, 10];

    if (popularArticles.length > 0) {
        const now = new Date().toISOString();
        const statsData = popularArticles.map((article, i) => {
            const accessCount = fixedAccessCounts[i] || 1;
            return {
                article_url: article.url,
                article_hash: getArticleHash(article.url),
                title: article.title,
                domain_name: article.domain_name,
                thumbnail_url: article.thumbnail_url,
                favicon_url: article.favicon_url,
                access_count: accessCount,
                is_fully_cached: true,
                last_accessed_at: now,
            };
        });

        const { error: statsError } = await retryWithBackoff(async () => {
            return await supabase
                .from("article_stats")
                .upsert(statsData, { onConflict: "article_hash" });
        });

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

        const { error: cacheError } = await retryWithBackoff(async () => {
            return await supabase
                .from("audio_cache_index")
                .upsert(cacheData, { onConflict: "article_url,voice" });
        });

        if (cacheError) {
            console.error("キャッシュインデックスの作成に失敗:", cacheError);
            process.exit(1);
        }
    }
    console.log("✓ 音声キャッシュインデックスを作成しました");

    // 5. デフォルトプレイリストの作成
    console.log("5. デフォルトプレイリストを作成中...");

    const { data: existingDefaultPlaylists, error: existingDefaultPlaylistsError } = await retryWithBackoff(async () => {
        return await supabase
            .from("playlists")
            .select("id")
            .eq("owner_email", TEST_USER_EMAIL)
            .eq("is_default", true);
    });

    if (existingDefaultPlaylistsError) {
        console.error("既存プレイリストの取得に失敗:", existingDefaultPlaylistsError);
        process.exit(1);
    }

    const existingDefaultPlaylistIds = existingDefaultPlaylists?.map((playlist) => playlist.id) ?? [];
    if (existingDefaultPlaylistIds.length > 0) {
        const { error: itemsDeleteError } = await retryWithBackoff(async () => {
            return await supabase
                .from("playlist_items")
                .delete()
                .in("playlist_id", existingDefaultPlaylistIds);
        });
        if (itemsDeleteError) {
            console.error("プレイリストアイテムの削除に失敗:", itemsDeleteError);
            process.exit(1);
        }
    }

    const { error: playlistsDeleteError } = await retryWithBackoff(async () => {
        return await supabase
            .from("playlists")
            .delete()
            .eq("owner_email", TEST_USER_EMAIL)
            .eq("is_default", true);
    });

    if (playlistsDeleteError) {
        console.error("既存プレイリストの削除に失敗:", playlistsDeleteError);
        process.exit(1);
    }

    const { data: defaultPlaylist, error: playlistError } = await retryWithBackoff(async () => {
        return await supabase
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
    });

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
        const { error: itemError } = await retryWithBackoff(async () => {
            return await supabase.from("playlist_items").insert(defaultPlaylistItems);
        });

        if (itemError) {
            console.error("プレイリストアイテムの追加に失敗:", itemError);
            process.exit(1);
        }
    }
    console.log("✓ プレイリストアイテムを追加しました");

    // 7. ソートテスト用プレイリストの作成
    console.log("7. ソートテスト用プレイリストを作成中...");

    await retryWithBackoff(async () => {
        return await supabase
            .from("playlists")
            .delete()
            .eq("owner_email", TEST_USER_EMAIL)
            .eq("name", "ソートテスト用プレイリスト");
    });

    const { data: sortTestPlaylist, error: sortPlaylistError } = await retryWithBackoff(async () => {
        return await supabase
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
    });

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
        const { error: itemError } = await retryWithBackoff(async () => {
            return await supabase.from("playlist_items").insert(sortTestPlaylistItems);
        });

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
