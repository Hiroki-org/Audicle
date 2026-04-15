import json
with open('package.json', 'r') as f:
    pkg = json.load(f)

if 'eslint' in pkg.get('devDependencies', {}):
    pkg['devDependencies']['eslint'] = "^9.0.0"
if 'eslint' in pkg.get('dependencies', {}):
    pkg['dependencies']['eslint'] = "^9.0.0"

with open('package.json', 'w') as f:
    json.dump(pkg, f, indent=2)
