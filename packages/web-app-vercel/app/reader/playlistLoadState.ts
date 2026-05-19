type SessionStatus = "loading" | "authenticated" | "unauthenticated";

export function isReaderPlaylistGateReady({
  sessionStatus,
  userEmail,
  arePlaylistsSuccess,
  arePlaylistsError,
  arePlaylistsFetched,
}: {
  sessionStatus: SessionStatus;
  userEmail?: string | null;
  arePlaylistsSuccess: boolean;
  arePlaylistsError: boolean;
  arePlaylistsFetched: boolean;
}) {
  if (sessionStatus === "loading") {
    return false;
  }

  return (
    !userEmail ||
    arePlaylistsSuccess ||
    arePlaylistsError ||
    arePlaylistsFetched
  );
}
