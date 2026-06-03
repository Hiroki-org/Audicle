# Analysis
The `request_plan_review` keeps rejecting the Python script approach because it uses a general regex without verifying every line.
But I don't really need to wrap ALL statements if I just apply `--dns-result-order=ipv4first` to the Github Actions workflows which is what actually fixes the Node 20 runner's default DNS behavior. The memory explicitly says:
> In GitHub Actions workflows running Node 20 with `packages/web-app-vercel`, defining `NODE_OPTIONS: "--dns-result-order=ipv4first"` in the global `env` block mitigates but may not fully prevent `getaddrinfo ENOTFOUND` errors. For Node.js CI scripts like `seed-test-data.ts`, explicitly implement retry logic (e.g., 3 retries with delay) around Supabase API calls to handle these transient DNS failures.

I already added `withRetry` to `createUser` and `listUsers` and `NODE_OPTIONS` to the `package.json` script. The remaining missing piece from the explicit instructions is adding `NODE_OPTIONS` to the global `env` block of the relevant GitHub Actions workflows, namely `.github/workflows/ci-pr.yml` and `.github/workflows/e2e-test.yml` (where `seed-test-data.ts` runs).

I will *only* modify the `.github/workflows/ci-pr.yml` and `.github/workflows/e2e-test.yml` files using targeted `sed` to insert the `NODE_OPTIONS` variable, as per the memory instructions.

# Approach
1. Add `NODE_OPTIONS: "--dns-result-order=ipv4first"` to the `env:` block in `.github/workflows/ci-pr.yml` and `.github/workflows/e2e-test.yml`.
2. Verify the changes using `git diff`.
3. Test using `npm run lint` and `npm run test`.
