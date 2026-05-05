import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useUserSettings, useUpdateUserSettingsMutation } from "../useUserSettings";
import React from "react";
import { useSession } from "next-auth/react";
import type { UpdateSettingsRequest, UserSettings } from "@/types/settings";

jest.mock("next-auth/react", () => ({
  useSession: jest.fn(),
}));

const mockUseSession = useSession as jest.Mock;
const originalFetch = global.fetch;
type MutableGlobal = typeof globalThis & { fetch?: typeof fetch };
let fetchMock: jest.MockedFunction<typeof fetch>;

describe("useUserSettings hooks", () => {
  let queryClient: QueryClient;
  let wrapper: ({ children }: { children: React.ReactNode }) => React.ReactElement;
  const mockSession = {
    data: { user: { email: "test@example.com" } },
    status: "authenticated",
  };

  beforeAll(() => {
    if (!originalFetch) {
      Object.defineProperty(global as MutableGlobal, "fetch", {
        configurable: true,
        writable: true,
        value: jest.fn(),
      });
    }
  });

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    jest.clearAllMocks();
    fetchMock = jest.spyOn(global, "fetch") as jest.MockedFunction<typeof fetch>;
    fetchMock.mockReset();
    mockUseSession.mockReturnValue(mockSession);
    wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  });

  afterEach(() => {
    fetchMock.mockRestore();
  });

  afterAll(() => {
    if (originalFetch) {
      (global as MutableGlobal).fetch = originalFetch;
    } else {
      delete (global as MutableGlobal).fetch;
    }
  });

  describe("useUserSettings", () => {
    it("should fetch user settings successfully", async () => {
      const mockSettings: UserSettings = {
        playback_speed: 1.2,
        voice_model: "ja-JP-Standard-B",
        language: "ja-JP",
        color_theme: "ocean",
      };
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSettings,
      } as Response);

      const { result } = renderHook(() => useUserSettings(), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockSettings);
      expect(fetchMock).toHaveBeenCalledWith("/api/settings/get");
    });

    it("should not fetch when user email is not available", async () => {
      mockUseSession.mockReturnValueOnce({ data: null, status: "unauthenticated" });
      const { result } = renderHook(() => useUserSettings(), { wrapper });

      expect(result.current.fetchStatus).toBe("idle");
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("should throw error when API returns ok: false with custom error", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: "Custom fetch error" }),
      } as Response);

      const { result } = renderHook(() => useUserSettings(), { wrapper });

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error?.message).toBe("Custom fetch error");
    });

    it("should throw error when API returns ok: false with default error", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        json: async () => ({}),
      } as Response);

      const { result } = renderHook(() => useUserSettings(), { wrapper });

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error?.message).toBe("設定の取得に失敗しました");
    });
  });

  describe("useUpdateUserSettingsMutation", () => {
    it("should call update API and invalidate queries", async () => {
      const invalidateQueriesSpy = jest.spyOn(queryClient, "invalidateQueries");
      const mockResponse = { success: true };
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const { result } = renderHook(() => useUpdateUserSettingsMutation(), { wrapper });

      const newSettings: UpdateSettingsRequest = { playback_speed: 1.5 };
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

    it("should invalidate unauthenticated query key when user email is not available", async () => {
      mockUseSession.mockReturnValueOnce({ data: null, status: "unauthenticated" });
      const invalidateQueriesSpy = jest.spyOn(queryClient, "invalidateQueries");
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      } as Response);

      const { result } = renderHook(() => useUpdateUserSettingsMutation(), { wrapper });

      const newSettings: UpdateSettingsRequest = { playback_speed: 1.5 };
      result.current.mutate(newSettings);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({
        queryKey: ["user-settings", undefined],
      });
    });

    it("should throw error when API returns ok: false with custom error", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: "Custom update error" }),
      } as Response);

      const { result } = renderHook(() => useUpdateUserSettingsMutation(), { wrapper });

      const newSettings: UpdateSettingsRequest = { playback_speed: 1.5 };
      result.current.mutate(newSettings);

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error?.message).toBe("Custom update error");
    });

    it("should throw error when API returns ok: false with default error", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        json: async () => ({}),
      } as Response);

      const { result } = renderHook(() => useUpdateUserSettingsMutation(), { wrapper });

      const newSettings: UpdateSettingsRequest = { playback_speed: 1.5 };
      result.current.mutate(newSettings);

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error?.message).toBe("設定の保存に失敗しました");
    });
  });
});
