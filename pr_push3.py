import subprocess
import os

branch = "perf-optimize-synthesize-api-6677702239414548147"

token = os.environ.get("GH_TOKEN")
if token:
    remote_url = f"https://x-access-token:{token}@github.com/Hiroki-org/Audicle.git"
    result = subprocess.run(["git", "push", "--force", remote_url, f"HEAD:{branch}"])
    print("Push finished:", result.returncode)
else:
    print("No token")
