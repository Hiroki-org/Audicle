with open("packages/web-app-vercel/contexts/__tests__/PlaylistPlaybackContext.test.tsx", "r") as f:
    content = f.read()

fixed_content = content.replace("""<<<<<<< HEAD
    const result = generateShuffledIndices(-1);
=======
    const result = generateShuffledIndices(-5);
>>>>>>> origin/main""", "    const result = generateShuffledIndices(-1);")

with open("packages/web-app-vercel/contexts/__tests__/PlaylistPlaybackContext.test.tsx", "w") as f:
    f.write(fixed_content)
