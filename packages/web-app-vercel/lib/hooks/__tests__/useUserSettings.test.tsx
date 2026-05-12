import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useUserSettings, useUpdateUserSettingsMutation } from "../useUserSettings";
import React from "react";
import { useSession } from "next-auth/react";
import { UserSettings, DEFAULT_SETTINGS } from "@/types/settings";

const originalFetch = global.fetch;

// Mock next-auth/react
jest.mock("next-auth/react", () => ({
  useSession: jest.fn(),
}));

describe("useUserSettings hooks", () => {
  let queryClient: QueryClient;
  let fetchMock: jest.SpiedFunction<typeof fetch>;
  const mockSession = {
    data: { user: { email: "test@example.com" } },
    status: "authenticated",
  };

  beforeEach(() => {
    jest.clearAllMocks();
    if (!global.fetch) {
      Object.defineProperty(global, "fetch", {
        configurable: true,
        writable: true,
        value: jest.fn(),
      });
    }
    fetchMock = jest
      .spyOn(global, "fetch")
      .mockRejectedValue(new Error("fetch mock not configured"));
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    (useSession as jest.Mock).mockReturnValue(mockSession);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    if (!originalFetch) {
      delete (global as typeof globalThis & { fetch?: typeof fetch }).fetch;
    }
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  describe("useUserSettings", () => {
    it("should fetch user settings successfully", async () => {
      const mockSettings: UserSettings = {
        ...DEFAULT_SETTINGS,
        playback_speed: 1.5,
      };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSettings,
      } as Response);

      const { result } = renderHook(() => useUserSettings(), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(fetchMock).toHaveBeenCalledWith("/api/settings/get");
      expect(result.current.data).toEqual(mockSettings);
    });

    it("should handle API error", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: "Custom error message" }),
      } as Response);

      const { result } = renderHook(() => useUserSettings(), { wrapper });

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error?.message).toBe("Custom error message");
    });

    it("should use default error message on failure if no specific error provided", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        json: async () => ({}),
      } as Response);

      const { result } = renderHook(() => useUserSettings(), { wrapper });

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error?.message).toBe("設定の取得に失敗しました");
    });

    it("should not fetch if userEmail is missing", async () => {
      (useSession as jest.Mock).mockReturnValue({
        data: null,
        status: "unauthenticated",
      });

      const { result } = renderHook(() => useUserSettings(), { wrapper });

      expect(result.current.fetchStatus).toBe("idle");
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe("useUpdateUserSettingsMutation", () => {
    it("should update user settings successfully and invalidate cache", async () => {
      const invalidateQueriesSpy = jest.spyOn(queryClient, "invalidateQueries");

      const newSettings: UserSettings = {
        ...DEFAULT_SETTINGS,
        playback_speed: 2.0,
      };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      } as Response);

      const { result } = renderHook(() => useUpdateUserSettingsMutation(), { wrapper });

      result.current.mutate(newSettings);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(fetchMock).toHaveBeenCalledWith("/api/settings/update", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newSettings),
      });

      expect(invalidateQueriesSpy).toHaveBeenCalledWith({
        queryKey: ["user-settings", "test@example.com"],
      });
    });

    it("should handle mutation API error", async () => {
      const newSettings: UserSettings = {
        ...DEFAULT_SETTINGS,
      };

      fetchMock.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: "Update failed custom message" }),
      } as Response);

      const { result } = renderHook(() => useUpdateUserSettingsMutation(), { wrapper });

      result.current.mutate(newSettings);

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error?.message).toBe("Update failed custom message");
    });

    it("should use default error message on mutation failure", async () => {
      const newSettings: UserSettings = {
        ...DEFAULT_SETTINGS,
      };

      fetchMock.mockResolvedValueOnce({
        ok: false,
        json: async () => ({}),
      } as Response);

      const { result } = renderHook(() => useUpdateUserSettingsMutation(), { wrapper });

      result.current.mutate(newSettings);

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error?.message).toBe("設定の保存に失敗しました");
    });
  });
});
