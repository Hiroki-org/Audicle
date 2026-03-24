with open('packages/web-app-vercel/app/share-target/route.ts', 'r') as f:
    content = f.read()

content = content.replace("console.log(JSON.stringify({\n        action: 'share_target_start',", "console.info(JSON.stringify({\n        action: 'share_target_start',")
content = content.replace("console.log(JSON.stringify({\n                action: 'playlist_item_added',", "console.info(JSON.stringify({\n                action: 'playlist_item_added',")
content = content.replace("console.log(JSON.stringify({\n            action: 'share_target_success',", "console.info(JSON.stringify({\n            action: 'share_target_success',")
content = content.replace("console.log(JSON.stringify({\n            action: 'share_target_error',", "console.error(JSON.stringify({\n            action: 'share_target_error',")

with open('packages/web-app-vercel/app/share-target/route.ts', 'w') as f:
    f.write(content)
