set -euo pipefail

ROOT_DIR="${PWD}"
APP_NAME="claimcheck-pro"

note() { printf "\n\033[1;34m[INFO]\033[0m %s\n" "$*"; }
warn() { printf "\n\033[1;33m[WARN]\033[0m %s\n" "$*"; }
err()  { printf "\n\033[1;31m[ERR]\033[0m  %s\n" "$*"; }

# 0) Ensure pnpm exists (install if missing)
if ! command -v pnpm >/dev/null 2>&1; then
  warn "pnpm not found; installing globally via npm..."
  npm i -g pnpm >/dev/null 2>&1 || { err "Failed to install pnpm"; exit 1; }
fi

# 1) Create root folder (idempotent)
mkdir -p "$APP_NAME"
cd "$APP_NAME"

note "Scaffolding repository in: $(pwd)"

# 2) Create directory tree
mkdir -p app/analysis/[id] app/api/analyze app/api/health app/api/metrics app/pricing app/setup
mkdir -p components/Evidence components/Metrics components/Panels
mkdir -p lib/i18n/messages lib/assess lib/search
mkdir -p prisma workers tests public styles .github/workflows
touch public/favicon.ico # placeholder; you can replace with a real one

# 3) Write files via heredocs

# --- package.json ---
cat > package.json <<'JSON'
{
  "name": "claimcheck-pro",
  "private": true,
  "version": "1.0.0",
  "description": "QikVerify.com (ClaimCheck Pro) — Multilingual Evidence Platform",
  "scripts": {
    "dev": "next dev",
    "build:web": "next build",
    "build:workers": "tsc -p tsconfig.workers.json",
    "build": "pnpm build:web && pnpm build:workers",
    "start": "next start",
    "start:worker": "node dist/workers/analysis.worker.js",
    "lint": "eslint . --ext .ts,.tsx",
    "typecheck": "tsc --noEmit",
    "test": "jest",
    "prisma:gen": "prisma generate",
    "prisma:migrate": "prisma migrate deploy",
    "postinstall": "prisma generate"
  },
  "dependencies": {
    "@mozilla/readability": "^0.5.0",
    "@prisma/client": "^5.16.1",
    "autoprefixer": "^10.4.19",
    "bullmq": "^5.11.0",
    "fast-xml-parser": "^4.4.0",
    "franc": "^6.2.0",
    "ioredis": "^5.4.1",
    "iso-639-1": "^3.1.0",
    "jsdom": "^24.0.0",
    "next": "14.2.5",
    "next-intl": "^3.16.0",
    "openai": "^4.58.1",
    "pdf-parse": "^1.1.1",
    "postcss": "^8.4.38",
    "react": "18.3.1",
    "react-dom": "18.3.1",
    "tesseract.js": "^5.0.5",
    "tailwindcss": "^3.4.7",
    "typescript": "^5.5.4",
    "youtube-transcript": "^1.2.0",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/jest": "^29.5.12",
    "@types/jsdom": "^21.1.7",
    "@types/node": "^20.14.9",
    "@types/pdf-parse": "^1.1.4",
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "@typescript-eslint/eslint-plugin": "^7.16.1",
    "@typescript-eslint/parser": "^7.16.1",
    "eslint": "^8.57.0",
    "ioredis-mock": "^8.9.0",
    "jest": "^29.7.0",
    "prettier": "^3.3.3",
    "prisma": "^5.16.1",
    "ts-jest": "^29.2.5"
  }
}
JSON

# --- next.config.js ---
cat > next.config.js <<'JS'
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true
};
module.exports = nextConfig;
JS

# --- tailwind.config.js ---
cat > tailwind.config.js <<'JS'
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: { extend: {} },
  plugins: []
};
JS

# --- postcss.config.js ---
cat > postcss.config.js <<'JS'
module.exports = { plugins: { tailwindcss: {}, autoprefixer: {} } };
JS

# --- tsconfig.json ---
cat > tsconfig.json <<'JSON'
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "resolveJsonModule": true,
    "esModuleInterop": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "noEmit": true,
    "jsx": "preserve",
    "types": ["jest", "node"]
  },
  "include": ["app", "components", "lib", "workers", "tests", "next-env.d.ts"],
  "exclude": ["node_modules"]
}
JSON

# --- tsconfig.workers.json ---
cat > tsconfig.workers.json <<'JSON'
{
  "compilerOptions": {
    "outDir": "dist",
    "target": "ES2022",
    "module": "CommonJS",
    "moduleResolution": "Node",
    "rootDir": ".",
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "skipLibCheck": true
  },
  "include": ["workers/**/*.ts", "lib/**/*.ts"]
}
JSON

# --- jest.config.cjs ---
cat > jest.config.cjs <<'JS'
module.exports = {
  testEnvironment: "node",
  transform: { "^.+\\.tsx?$": ["ts-jest", { tsconfig: "tsconfig.json" }] },
  testMatch: ["**/tests/**/*.test.ts"]
};
JS

# --- .eslintrc.cjs ---
cat > .eslintrc.cjs <<'JS'
module.exports = {
  parser: "@typescript-eslint/parser",
  parserOptions: { ecmaVersion: 2022, sourceType: "module" },
  plugins: ["@typescript-eslint"],
  extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended"],
  ignorePatterns: ["dist/**"]
};
JS

