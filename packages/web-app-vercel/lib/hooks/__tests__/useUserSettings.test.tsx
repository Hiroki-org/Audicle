import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useUserSettings, useUpdateUserSettingsMutation } from "../useUserSettings";
import React from "react";
import { useSession } from "next-auth/react";
import type { UserSettings } from "@/types/settings";

const originalFetch = global.fetch;

// Mock next-auth/react
jest.mock("next-auth/react", () => ({
  useSession: jest.fn(),
}));

describe("useUserSettings hook", () => {
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
        playback_speed: 1.5,
        voice_model: "test-voice",
        language: "ja",
        color_theme: "dark"
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

    it("should handle API error with specific message", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: "Specific error message" }),
      } as Response);

      const { result } = renderHook(() => useUserSettings(), { wrapper });

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error?.message).toBe("Specific error message");
    });

    it("should handle API error with default message", async () => {
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

    it("should not fetch if session user has no email", async () => {
      (useSession as jest.Mock).mockReturnValue({
        data: { user: {} },
        status: "authenticated",
      });

      const { result } = renderHook(() => useUserSettings(), { wrapper });

      expect(result.current.fetchStatus).toBe("idle");
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe("useUpdateUserSettingsMutation", () => {
    it("should update user settings successfully and invalidate queries", async () => {
      const mockSettings: UserSettings = {
        playback_speed: 1.0,
        voice_model: "test-voice-2",
        language: "en",
        color_theme: "light"
      };
      const mockResponse = { success: true };

      const invalidateQueriesSpy = jest.spyOn(queryClient, "invalidateQueries");

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const { result } = renderHook(() => useUpdateUserSettingsMutation(), { wrapper });

      result.current.mutate(mockSettings);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(fetchMock).toHaveBeenCalledWith("/api/settings/update", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mockSettings),
      });

      expect(invalidateQueriesSpy).toHaveBeenCalledWith({
        queryKey: ["user-settings", "test@example.com"],
      });
      expect(result.current.data).toEqual(mockResponse);
    });

    it("should handle mutation API error with specific message", async () => {
      const mockSettings: UserSettings = {
        playback_speed: 1.0,
        voice_model: "test-voice",
        language: "ja",
        color_theme: "light"
      };

      fetchMock.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: "Mutation specific error" }),
      } as Response);

      const { result } = renderHook(() => useUpdateUserSettingsMutation(), { wrapper });

      result.current.mutate(mockSettings);

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error?.message).toBe("Mutation specific error");
    });

    it("should handle mutation API error with default message", async () => {
      const mockSettings: UserSettings = {
        playback_speed: 1.0,
        voice_model: "test-voice",
        language: "ja",
        color_theme: "light"
      };

      fetchMock.mockResolvedValueOnce({
        ok: false,
        json: async () => ({}),
      } as Response);

      const { result } = renderHook(() => useUpdateUserSettingsMutation(), { wrapper });

      result.current.mutate(mockSettings);

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error?.message).toBe("設定の保存に失敗しました");
    });
  });
});
