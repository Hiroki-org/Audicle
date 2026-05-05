import sys

print("Lines 140-150 in main.py:")
with open("packages/api-server/main.py", "r") as f:
    lines = f.readlines()
    for i in range(140, 151):
        if i - 1 < len(lines):
            print(f"{i}: {lines[i-1]}", end="")