# --- .prettierrc ---
cat > .prettierrc <<'JSON'
{ "singleQuote": true, "semi": true, "printWidth": 100 }
JSON

# --- vercel.json ---
cat > vercel.json <<'JSON'
{
  "version": 2,
  "env": {
    "NODE_OPTIONS": "--max_old_space_size=1536"
  }
}
JSON

# --- Dockerfile ---
cat > Dockerfile <<'DOCKER'
FROM node:20-alpine
WORKDIR /app
COPY package.json pnpm-lock.yaml* ./
RUN corepack enable && corepack prepare pnpm@9.6.0 --activate
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build
EXPOSE 3000
CMD ["pnpm","start"]
DOCKER

# --- styles/globals.css ---
cat > styles/globals.css <<'CSS'
@tailwind base;
@tailwind components;
@tailwind utilities;
CSS

# --- public/logo.svg ---
cat > public/logo.svg <<'SVG'
<svg xmlns="http://www.w3.org/2000/svg" width="120" height="32" viewBox="0 0 120 32" fill="none">
  <rect width="120" height="32" rx="6" fill="#111"/>
  <text x="10" y="21" font-family="Arial, Helvetica, sans-serif" font-size="14" fill="#fff">ClaimCheck Pro</text>
</svg>
SVG

# --- app/page.tsx ---
cat > app/page.tsx <<'TSX'
'use client';
import { useEffect, useRef, useState } from 'react';
import LanguageSelector from '@/components/LanguageSelector';
import ProgressSteps from '@/components/ProgressSteps';
import UpgradeModal from '@/components/UpgradeModal';
import { useRouter } from 'next/navigation';
import { z } from 'zod';

const RequestSchema = z.object({
  input: z.string().min(3),
  depth: z.enum(['quick','thorough']).optional(),
  includeCounterEvidence: z.boolean().optional(),
  timeRange: z.enum(['7d','30d','1y','all']).optional(),
  uiLang: z.string().optional(),
  mode: z.enum(['auto','text','image','video']).optional()
});

export default function HomePage() {
  const [input, setInput] = useState('');
  const [mode, setMode] = useState<'auto'|'text'|'image'|'video'>('auto');
  const [uiLang, setUiLang] = useState<string>(()=> (typeof window==='undefined'?'en':localStorage.getItem('uiLang')||'en'));
  const [depth, setDepth] = useState<'quick'|'thorough'>('quick');
  const [timeRange, setTimeRange] = useState<'7d'|'30d'|'1y'|'all'>('30d');
  const [progress, setProgress] = useState<{stage?: string; message?: string} | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [quotaModal, setQuotaModal] = useState(false);
  const sseRef = useRef<EventSource | null>(null);
  const router = useRouter();

  useEffect(()=>{ localStorage.setItem('uiLang', uiLang); },[uiLang]);

  function startSSE(sseUrl: string, id: string) {
    if (sseRef.current) sseRef.current.close();
    const es = new EventSource(sseUrl);
    sseRef.current = es;
    es.addEventListener('progress', (ev) => {
      try { const d = JSON.parse((ev as MessageEvent).data); setProgress({stage:d.stage, message:d.message}); } catch {}
    });
    es.addEventListener('complete', () => { es.close(); sseRef.current = null; router.push(`/analysis/${id}`); });
    es.addEventListener('error', () => { setError('Stream error. Please retry.'); es.close(); sseRef.current = null; });
  }

  async function onSubmit() {
    setError(null);
    setProgress({ stage: 'queue', message: 'Enqueuing analysis…' });
    const body = { input, depth, timeRange, uiLang, mode };
    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) { setError('Invalid input.'); return; }

    const res = await fetch('/api/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(parsed.data) });
    if (res.status === 412) { window.location.href = '/setup'; return; }
    if (res.status === 429) {
      const data = await res.json().catch(()=>({}));
      if (data?.code === 'FREE_TIER_EXCEEDED') { setQuotaModal(true); return; }
    }
    if (!res.ok) { setError('Failed to start analysis.'); return; }
    const data = await res.json();
    startSSE(data.sseUrl, data.id);
  }

  return (
    <main className="min-h-screen flex flex-col items-center">
      <header className="w-full max-w-5xl flex items-center justify-between p-4">
        <div className="flex items-center gap-2">
          <img src="/logo.svg" alt="ClaimCheck Pro" className="h-8" />
          <span className="font-semibold">ClaimCheck Pro</span>
        </div>
        <div className="flex items-center gap-3">
          <LanguageSelector value={uiLang} onChange={setUiLang} />
          <a href="/pricing" className="text-sm underline">Pricing</a>
        </div>
      </header>

      <section className="w-full max-w-3xl p-4">
        <div className="flex gap-2 mb-3" role="tablist" aria-label="Input mode">
          {(['auto','text','image','video'] as const).map((m)=>(
            <button key={m} role="tab" aria-selected={mode===m} onClick={()=>setMode(m)} className={`px-3 py-1 rounded-full border ${mode===m?'bg-black text-white':''}`}>{m.toUpperCase()}</button>
          ))}
        </div>
        <textarea className="w-full border rounded-lg p-4 min-h-[140px]" placeholder="Paste a URL or text (any language)…" value={input} onChange={(e)=>setInput(e.target.value)} />
        <div className="flex items-center justify-between mt-3">
          <div className="flex items-center gap-3">
            <label className="text-sm">Depth</label>
            <select className="border rounded px-2 py-1" value={depth} onChange={(e)=>setDepth(e.target.value as any)}>
              <option value="quick">Quick</option><option value="thorough">Thorough</option>
            </select>
            <label className="text-sm">Time Range</label>
            <select className="border rounded px-2 py-1" value={timeRange} onChange={(e)=>setTimeRange(e.target.value as any)}>
              <option value="7d">7d</option><option value="30d">30d</option><option value="1y">1y</option><option value="all">All</option>
            </select>
          </div>
          <button onClick={onSubmit} disabled={input.trim().length<3} className="px-4 py-2 rounded bg-black text-white disabled:opacity-50">Check evidence</button>
        </div>
        {progress && <div className="mt-4"><ProgressSteps stage={progress.stage||'queue'} message={progress.message||''} /></div>}
      </section>
      <UpgradeModal open={quotaModal} onClose={()=>setQuotaModal(false)} />
      <footer className="w-full max-w-5xl p-4 mt-auto"><p className="text-xs text-gray-500">Aggregates multilingual evidence and quality signals. No truth verdicts.</p></footer>
    </main>
  );
}

