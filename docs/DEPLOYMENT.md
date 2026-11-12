# Deployment (Vercel)

> Status: **prepared and locally verified, not deployed.** No Vercel project exists for this repo
> yet. Do not claim a live URL until the steps below are executed and the checks pass.

## 1. What the app needs

| Requirement | Value |
| --- | --- |
| Framework | Next.js 16 App Router (auto-detected) |
| Node | 20.x or 22.x (Vercel default is fine) |
| Build command | `npm run build` |
| Install command | `npm install` |
| Output directory | Next.js default (`.next`) — do **not** set `dist` |
| Runtime | Node.js for `/api/*`; everything else is static or RSC |
| Database / cron / queues | None |
| Environment variables | Only `NEXT_PUBLIC_SITE_URL` is needed; assistant vars are optional |

## 2. Environment variables

| Name | Scope | Required | Purpose |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Production + Preview | Recommended | Canonical URLs, Open Graph, sitemap, robots. Use the final `https://…` origin. |
| `ASSISTANT_API_URL` | Server only | No | OpenAI-compatible chat-completions endpoint. |
| `ASSISTANT_API_KEY` | Server only | No | Key for that endpoint. Never prefix with `NEXT_PUBLIC_`. |
| `ASSISTANT_MODEL` | Server only | No | Model name sent to the endpoint. |

Without the three assistant variables, `/api/assistant` responds `{ enabled: false, model: null }`
and the UI keeps using the deterministic local engine.

## 3. Deploy

```bash
# once, from a checkout with the PR branch merged or checked out
npx vercel link          # create/link the project (interactive)
npx vercel env add NEXT_PUBLIC_SITE_URL production
npx vercel --prod        # or import the GitHub repo in the dashboard
```

For the dashboard flow: **Add New → Project → import `sachi26698-LIMA/Phone-care`**, keep the
detected Next.js settings, add `NEXT_PUBLIC_SITE_URL`, deploy. Enable *Ignored Build Step* only if
you want to skip docs-only commits.

## 4. Post-deploy verification

Replace `$BASE` with the deployment origin.

```bash
curl -s "$BASE/api/health" | jq
# {"status":"ok","app":"PhoneCare AI","assistant":"local","site":"https://…",...}

curl -sI "$BASE/" | grep -Ei "content-security-policy|x-frame-options|x-content-type-options|referrer-policy|permissions-policy|strict-transport-security"
curl -s -o /dev/null -w "%{http_code}\n" "$BASE/sitemap.xml"
curl -s -o /dev/null -w "%{http_code}\n" "$BASE/robots.txt"
curl -s -o /dev/null -w "download cap: %{size_download}\n" "$BASE/api/network/download?bytes=20000000"   # expect 8388608
curl -s -o /dev/null -w "%{http_code}\n" -X POST -H 'Content-Type: application/json' -d '{"question":"hi"}' "$BASE/api/assistant"  # 501 without a model
```

Then in a browser at 390 px and 1440 px: run a full scan, check the console, run one guided screen
check and one touch trace, and export the JSON report.

## 5. Security posture in production

- CSP, HSTS, `X-Frame-Options: SAMEORIGIN`, `nosniff`, referrer and permissions policies are set in
  `next.config.ts` and applied to every route.
- `poweredByHeader` is off.
- No secrets in the client bundle: only `NEXT_PUBLIC_*` values are inlined.
- Speed-test endpoints are capped (8 MB download, 4 MB upload) and rate limiting for the assistant
  happens server-side.
- CSP allows `'unsafe-inline'` for scripts because Next injects an inline bootstrap; replacing it
  with a nonce requires a middleware pass and is tracked as future hardening, not a blocker.

## 6. Known constraints

- Serverless duration limits apply to `/api/network/*` (the 8 MB transfer is streamed/buffered).
- No persistence on the server: everything diagnostic lives in the visitor's browser.
- Vercel's default region may add latency to the network test; treat absolute Mbps as
  host-relative, which the UI already states.
- Preview deployments should use a preview `NEXT_PUBLIC_SITE_URL` or omit it (falls back to
  `https://phonecare.app` metadata). Do not point previews at production canonical URLs.

## 7. Rollback

Promote the previous deployment in the Vercel dashboard (`Deployments → … → Promote`), or redeploy
the prior commit. No database migrations means rollback is stateless.
