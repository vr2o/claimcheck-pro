"use client";

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import LanguageSelector from '@/components/LanguageSelector';
import ProgressSteps from '@/components/ProgressSteps';
import UpgradeModal from '@/components/UpgradeModal';
import { InputTypeIcon, HelpTooltip } from '@/components/UiHelpers';
import { PhotoIcon } from '@heroicons/react/24/outline';

export default function HomePage() {
  const router = useRouter();
  const [input, setInput] = useState('');
  // Removed mode selector for simplicity
  const [uiLang, setUiLang] = useState('en');
  const [isPaid, setIsPaid] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [droppedFile, setDroppedFile] = useState<File|null>(null);
  const [inputType, setInputType] = useState<'link'|'claim'|'media'>('claim');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);
  // Detect if input is a link or claim
  useEffect(() => {
    if (!input) setInputType('claim');
    else if (/^https?:\/\//i.test(input.trim())) setInputType('link');
    else setInputType('claim');
  }, [input]);


  async function submit() {
    if (inputType === 'media' && droppedFile) {
      alert('Media analysis is not yet implemented.');
      return;
    }
    if (!input.trim()) return;
    setBusy(true);
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(isPaid ? { 'x-paid-tier': process.env.NEXT_PUBLIC_PAID_TIER_SECRET ?? '' } : {})
        },
        body: JSON.stringify({
          input,
          uiLang,
          includeCounterEvidence: true,
          timeRange: '30d',
          depth: 'quick'
        })
      });
      if (res.status === 429) {
        setShowUpgrade(true);
        setBusy(false);
        return;
      }
      if (!res.ok) {
        const t = await res.text();
        alert(`Error: ${res.status} ${t}`);
        setBusy(false);
        return;
      }
      const result = await res.json();
      if (!result.id) {
        alert('Sorry, something went wrong (no analysis id returned).');
        setBusy(false);
        return;
      }
      router.push(`/analysis/${result.id}`);
    } catch (e: any) {
      alert(e?.message ?? 'Unknown error');
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-white flex flex-col items-center">
      <Header />
      <section className="w-full max-w-xl flex flex-col gap-6 mt-8 px-4">
        <div className="flex flex-col gap-6 w-full">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Paste a claim, link, or drop a file..."
            className="w-full rounded-xl border border-slate-300 px-4 py-3 text-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
            disabled={busy}
            aria-label="Claim, link, or file input"
          />
          <button
            onClick={submit}
            disabled={busy || (!input.trim() && !droppedFile)}
            className="w-full inline-flex justify-center items-center rounded-full bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-lg font-semibold px-6 py-4 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed focus:ring-2 focus:ring-indigo-400"
            aria-label="Check evidence"
          >
            {busy ? 'Checking…' : inputType === 'link' ? 'Check Link' : inputType === 'media' ? 'Analyze Media' : 'Check Claim'}
          </button>
          {/* What can I check? helper row */}
          <div className="flex flex-col sm:flex-row justify-between items-center w-full gap-2 text-slate-500 text-sm">
            <div className="flex items-center gap-2">
              <span>What can I check?</span>
              <HelpTooltip />
            </div>
            <div className="flex gap-2">
              <span className="flex items-center gap-1"><InputTypeIcon type="link" />Link</span>
              <span className="flex items-center gap-1"><InputTypeIcon type="claim" />Claim</span>
              <span className="flex items-center gap-1"><InputTypeIcon type="media" />Media</span>
            </div>
          </div>
          {/* Drag-and-drop area row (always visible) */}
          <div
            className={`p-8 border-2 border-dashed border-indigo-400 rounded-2xl bg-indigo-50 text-center text-indigo-700 flex flex-col items-center min-h-[120px] transition-all duration-200 ${dragActive ? 'ring-2 ring-indigo-400 scale-105' : ''}`}
            onDragOver={e => { e.preventDefault(); setDragActive(true); }}
            onDragLeave={e => { e.preventDefault(); setDragActive(false); }}
            onDrop={e => {
              e.preventDefault();
              setDragActive(false);
              if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                setDroppedFile(e.dataTransfer.files[0]);
                setInputType('media');
              }
            }}
          >
            <PhotoIcon className="w-12 h-12 mb-2 text-indigo-400" aria-label="Media file" />
            {droppedFile ? (
              <>
                <div className="text-lg font-semibold mb-2">Media file ready to analyze</div>
                <div className="text-sm mb-2">{droppedFile.name}</div>
                <button className="text-indigo-700 underline text-sm" onClick={() => { setDroppedFile(null); setInputType('claim'); }}>Remove file</button>
              </>
            ) : (
              <div className="text-base text-indigo-700">Drag and drop an image or video here to analyze</div>
            )}
          </div>
          {/* Language selector and paid toggle row */}
          <div className="flex items-center gap-4 w-full justify-between">
            <LanguageSelector value={uiLang} onChange={setUiLang} />
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                className="h-5 w-5 accent-indigo-600"
                checked={isPaid}
                onChange={(e) => setIsPaid(e.target.checked)}
              />
              Paid
            </label>
          </div>
          {/* Subtle progress shell row */}
          <div className="flex items-center justify-end w-full text-slate-600">
            <div className="hidden sm:block">
              <ProgressSteps stage="idle" message="Ready to check a claim" />
            </div>
          </div>
        </div>
        {/* Helper row for mobile (language & paid) */}
        <div className="mt-3 flex items-center justify-between sm:hidden">
          <div className="flex items-center gap-3">
            <LanguageSelector value={uiLang} onChange={setUiLang} />
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                className="h-5 w-5 accent-indigo-600"
                checked={isPaid}
                onChange={(e) => setIsPaid(e.target.checked)}
              />
              Paid
            </label>
          </div>
          <button
            type="button"
            onClick={() => setInput('')}
            className="text-sm text-slate-600 hover:text-slate-900 underline underline-offset-2"
          >
            Clear
          </button>
        </div>
        {/* Subtle progress shell */}
        <div className="mt-8 flex items-center justify-end text-slate-600">
          <div className="hidden sm:block">
            <ProgressSteps stage="idle" message="Ready to check a claim" />
          </div>
        </div>
      </section>
      <UpgradeModal open={showUpgrade} onClose={() => setShowUpgrade(false)} />
    </main>
  );
}
