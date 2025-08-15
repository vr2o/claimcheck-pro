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
