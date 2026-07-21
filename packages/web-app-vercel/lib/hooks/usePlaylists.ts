import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import type { PlaylistWithItems } from "@/types/playlist";

// リトライヘルパー関数
async function retryFetch<T>(fetchFn: () => Promise<Response>, maxRetries: number = 3, delay: number = 1000): Promise<T> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const response = await fetchFn();
            if (!response.ok) {
                throw new Error("プレイリストの取得に失敗しました");
            }
            return response.json() as Promise<T>;
        } catch (error) {
            if (attempt === maxRetries) {
                throw error;
            }
            // ECONNRESET などのネットワークエラー時はリトライ
            const errorMessage = typeof error === 'object' && error !== null ? (error as any).message || (error as any).cause || String(error) : String(error);
            if (errorMessage.includes('ECONNRESET') || errorMessage.includes('aborted') || errorMessage.includes('fetch')) {
                console.warn(`Fetch attempt ${attempt} failed, retrying in ${delay}ms:`, error.message);
                await new Promise(resolve => setTimeout(resolve, delay));
            } else {
                throw error; // ネットワークエラー以外は即座に投げる
            }
        }
    }
    throw new Error('Max retries exceeded');
}

/**
 * プレイリスト一覧を取得
 */
export function usePlaylists() {
    const { data: session } = useSession();
    const userEmail = session?.user?.email;

    return useQuery({
        queryKey: ["playlists", userEmail],
        queryFn: async () => {
            return retryFetch<PlaylistWithItems[]>(() => fetch("/api/playlists"));
        },
        enabled: !!userEmail,
    });
}

/**
 * プレイリスト詳細を取得
 */
export function usePlaylistDetail(playlistId: string) {
    const { data: session } = useSession();
    const userEmail = session?.user?.email;

    return useQuery({
        queryKey: ["playlists", userEmail, playlistId],
        queryFn: async () => {
            return retryFetch<PlaylistWithItems>(() => fetch(`/api/playlists/${playlistId}`));
        },
        enabled: !!playlistId && !!userEmail,
    });
}

/**
 * プレイリスト作成ミューテーション
 */
export function useCreatePlaylistMutation() {
    const { data: session } = useSession();
    const userEmail = session?.user?.email;
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: { name: string; description?: string }) => {
            const response = await fetch("/api/playlists", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });
            if (!response.ok) {
                throw new Error("プレイリストの作成に失敗しました");
            }
            return response.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["playlists", userEmail] });
        },
    });
}

/**
 * プレイリスト削除ミューテーション
 */
export function useDeletePlaylistMutation() {
    const { data: session } = useSession();
    const userEmail = session?.user?.email;
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (playlistId: string) => {
            const response = await fetch(`/api/playlists/${playlistId}`, {
                method: "DELETE",
            });
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || "削除に失敗しました");
            }
            return response.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["playlists", userEmail] });
        },
    });
}

/**
 * プレイリスト更新ミューテーション
 */
export function useUpdatePlaylistMutation() {
    const { data: session } = useSession();
    const userEmail = session?.user?.email;
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: {
            playlistId: string;
            name: string;
            description?: string;
        }) => {
            const response = await fetch(`/api/playlists/${data.playlistId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: data.name,
                    description: data.description,
                }),
            });
            if (!response.ok) {
                throw new Error("プレイリストの更新に失敗しました");
            }
            return response.json();
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ["playlists", userEmail] });
            queryClient.invalidateQueries({
                queryKey: ["playlists", userEmail, variables.playlistId],
            });
        },
    });
}

/**
 * プレイリストからアイテムを削除するミューテーション
 */
export function useRemoveFromPlaylistMutation() {
    const { data: session } = useSession();
    const userEmail = session?.user?.email;
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: { playlistId: string; itemId: string }) => {
            const response = await fetch(
                `/api/playlists/${data.playlistId}/items/${data.itemId}`,
                {
                    method: "DELETE",
                }
            );
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || "アイテムの削除に失敗しました");
            }
            return response.json();
        },
        onSuccess: (_, variables) => {
            // すべてのプレイリストキャッシュを無効化
            queryClient.invalidateQueries({ queryKey: ["playlists", userEmail] });
            queryClient.invalidateQueries({
                queryKey: ["playlists", userEmail, variables.playlistId],
            });
            queryClient.invalidateQueries({
                queryKey: ["defaultPlaylist"],
            });
        },
    });
}

/**
 * デフォルトプレイリスト設定ミューテーション
 */
export function useSetDefaultPlaylistMutation() {
    const { data: session } = useSession();
    const userEmail = session?.user?.email;
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (playlistId: string) => {
            const response = await fetch(
                `/api/playlists/${playlistId}/set-default`,
                {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                }
            );
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || "デフォルト設定に失敗しました");
            }
            return response.json();
        },
        onSuccess: () => {
            // プレイリスト一覧とデフォルトプレイリストキャッシュを無効化
            queryClient.invalidateQueries({ queryKey: ["playlists", userEmail] });
            queryClient.invalidateQueries({ queryKey: ["defaultPlaylist"] });
        },
    });
}
