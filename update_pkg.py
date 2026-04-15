import re

with open('packages/web-app-vercel/package.json', 'r') as f:
    content = f.read()

resolved = re.sub(
    r'<<<<<<< HEAD.*?=======\n\s*"fake-indexeddb": "\^6\.2\.5",\n\s*"jest": "\^30\.2\.0",\n\s*"jest-environment-jsdom": "\^30\.2\.0",\n>>>>>>> .*?\n',
    '    "fake-indexeddb": "^6.2.5",\n    "jest": "^30.3.0",\n    "jest-environment-jsdom": "^30.3.0",\n',
    content,
    flags=re.DOTALL
)

with open('packages/web-app-vercel/package.json', 'w') as f:
    f.write(resolved)
