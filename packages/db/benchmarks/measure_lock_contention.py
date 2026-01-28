import asyncio
import os
import time
import uuid
import random

# Try to import asyncpg, handle if missing
try:
    import asyncpg
except ImportError:
    asyncpg = None

# Configuration
DB_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/postgres")
CONCURRENCY = 10
ITEMS_PER_WORKER = 50

async def setup_data(conn):
    # Create test data
    user_email = f"bench_{uuid.uuid4()}@example.com"

    # Insert playlist
    playlist_id = str(uuid.uuid4())
    # Note: Adjust fields based on actual schema if needed.
    # Assuming schema from migration 002
    await conn.execute("""
        INSERT INTO playlists (id, owner_email, name)
        VALUES ($1, $2, 'Benchmark Playlist')
    """, playlist_id, user_email)

    print(f"Created playlist {playlist_id}")

    # Create bookmarks to add
    # We create them beforehand to isolate the measurement to playlist_items insertion
    article_ids = []
    total_items = CONCURRENCY * ITEMS_PER_WORKER
    print(f"Creating {total_items} bookmarks...")

    # Batch insert for speed during setup
    # We need unique bookmarks.

    values = []
    for _ in range(total_items):
        bm_id = str(uuid.uuid4())
        art_url = f"http://example.com/{bm_id}"
        values.append((bm_id, user_email, art_url, 'Test Article'))
        article_ids.append(bm_id)

    await conn.executemany("""
        INSERT INTO bookmarks (id, owner_email, article_url, article_title)
        VALUES ($1, $2, $3, $4)
    """, values)

    return playlist_id, article_ids

async def worker(pool, playlist_id, bookmark_ids):
    async with pool.acquire() as conn:
        for bm_id in bookmark_ids:
            try:
                # Insert into playlist_items. Position is handled by trigger.
                await conn.execute("""
                    INSERT INTO playlist_items (playlist_id, bookmark_id)
                    VALUES ($1, $2)
                """, playlist_id, bm_id)
            except Exception as e:
                print(f"Error inserting {bm_id}: {e}")

async def run_benchmark():
    if not asyncpg:
        print("❌ Error: 'asyncpg' library is required.")
        print("Please run: pip install asyncpg")
        return

    print(f"Connecting to DB...")
    try:
        pool = await asyncpg.create_pool(DB_URL)
    except Exception as e:
        print(f"Failed to connect to DB: {e}")
        print("Please set DATABASE_URL environment variable correctly.")
        return

    print("Setting up test data...")
    async with pool.acquire() as conn:
        try:
            playlist_id, all_bm_ids = await setup_data(conn)
        except Exception as e:
            print(f"Setup failed: {e}")
            await pool.close()
            return

    print(f"Starting benchmark: {CONCURRENCY} workers, {ITEMS_PER_WORKER} items each.")

    # Split bookmarks among workers
    worker_tasks = []
    chunk_size = ITEMS_PER_WORKER

    start_time = time.time()

    for i in range(CONCURRENCY):
        chunk = all_bm_ids[i*chunk_size : (i+1)*chunk_size]
        worker_tasks.append(worker(pool, playlist_id, chunk))

    await asyncio.gather(*worker_tasks)

    end_time = time.time()
    duration = end_time - start_time
    total_items = CONCURRENCY * ITEMS_PER_WORKER

    print(f"Benchmark finished in {duration:.2f} seconds.")
    print(f"Throughput: {total_items / duration:.2f} items/sec")

    # Verify positions
    async with pool.acquire() as conn:
        positions = await conn.fetch("""
            SELECT position FROM playlist_items
            WHERE playlist_id = $1
            ORDER BY position
        """, playlist_id)

        pos_list = [r['position'] for r in positions]

        count = len(pos_list)
        unique_count = len(set(pos_list))

        print(f"Total items inserted: {count}")

        if count != unique_count:
            print(f"❌ DUPLICATE POSITIONS DETECTED! Unique: {unique_count}, Total: {count}")
        else:
            print("✅ No duplicate positions.")

        if count > 0:
            min_pos = min(pos_list)
            max_pos = max(pos_list)
            print(f"Position range: {min_pos} to {max_pos}")

            # Check for gaps
            if max_pos - min_pos + 1 == count:
                 print("✅ Positions are contiguous.")
            else:
                 print("⚠️ Positions have gaps.")

    await pool.close()

if __name__ == "__main__":
    asyncio.run(run_benchmark())
