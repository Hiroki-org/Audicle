with open('packages/web-app-vercel/app/share-target/route.ts', 'r') as f:
    content = f.read()

content = content.replace("console.log(JSON.stringify(", "console.info(JSON.stringify(")
content = content.replace("console.info(JSON.stringify({\n            action: 'share_target_error',", "console.error(JSON.stringify({\n            action: 'share_target_error',")

with open('packages/web-app-vercel/app/share-target/route.ts', 'w') as f:
    f.write(content)
