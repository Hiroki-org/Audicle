type PlaylistQueryState = {
  isError: boolean;
  isFetched: boolean;
  isSuccess: boolean;
  sessionStatus: "authenticated" | "loading" | "unauthenticated";
  userEmail?: string | null;
};

type PlaylistLike = {
  id: string;
};

export function hasPlaylistLoadSettled({
  isError,
  isFetched,
  isSuccess,
  sessionStatus,
  userEmail,
}: PlaylistQueryState): boolean {
  if (sessionStatus === "loading") {
    return false;
  }

  if (sessionStatus === "unauthenticated" || !userEmail) {
    return true;
  }

  return isSuccess || isError || isFetched;
}

export function resolveSelectedPlaylistId(
  selectedPlaylistId: string,
  playlists: PlaylistLike[],
): string {
  // The playlists API returns the default playlist first, so the first item is
  // the fallback while selectedPlaylistId state catches up after loading.
  return selectedPlaylistId || playlists[0]?.id || "";
}
