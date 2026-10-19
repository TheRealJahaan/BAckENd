import { escapeHtml } from './lib/escape-html.js';

/** Minimal self-contained landing page so visiting the root URL shows something useful. */
export function landingPage(baseUrl: string): string {
  const base = escapeHtml(baseUrl);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>BAckENd · URL Shortener API</title>
<style>
  :root { color-scheme: light dark; --fg:#111; --muted:#555; --bg:#fafafa; --card:#fff; --border:#e4e4e7; --accent:#2563eb; }
  @media (prefers-color-scheme: dark) { :root { --fg:#f4f4f5; --muted:#a1a1aa; --bg:#09090b; --card:#18181b; --border:#27272a; --accent:#60a5fa; } }
  * { box-sizing: border-box; }
  body { margin:0; font:16px/1.6 system-ui, -apple-system, Segoe UI, sans-serif; background:var(--bg); color:var(--fg); }
  main { max-width:720px; margin:0 auto; padding:56px 16px; }
  h1 { font-size:2rem; margin:0 0 8px; }
  p { color:var(--muted); margin:0 0 24px; }
  a { color:var(--accent); }
  .links { display:flex; gap:12px; flex-wrap:wrap; margin-bottom:32px; }
  .btn { padding:10px 16px; border:1px solid var(--border); border-radius:8px; background:var(--card); text-decoration:none; font-weight:600; }
  pre { background:var(--card); border:1px solid var(--border); border-radius:8px; padding:16px; overflow-x:auto; font-size:13px; }
</style>
</head>
<body>
<main>
  <h1>BAckENd</h1>
  <p>A production-ready URL shortener API with JWT auth, click analytics and OpenAPI docs.</p>
  <div class="links">
    <a class="btn" href="/docs">Interactive API docs</a>
    <a class="btn" href="/openapi.json">OpenAPI spec</a>
    <a class="btn" href="/healthz">Health</a>
    <a class="btn" href="https://github.com/TheRealJahaan/BAckENd">Source</a>
  </div>
  <pre><code># 1. Create an account
curl -X POST ${base}/api/v1/auth/register \\
  -H 'Content-Type: application/json' \\
  -d '{"email":"you@example.com","name":"You","password":"a-long-password"}'

# 2. Shorten a URL (use the token from step 1)
curl -X POST ${base}/api/v1/links \\
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \\
  -d '{"url":"https://github.com/TheRealJahaan","slug":"jahaan"}'

# 3. Share it
open ${base}/jahaan</code></pre>
</main>
</body>
</html>`;
}
