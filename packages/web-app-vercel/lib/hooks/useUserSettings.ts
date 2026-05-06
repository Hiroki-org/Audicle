import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import type { UserSettings } from "@/types/settings";

/**
 * ユーザー設定を取得
 */
export function useUserSettings() {
    const { data: session } = useSession();
    const userEmail = session?.user?.email;

    return useQuery({
        queryKey: ["user-settings", userEmail],
        queryFn: async () => {
            const response = await fetch("/api/settings/get");
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || "設定の取得に失敗しました");
            }
            return response.json() as Promise<UserSettings>;
        },
        enabled: !!userEmail,
    });
}

/**
 * ユーザー設定更新ミューテーション
 */
export function useUpdateUserSettingsMutation() {
    const { data: session } = useSession();
    const userEmail = session?.user?.email;
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (settings: UserSettings) => {
            const response = await fetch("/api/settings/update", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(settings),
            });
            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || "設定の保存に失敗しました");
            }
            return response.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["user-settings", userEmail] });
        },
    });
}