# --- app/analysis/[id]/page.tsx ---
cat > app/analysis/[id]/page.tsx <<'TSX'
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function AnalysisPage({ params }: { params: { id: string }}) {
  const a = await prisma.analysis.findUnique({ where: { id: params.id }, include: { sources: true }});
  if (!a) return <main className="p-6">Not found</main>;
  return (
    <main className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-semibold mb-2">Analysis</h1>
      <p className="text-sm text-gray-600 mb-4">Claim language: {a.claimLanguage} · EQS: {a.qualityScore ?? '-'} · SDI: {a.diversityIndex ?? '-'}</p>
      <h2 className="font-semibold">Claim</h2>
      <p className="mb-6">{a.claimText}</p>
      <h2 className="font-semibold mb-2">Sources</h2>
      <ul className="space-y-3">
        {a.sources.map(s => (
          <li key={s.id} className="border rounded p-3">
            <a href={s.url} target="_blank" className="underline">{s.title || s.url}</a>
            <div className="text-xs text-gray-600">{s.domain} · {s.sourceType} · stance: {s.stance}</div>
            <p className="text-sm mt-1">{s.snippet}</p>
          </li>
        ))}
      </ul>
    </main>
  );
}

# --- app/pricing/page.tsx ---
cat > app/pricing/page.tsx <<'TSX'
export default function Pricing() {
  return (
    <main className="p-8 max-w-3xl mx-auto">
      <h1 className="text-2xl font-semibold mb-4">Pricing</h1>
      <ul className="space-y-4">
        <li className="border rounded p-4">
          <h2 className="font-semibold">Free</h2>
          <p>10 checks / month. No LLM. Core evidence aggregation.</p>
        </li>
        <li className="border rounded p-4">
          <h2 className="font-semibold">Pro</h2>
          <p>LLM cross-check, multilingual embeddings & translations. Priority queue.</p>
        </li>
      </ul>
    </main>
  );
}

# --- app/setup/page.tsx ---
cat > app/setup/page.tsx <<'TSX'
export default function Setup() {
  return (
    <main className="p-8 max-w-3xl mx-auto">
      <h1 className="text-2xl font-semibold mb-4">Setup required</h1>
      <ol className="list-decimal ml-6 space-y-2">
        <li>Set <code>TAVILY_API_KEY</code> and <code>SEARCH_PROVIDERS</code> in <code>.env.local</code>.</li>
        <li>Run <code>pnpm prisma:gen</code> and <code>pnpm prisma:migrate</code>.</li>
        <li>Restart the dev server.</li>
      </ol>
    </main>
  );
}

# --- app/api/analyze/route.ts ---
cat > app/api/analyze/route.ts <<'TS'
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { Queue } from 'bullmq';
import { getRedis, getRedisPubSub } from '@/workers/queue';
import { ttlForTimeRange } from '@/lib/cache';
import { getClientIp, monthKey, secondsUntilMonthEnd } from '@/lib/utils';

const prisma = new PrismaClient();

const BodySchema = z.object({
  input: z.string().min(3),
  depth: z.enum(['quick','thorough']).optional(),
  includeCounterEvidence: z.boolean().optional(),
  timeRange: z.enum(['7d','30d','1y','all']).optional(),
  uiLang: z.string().optional(),
  mode: z.enum(['auto','text','image','video']).optional()
});

function hasAnyProvider() {
  const providers = (process.env.SEARCH_PROVIDERS || '').split(',').map(s => s.trim()).filter(Boolean);
  const anyKey =
    !!process.env.TAVILY_API_KEY ||
    !!process.env.SERPER_API_KEY ||
    !!process.env.SEMANTIC_SCHOLAR_API_KEY ||
    !!process.env.NEWS_API_KEY;
  return providers.length > 0 && anyKey;
}

