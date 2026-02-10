import asyncio
import time
import sys
import os
import subprocess
from httpx import AsyncClient, ASGITransport

# Add package path so we can import main
sys.path.append(os.path.abspath("packages/api-server"))

# Save original
original_run = subprocess.run

# Define mock
def blocking_run(*args, **kwargs):
    print(f"Mock subprocess.run called. Blocking for 2 seconds...")
    time.sleep(2)
    return subprocess.CompletedProcess(args, 0, stdout='{"title": "Slow", "chunks": []}', stderr="")

# Patch
subprocess.run = blocking_run

# Now import app
from main import app

async def benchmark():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        print("Starting benchmark...")

        t_start = time.time()

        # Task 1: Trigger the blocking endpoint
        print("Task 1: Sending request to /extract (will block)")
        task1 = asyncio.create_task(client.post("/extract", json={"url": "http://example.com"}))

        # Give it a tiny moment to start execution and hit the blocking call
        # If the loop is blocked, this sleep call will take much longer than 0.1s
        await asyncio.sleep(0.1)

        t_after_sleep = time.time()
        elapsed = t_after_sleep - t_start
        print(f"Time to resume loop: {elapsed:.4f}s")

        # Task 2: Hit the fast endpoint
        print("Task 2: Sending request to /")
        await client.get("/")

        await task1

        if elapsed > 1.0:
            print("❌ FAIL: Loop was blocked by the synchronous subprocess call.")
        else:
            print("✅ PASS: Loop was NOT blocked.")

if __name__ == "__main__":
    asyncio.run(benchmark())
