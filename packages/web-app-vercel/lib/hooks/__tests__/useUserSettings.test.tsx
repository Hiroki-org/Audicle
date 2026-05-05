import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useUserSettings, useUpdateUserSettingsMutation } from "../useUserSettings";
import React from "react";
import { useSession } from "next-auth/react";
import type { UserSettings } from "@/types/settings";

jest.mock("next-auth/react", () => ({
  useSession: jest.fn(),
}));

const mockUseSession = useSession as jest.Mock;
global.fetch = jest.fn();

describe("useUserSettings hooks", () => {
  let queryClient: QueryClient;
  const mockSession = {
    data: { user: { email: "test@example.com" } },
    status: "authenticated",
  };

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    jest.clearAllMocks();
    mockUseSession.mockReturnValue(mockSession);
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  describe("useUserSettings", () => {
    it("should fetch user settings successfully", async () => {
      const mockSettings: Partial<UserSettings> = { speed: 1.2 };
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockSettings,
      });

      const { result } = renderHook(() => useUserSettings(), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockSettings);
      expect(global.fetch).toHaveBeenCalledWith("/api/settings/get");
    });

    it("should not fetch when user email is not available", async () => {
      mockUseSession.mockReturnValueOnce({ data: null, status: "unauthenticated" });
      const { result } = renderHook(() => useUserSettings(), { wrapper });

      expect(result.current.fetchStatus).toBe("idle");
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it("should throw error when API returns ok: false with custom error", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: "Custom fetch error" }),
      });

      const { result } = renderHook(() => useUserSettings(), { wrapper });

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error?.message).toBe("Custom fetch error");
    });

    it("should throw error when API returns ok: false with default error", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => ({}),
      });

      const { result } = renderHook(() => useUserSettings(), { wrapper });

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error?.message).toBe("設定の取得に失敗しました");
    });
  });

  describe("useUpdateUserSettingsMutation", () => {
    it("should call update API and invalidate queries", async () => {
      const invalidateQueriesSpy = jest.spyOn(queryClient, "invalidateQueries");
      const mockResponse = { success: true };
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const { result } = renderHook(() => useUpdateUserSettingsMutation(), { wrapper });

      const newSettings: Partial<UserSettings> = { speed: 1.5 };
      result.current.mutate(newSettings as UserSettings);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(global.fetch).toHaveBeenCalledWith("/api/settings/update", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newSettings),
      });
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({
        queryKey: ["user-settings", "test@example.com"],
      });
    });

    it("should throw error when API returns ok: false with custom error", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: "Custom update error" }),
      });

      const { result } = renderHook(() => useUpdateUserSettingsMutation(), { wrapper });

      const newSettings: Partial<UserSettings> = { speed: 1.5 };
      result.current.mutate(newSettings as UserSettings);

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error?.message).toBe("Custom update error");
    });

    it("should throw error when API returns ok: false with default error", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => ({}),
      });

      const { result } = renderHook(() => useUpdateUserSettingsMutation(), { wrapper });

      const newSettings: Partial<UserSettings> = { speed: 1.5 };
      result.current.mutate(newSettings as UserSettings);

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error?.message).toBe("設定の保存に失敗しました");
    });
  });
});
