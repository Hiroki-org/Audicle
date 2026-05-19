import {
  hasPlaylistLoadSettled,
  resolveSelectedPlaylistId,
} from "../readerPlaylistReadiness";

describe("reader playlist readiness helpers", () => {
  describe("hasPlaylistLoadSettled", () => {
    const baseQueryState = {
      isError: false,
      isFetched: false,
      isSuccess: false,
      userEmail: "reader@example.com",
    };

    it("waits while the auth session is still loading", () => {
      expect(
        hasPlaylistLoadSettled({
          ...baseQueryState,
          sessionStatus: "loading",
        }),
      ).toBe(false);
    });

    it("settles immediately for unauthenticated readers", () => {
      expect(
        hasPlaylistLoadSettled({
          ...baseQueryState,
          sessionStatus: "unauthenticated",
          userEmail: null,
        }),
      ).toBe(true);
    });

    it("settles after a playlist fetch succeeds", () => {
      expect(
        hasPlaylistLoadSettled({
          ...baseQueryState,
          isSuccess: true,
          sessionStatus: "authenticated",
        }),
      ).toBe(true);
    });

    it("settles after a playlist fetch fails so URL loading can continue", () => {
      expect(
        hasPlaylistLoadSettled({
          ...baseQueryState,
          isError: true,
          sessionStatus: "authenticated",
        }),
      ).toBe(true);
    });

    it("does not wait forever when an authenticated session has no email", () => {
      expect(
        hasPlaylistLoadSettled({
          ...baseQueryState,
          sessionStatus: "authenticated",
          userEmail: undefined,
        }),
      ).toBe(true);
    });
  });

  describe("resolveSelectedPlaylistId", () => {
    it("keeps an explicit selection", () => {
      expect(
        resolveSelectedPlaylistId("selected", [
          { id: "default" },
          { id: "secondary" },
        ]),
      ).toBe("selected");
    });

    it("uses the first loaded playlist before selection state catches up", () => {
      expect(resolveSelectedPlaylistId("", [{ id: "default" }])).toBe(
        "default",
      );
    });

    it("returns an empty id when no playlist is available", () => {
      expect(resolveSelectedPlaylistId("", [])).toBe("");
    });
  });
});