function freeTierLimitKey(ip: string) {
  return `free:${monthKey()}:${ip}`;
}

async function checkAndIncQuota(ip: string) {
  const redis = await getRedis();
  const limit = Number(process.env.FREE_TIER_LIMIT || '10');
  const key = freeTierLimitKey(ip);
  const used = Number((await redis.get(key)) || '0');
  if (used >= limit) return false;
  const ttl = secondsUntilMonthEnd();
  await redis.multi().incr(key).expire(key, ttl).exec();
  return true;
}

export async function POST(req: NextRequest) {
  if (!hasAnyProvider()) {
    return new Response(JSON.stringify({ error: 'Missing search providers. Configure at least one provider key.', setupPath: '/setup' }), { status: 412, headers: { 'Content-Type': 'application/json' }});
  }
  let body;
  try { body = BodySchema.parse(await req.json()); } catch { return new Response(JSON.stringify({ error: 'Invalid request'}), { status: 400 }); }

  const ip = getClientIp(req) || '0.0.0.0';
  const isPaid = req.headers.get('x-paid-tier') === (process.env.PAID_TIER_SECRET || 'change_me');
  if (!isPaid) {
    const ok = await checkAndIncQuota(ip);
    if (!ok) return new Response(JSON.stringify({ code: 'FREE_TIER_EXCEEDED' }), { status: 429 });
  }

  const analysis = await prisma.analysis.create({
    data: { originalInput: body.input, claimText: '', claimLanguage: '', status: 'queued', isPublic: true }
  });

  const queue = new Queue('analysis', { connection: await getRedis() as any });
  await queue.add('analyze', { analysisId: analysis.id, options: { ...body, isPaid, cacheTTL: ttlForTimeRange(body.timeRange || '30d') } }, { removeOnComplete: true, removeOnFail: true });

  const sseUrl = `/api/analyze?stream=${analysis.id}`;
  return new Response(JSON.stringify({ id: analysis.id, sseUrl }), { status: 200 });
}

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('stream');
  if (!id) return new Response('Missing stream id', { status: 400 });
  const { sub } = await getRedisPubSub();
  await sub.subscribe(`analysis:${id}`);

  const stream = new ReadableStream({
    start(controller) {
      function send(ev: string, data: unknown) {
        controller.enqueue(new TextEncoder().encode(`event: ${ev}\ndata: ${JSON.stringify(data)}\n\n`));
      }
      (sub as any).on('message', (channel: string, payload: string) => {
        if (channel !== `analysis:${id}`) return;
        try {
          const msg = JSON.parse(payload);
          if (msg.type === 'progress') send('progress', msg.data);
          if (msg.type === 'complete') { send('complete', { ok: true }); controller.close(); }
          if (msg.type === 'error') { send('error', { error: msg.error || 'unknown' }); controller.close(); }
        } catch { send('error', { error: 'invalid message' }); controller.close(); }
      });
    }
  });

  return new Response(stream, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', 'Connection': 'keep-alive' }});
}
TS

# --- app/api/health/route.ts ---
cat > app/api/health/route.ts <<'TS'
import { PrismaClient } from '@prisma/client';
import { getRedis } from '@/workers/queue';

const prisma = new PrismaClient();

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    const r = await getRedis();
    await r.set('health:ping','1'); await r.del('health:ping');
    const providers = (process.env.SEARCH_PROVIDERS || '').split(',').filter(Boolean);
    const okProviders = Boolean(process.env.TAVILY_API_KEY || process.env.SERPER_API_KEY || process.env.SEMANTIC_SCHOLAR_API_KEY || process.env.NEWS_API_KEY);
    return new Response(JSON.stringify({ ok: true, db: true, redis: true, providersConfigured: providers, anyKey: okProviders }), { status: 200 });
  } catch (e:any) {
    return new Response(JSON.stringify({ ok: false, error: String(e?.message || e) }), { status: 500 });
  }
}
TS

# --- app/api/metrics/route.ts ---
cat > app/api/metrics/route.ts <<'TS'
export async function GET() {
  return new Response("# mock metrics\n", { status: 200, headers: { "Content-Type": "text/plain" }});
}
TS

# --- components/LanguageSelector.tsx ---
cat > components/LanguageSelector.tsx <<'TSX'
'use client';
const langs = ['en','es','fr','de','it','pt','ja','ko','zh','ar','ru','hi','tr','nl','sv'];
export default function LanguageSelector({ value, onChange }:{ value:string; onChange:(v:string)=>void}) {
  return (
    <select className="border rounded px-2 py-1" value={value} onChange={(e)=>onChange(e.target.value)}>
      {langs.map(l => <option key={l} value={l}>{l.toUpperCase()}</option>)}
    </select>
  );
}

