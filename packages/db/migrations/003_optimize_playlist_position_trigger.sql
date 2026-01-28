-- Optimization: Reduce locking contention when adding playlist items
-- Change: Replace FOR UPDATE (Row Lock) on parent table with pg_advisory_xact_lock (Advisory Lock)

CREATE OR REPLACE FUNCTION set_playlist_item_position()
RETURNS TRIGGER AS $$
BEGIN
  -- Use Advisory Lock based on playlist ID instead of locking the parent playlist row.
  -- This prevents serialization with other operations on the playlists table (like updating name/metadata),
  -- while still strictly serializing insertions into the same playlist to maintain position integrity.
  -- pg_advisory_xact_lock automatically releases at the end of the transaction.
  -- Using 2-argument form with a fixed namespace (123456789) and integer hash derived from playlist_id to avoid 32-bit collisions.
  PERFORM pg_advisory_xact_lock(123456789, hashtext(NEW.playlist_id::text));

  -- Calculate and set the next position safely within the transaction
  NEW.position = (
    SELECT COALESCE(MAX(position), -1) + 1
    FROM playlist_items
    WHERE playlist_id = NEW.playlist_id
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
