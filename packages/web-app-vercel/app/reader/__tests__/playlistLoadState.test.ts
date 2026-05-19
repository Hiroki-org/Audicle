import { isReaderPlaylistGateReady } from "../playlistLoadState";

describe("isReaderPlaylistGateReady", () => {
  it("waits while the auth session is still loading", () => {
    expect(
      isReaderPlaylistGateReady({
        sessionStatus: "loading",
        userEmail: null,
        arePlaylistsSuccess: false,
        arePlaylistsError: false,
        arePlaylistsFetched: false,
      }),
    ).toBe(false);
  });

  it("allows unauthenticated users after session loading has settled", () => {
    expect(
      isReaderPlaylistGateReady({
        sessionStatus: "unauthenticated",
        userEmail: null,
        arePlaylistsSuccess: false,
        arePlaylistsError: false,
        arePlaylistsFetched: false,
      }),
    ).toBe(true);
  });

  it("waits for playlist query state when a user is authenticated", () => {
    expect(
      isReaderPlaylistGateReady({
        sessionStatus: "authenticated",
        userEmail: "reader@example.com",
        arePlaylistsSuccess: false,
        arePlaylistsError: false,
        arePlaylistsFetched: false,
      }),
    ).toBe(false);

    expect(
      isReaderPlaylistGateReady({
        sessionStatus: "authenticated",
        userEmail: "reader@example.com",
        arePlaylistsSuccess: false,
        arePlaylistsError: false,
        arePlaylistsFetched: true,
      }),
    ).toBe(true);
  });
});