# --- components/ProgressSteps.tsx ---
cat > components/ProgressSteps.tsx <<'TSX'
export default function ProgressSteps({ stage, message }:{ stage:string; message:string }) {
  const steps = ['queue','extract','discover','assess','done'];
  const idx = Math.max(steps.indexOf(stage), 0);
  return (
    <div className="w-full">
      <div className="flex gap-2">
        {steps.map((s, i)=>(
          <div key={s} className={`flex-1 h-2 rounded ${i<=idx?'bg-black':'bg-gray-200'}`} />
        ))}
      </div>
      <p className="text-sm mt-2">{message}</p>
    </div>
  );
}

# --- components/UpgradeModal.tsx ---
cat > components/UpgradeModal.tsx <<'TSX'
'use client';
export default function UpgradeModal({ open, onClose }:{ open:boolean; onClose:()=>void }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center">
      <div className="bg-white rounded-lg p-6 max-w-sm w-full">
        <h2 className="text-lg font-semibold mb-2">Free tier limit reached</h2>
        <p className="text-sm mb-4">Upgrade to enable more checks and paid-tier features.</p>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1 rounded border">Close</button>
          <a href="/pricing" className="px-3 py-1 rounded bg-black text-white">See pricing</a>
        </div>
      </div>
    </div>
  );
}

# --- lib/i18n/index.ts ---
cat > lib/i18n/index.ts <<'TS'
import { getRequestConfig } from 'next-intl/server';
export default getRequestConfig(async () => {
  const messages = (await import('./messages/en.json')).default;
  return { messages, locale: 'en', timeZone: 'UTC' };
});
TS

# --- lib/i18n/messages/en.json ---
cat > lib/i18n/messages/en.json <<'JSON'
{
  "title": "ClaimCheck Pro",
  "tagline": "Aggregates multilingual evidence and quality signals. No truth verdicts.",
  "input.placeholder": "Paste a URL or text (any language)…",
  "button.check": "Check evidence",
  "depth.quick": "Quick",
  "depth.thorough": "Thorough",
  "timerange.7d": "7d",
  "timerange.30d": "30d",
  "timerange.1y": "1y",
  "timerange.all": "All",
  "progress.queue": "Enqueuing analysis…",
  "progress.extract": "Extracting content…",
  "progress.discover": "Finding evidence…",
  "progress.assess": "Assessing sources…",
  "progress.done": "Complete."
}
JSON

# --- lib/lang.ts ---
cat > lib/lang.ts <<'TS'
import { franc } from 'franc';
import iso from 'iso-639-1';
export function detectLanguage(text: string): string {
  try {
    const lang3 = franc(text || '', { minLength: 20 }) || 'und';
    const lang2 = iso.getCode(iso.getName(lang3) || '') || (lang3.length === 2 ? lang3 : 'en');
    return lang2 || 'en';
  } catch {
    return 'en';
  }
}
export function normalizeLang(code?: string) { return iso.validate(code||'') ? (code as string) : 'en'; }
TS

# --- lib/utils.ts ---
cat > lib/utils.ts <<'TS'
import type { NextRequest } from 'next/server';
export function clamp01(x:number){ return Math.max(0, Math.min(1, x)); }
export function getClientIp(req: NextRequest) { return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.ip || '0.0.0.0'; }
export function monthKey(date = new Date()){ return `${date.getUTCFullYear()}-${String(date.getUTCMonth()+1).padStart(2,'0')}`; }
export function secondsUntilMonthEnd(d=new Date()){ const y=d.getUTCFullYear(); const m=d.getUTCMonth(); const end=new Date(Date.UTC(y, m+1, 1)); return Math.max(60, Math.floor((end.getTime()-d.getTime())/1000)); }
TS

# --- lib/cache.ts ---
cat > lib/cache.ts <<'TS'
export function ttlForTimeRange(tr: '7d'|'30d'|'1y'|'all' = '30d') {
  const env = (k:string, def:number)=> Number(process.env[k] || def);
  if (tr === '7d') return env('CACHE_TTL_7D_SECONDS', 900);
  if (tr === '30d') return env('CACHE_TTL_30D_SECONDS', 3600);
  if (tr === '1y') return env('CACHE_TTL_1Y_SECONDS', 21600);
  if (tr === 'all') return env('CACHE_TTL_ALL_SECONDS', 86400);
  return env('CACHE_TTL_SECONDS', 600);
}
TS

# --- lib/trustMap.ts ---
cat > lib/trustMap.ts <<'TS'
const FACTCHECKERS = ['snopes.com','politifact.com','factcheck.org','reuters.com','apnews.com'];
export const FACTCHECK_BOOST = 0.05;
const BASE_TRUST: Record<string, number> = { 'snopes.com':0.9,'politifact.com':0.9,'reuters.com':0.85,'apnews.com':0.82,'bbc.com':0.82,'nytimes.com':0.8,'nature.com':0.92,'who.int':0.92,'nih.gov':0.92,'harvard.edu':0.9 };
export function isFactChecker(domain: string){ return FACTCHECKERS.some(d => domain.endsWith(d)); }
export function trustForDomain(domain: string, sourceType?: string): number {
  if (BASE_TRUST[domain]) return BASE_TRUST[domain];
  if (isFactChecker(domain)) return 0.88;
  if (/\.(gov|edu)$/.test(domain)) return 0.85;
  if (sourceType === 'academic') return 0.88;
  if (sourceType === 'news') return 0.7;
  return 0.55;
}
export function factCheckDomains(): string[] { return (process.env.FACTCHECK_DOMAINS || FACTCHECKERS.join(',')).split(',').map(s=>s.trim()); }
TS

