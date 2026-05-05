import sys

print("Current lines 244-280 in main.py:")
with open("packages/api-server/main.py", "r") as f:
    lines = f.readlines()
    for i in range(244, 281):
        if i - 1 < len(lines):
            print(f"{i}: {lines[i-1]}", end="")