# --- lib/assess/credibility.ts ---
cat > lib/assess/credibility.ts <<'TS'
import { trustForDomain, isFactChecker } from '@/lib/trustMap';
export function assessCredibility(domain: string, sourceType?: string, discoveredVia?: string): number {
  const base = trustForDomain(domain, sourceType);
  const boost = isFactChecker(domain) || discoveredVia === 'factcheck-preflight' ? 0.05 : 0;
  return Math.max(0, Math.min(1, base + boost));
}
TS

# --- lib/search/tavily.ts ---
cat > lib/search/tavily.ts <<'TS'
type TavilyResult = { url: string; title?: string; snippet?: string; published_at?: string; language?: string; sourceType?: string; };
function mapTimeRange(tr: '7d'|'30d'|'1y'|'all'){ if (tr==='7d')return 'week'; if (tr==='30d')return 'month'; if (tr==='1y')return 'year'; return 'all'; }
export async function searchTavily(query: string, opts: { language: string; timeRange: '7d'|'30d'|'1y'|'all'; domains?: string[]; timeoutMs?: number }): Promise<TavilyResult[]> {
  const key = process.env.TAVILY_API_KEY; if (!key) throw new Error('TAVILY_API_KEY missing');
  const controller = new AbortController();
  const t = setTimeout(()=>controller.abort(), opts.timeoutMs || Number(process.env.PROVIDER_TIMEOUT_MS || '8000'));
  const body:any = { api_key:key, query, search_depth:'basic', include_answer:false, include_images:false, include_raw_content:false, max_results:8, topic:'news', time_range: mapTimeRange(opts.timeRange) };
  if (opts.domains?.length) body.include_domains = opts.domains;
  const res = await fetch('https://api.tavily.com/search', { method:'POST', signal:controller.signal, headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) }).finally(()=>clearTimeout(t));
  if (!res.ok) throw new Error(`tavily error ${res.status}`);
  const data = await res.json();
  return (data?.results || []).map((r:any)=>({ url:r.url, title:r.title, snippet:r.content, published_at:r.published_time || undefined, sourceType: r.score ? 'news' : 'unknown' }));
}
TS

# --- lib/search/index.ts ---
cat > lib/search/index.ts <<'TS'
import { factCheckDomains } from '@/lib/trustMap';
import { searchTavily } from './tavily';

export type SearchSource = {
  url: string; title?: string; snippet?: string; publishDate?: string; domain: string;
  sourceType?: 'news'|'gov'|'edu'|'ngo'|'blog'|'academic'|'factcheck'|'unknown';
  language?: string; discoveredVia?: 'factcheck-preflight'|'search';
};

function domainOf(url: string){ try { const u = new URL(url); return u.hostname.replace(/^www\./,''); } catch { return 'unknown'; } }
function dedupeByDomain(items: SearchSource[], cap=12){ const seen=new Set<string>(); const out:SearchSource[]=[]; for(const it of items){ if(seen.has(it.domain))continue; seen.add(it.domain); out.push(it); if(out.length>=cap)break; } return out; }

export async function runSearch(opts:{ claim:string; language:string; timeRange:'7d'|'30d'|'1y'|'all'; isPaid:boolean; }) {
  const sources: SearchSource[] = [];
  try {
    const fc = await searchTavily(opts.claim, { language:opts.language, timeRange:opts.timeRange, domains: factCheckDomains(), timeoutMs: Number(process.env.FACTCHECK_TIMEOUT_MS || '4000') });
    for (const r of fc) {
      const d = domainOf(r.url);
      sources.push({ url:r.url, title:r.title, snippet:r.snippet, publishDate:r.published_at, domain:d, sourceType:'factcheck', discoveredVia:'factcheck-preflight', language:r.language });
    }
  } catch {}
  const general = await searchTavily(opts.claim, { language:opts.language, timeRange:opts.timeRange });
  for (const r of general) {
    const d = domainOf(r.url);
    const isFC = factCheckDomains().some(dom => d.endsWith(dom));
    sources.push({ url:r.url, title:r.title, snippet:r.snippet, publishDate:r.published_at, domain:d, sourceType: isFC?'factcheck':(r.sourceType as any)||'unknown', discoveredVia: isFC?'factcheck-preflight':'search', language:r.language });
  }
  return { sources: dedupeByDomain(sources, 12) };
}
TS

# --- lib/scoring.ts ---
cat > lib/scoring.ts <<'TS'
import type { SearchSource } from './search';
import { clamp01 } from './utils';
export type ScoredSource = SearchSource & { credibilityScore: number; directnessScore?: number; methodologyScore?: number; stance?: 'supporting'|'challenging'|'neutral'; bias?: { politicalLean?: number; commercialInterest?: number; framing?: string[] }; qualityScore?: number; };

const DEFAULTS = { credibility:0.5, directness:0.5, methodology:0.5, recency:0.5 };

function recencyScore(publishDate?: string){ if(!publishDate) return DEFAULTS.recency; const dt=new Date(publishDate).getTime(); if(isNaN(dt))return DEFAULTS.recency; const ageDays=(Date.now()-dt)/(1000*60*60*24); if(ageDays<=7)return 1; if(ageDays<=30)return 0.8; if(ageDays<=365)return 0.6; return 0.4; }
function roughDirectness(claim:string, snippet?:string){ if(!snippet) return DEFAULTS.directness; const a=new Set(claim.toLowerCase().split(/\W+/).filter(Boolean)); const b=new Set(snippet.toLowerCase().split(/\W+/).filter(Boolean)); const inter=[...a].filter(x=>b.has(x)).length; return clamp01(inter/Math.max(8, a.size)); }
function stanceHeuristic(claim:string, snippet?:string): 'supporting'|'challenging'|'neutral' { if(!snippet) return 'neutral'; const s=snippet.toLowerCase(); const neg=/\b(not|no|false|hoax|refute|debunk|deny|dispute|contradict)\b/; const pos=/\b(confirm|corroborate|support|affirm|verify)\b/; if(neg.test(s)) return 'challenging'; if(pos.test(s)) return 'supporting'; return 'neutral'; }

export function scoreAll(opts:{ claim:string; language:string; sources: Array<Omit<ScoredSource,'qualityScore'|'stance'|'directnessScore'|'methodologyScore'>>; isPaid:boolean; }) {
  const weighted = opts.sources.map(s=>{
    const directness = roughDirectness(opts.claim, s.snippet);
    const methodology = /study|dataset|methodology|replication|survey|randomized|placebo|meta-?analysis/i.test(s.snippet||'')?0.8:0.5;
    const rec = recencyScore(s.publishDate);
    const stance = stanceHeuristic(opts.claim, s.snippet);
    const credibility = s.credibilityScore ?? DEFAULTS.credibility;
    const quality = 0.40*credibility + 0.25*directness + 0.15*methodology + 0.10*rec + 0.10*0.5;
    return { ...s, directnessScore:directness, methodologyScore:methodology, qualityScore:clamp01(quality), stance };
  });
  const N = Number(process.env.EQS_TOP_N || '5');
  const top = [...weighted].sort((a,b)=>(b.directnessScore||0)-(a.directnessScore||0)).slice(0,N);
  const eqs = Math.round(100 * (top.reduce((acc,s)=>acc+Math.pow(s.directnessScore||0.5,2)*(s.qualityScore||0.5),0) / (top.reduce((acc,s)=>acc+Math.pow(s.directnessScore||0.5,2),0)||1)));
  const domains = new Set(weighted.map(s=>s.domain.split('.').slice(-1)[0]));
  const stances = new Set(weighted.map(s=>s.stance));
  const types = new Set(weighted.map(s=>s.sourceType));
  const sdiRaw = (domains.size + stances.size + types.size) / 20;
  const sdi = Math.round(10 * Math.min(1, sdiRaw));
  const consensus = { supporting: weighted.filter(s=>s.stance==='supporting').length, challenging: weighted.filter(s=>s.stance==='challenging').length, neutral: weighted.filter(s=>s.stance==='neutral').length };
  return { eqs, sdi, sourcesWithScores: weighted, consensus };
}
TS

# --- workers/queue.ts ---
cat > workers/queue.ts <<'TS'
import IORedis from 'ioredis';
import RedisMock from 'ioredis-mock';
let client: IORedis | any;
export async function getRedis(): Promise<IORedis> {
  if (client) return client as any;
  const url = process.env.REDIS_URL;
  if (!url) { client = new (RedisMock as any)(); return client as any; }
  client = new IORedis(url);
  return client as any;
}
export async function getRedisPubSub() {
  const main = await getRedis();
  const pub = main.duplicate(); const sub = main.duplicate();
  await (pub as any).connect?.(); await (sub as any).connect?.();
  return { pub, sub, subOnly: sub };
}
TS

# --- workers/analysis.worker.ts ---
cat > workers/analysis.worker.ts <<'TS'
import 'dotenv/config';
import { Worker, QueueEvents, Job } from 'bullmq';
import { PrismaClient, EvidenceSource as EvidenceSourceModel } from '@prisma/client';
import { getRedis } from './queue';
import { detectLanguage } from '@/lib/lang';
import { runSearch } from '@/lib/search';
import { assessCredibility } from '@/lib/assess/credibility';
import { scoreAll } from '@/lib/scoring';

const prisma = new PrismaClient();

async function publish(id: string, msg: any) {
  const redis = await getRedis();
  await redis.publish(`analysis:${id}`, JSON.stringify(msg));
}

async function handle(job: Job) {
  const { analysisId, options } = job.data as { analysisId: string; options: any };
  await publish(analysisId, { type: 'progress', data: { stage: 'extract', message: 'Extracting content…' }});

  // Minimal extraction for v1 (treat input as claim)
  const claimText: string = options?.input || '';
  const detectedLang = detectLanguage(claimText);

  await prisma.analysis.update({ where: { id: analysisId }, data: { claimText, claimLanguage: detectedLang }});
  await publish(analysisId, { type: 'progress', data: { stage: 'discover', message: 'Finding evidence…' }});

  const discovery = await runSearch({ claim: claimText, language: detectedLang, timeRange: options.timeRange || '30d', isPaid: !!options.isPaid });

  await publish(analysisId, { type: 'progress', data: { stage: 'assess', message: 'Assessing sources…' }});

  const assessed = await Promise.all(discovery.sources.map(async (s) => {
    const cred = assessCredibility(s.domain, s.sourceType, s.discoveredVia);
    return { ...s, credibilityScore: cred };
  }));

  const { eqs, sdi, sourcesWithScores, consensus } = scoreAll({ claim: claimText, language: detectedLang, sources: assessed, isPaid: !!options.isPaid });

  await prisma.$transaction(async (tx) => {
    await tx.analysis.update({ where: { id: analysisId }, data: { status: 'complete', qualityScore: eqs, diversityIndex: sdi, consensusData: consensus as any }});
    const records: Omit<EvidenceSourceModel, 'id'>[] = sourcesWithScores.map((s)=>({
      analysisId, url: s.url, title: s.title || null, language: s.language || null, domain: s.domain,
      sourceType: s.sourceType || 'unknown', discoveredVia: s.discoveredVia || 'search', snippet: s.snippet || '',
      publishDate: s.publishDate ? new Date(s.publishDate) : null, credibilityScore: s.credibilityScore ?? 0.5,
      directnessScore: s.directnessScore ?? 0.5, methodologyScore: s.methodologyScore ?? 0.5, bias: s.bias as any,
      stance: s.stance || 'neutral', qualityScore: s.qualityScore ?? 0.5, createdAt: new Date()
    }));
    if (records.length) await tx.evidenceSource.createMany({ data: records });
  });

  await publish(analysisId, { type: 'progress', data: { stage: 'done', message: 'Complete.' }});
  await publish(analysisId, { type: 'complete', data: { id: analysisId }});
}

async function main() {
  const concurrency = Number(process.env.WORKER_CONCURRENCY || '4');
  const worker = new Worker('analysis', handle, { connection: await getRedis() as any, concurrency });
  const qe = new QueueEvents('analysis', { connection: await getRedis() as any });
  qe.on('failed', async ({ jobId, failedReason }) => {
    if (!jobId) return;
    const job = await worker.getJob(jobId);
    const analysisId = job?.data?.analysisId as string | undefined;
    if (analysisId) {
      await prisma.analysis.update({ where: { id: analysisId }, data: { status: 'failed' }});
      await publish(analysisId, { type: 'error', error: failedReason || 'failed' });
    }
  });
  // eslint-disable-next-line no-console
  console.log('[worker] analysis.worker running with concurrency', concurrency);
}
main().catch((e)=>{ console.error(e); process.exit(1); });
TS

# --- prisma/schema.prisma ---
cat > prisma/schema.prisma <<'PRISMA'
generator client { provider = "prisma-client-js" }
datasource db {
  provider = env("PRISMA_DB_PROVIDER") // "postgresql" in prod, "sqlite" in dev
  url      = env("DATABASE_URL")
}
model Analysis {
  id             String   @id @default(cuid())
  userId         String?
  claimText      String
  claimLanguage  String
  originalInput  String
  context        Json?
  status         String   @default("queued")
  qualityScore   Float?
  diversityIndex Float?
  consensusData  Json?
  isPublic       Boolean  @default(true)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  sources        EvidenceSource[]
}
model EvidenceSource {
  id               String   @id @default(cuid())
  analysisId       String
  url              String
  title            String?
  language         String?
  domain           String
  sourceType       String
  discoveredVia    String
  snippet          String
  publishDate      DateTime?
  credibilityScore Float
  directnessScore  Float
  methodologyScore Float
  bias             Json?
  stance           String
  qualityScore     Float
  createdAt        DateTime @default(now())
  analysis         Analysis @relation(fields: [analysisId], references: [id], onDelete: Cascade)
}
model CacheEntry {
  key        String   @id
  value      Json
  ttl        DateTime
  tags       String[]
  sizeBytes  Int?
  hitCount   Int      @default(0)
}
PRISMA

# --- .github/workflows/ci.yml ---
cat > .github/workflows/ci.yml <<'YML'
name: CI
on: [push, pull_request]
jobs:
  build-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9.6.0 }
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: 'pnpm' }
      - run: pnpm install
      - run: pnpm typecheck
      - run: pnpm lint
      - run: pnpm test -- --passWithNoTests
YML

# --- README.md ---
cat > README.md <<'MD'
# QikVerify.com (ClaimCheck Pro) — Multilingual Evidence Platform

Aggregates multilingual evidence and quality signals (EQS, SDI, stance & transparency). **No truth verdicts.**

## Quickstart (Dev)
```bash
pnpm install
cp .env.example .env.local
# edit .env.local:
#   PRISMA_DB_PROVIDER=sqlite
#   DATABASE_URL="file:./dev.db"
#   TAVILY_API_KEY=...
#   SEARCH_PROVIDERS=tavily
pnpm prisma:gen
pnpm prisma:migrate
pnpm dev
# second terminal:
pnpm build:workers
pnpm start:worker
```
MD
