"use client";

import { useEffect, useRef, useState } from 'react';
import { I18nProvider, useI18n } from '@/lib/i18n/client';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import LanguageSelector from '@/components/LanguageSelector';
import ProgressSteps from '@/components/ProgressSteps';
import UpgradeModal from '@/components/UpgradeModal';
import { InputTypeIcon, HelpTooltip } from '@/components/UiHelpers';
import { PhotoIcon } from '@heroicons/react/24/outline';

// --- i18n-aware homepage inner ---
function HomePageInner() {
  const router = useRouter();
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [droppedFile, setDroppedFile] = useState<File|null>(null);
  const [inputType, setInputType] = useState<'link'|'claim'|'media'>('claim');
  const inputRef = useRef<HTMLInputElement>(null);
  const { lang: uiLang, setLang, t } = useI18n();

  useEffect(() => { inputRef.current?.focus(); }, []);
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
        headers: { 'content-type': 'application/json' },
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
        const tmsg = await res.text();
        alert(`Error: ${res.status} ${tmsg}`);
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
            placeholder={t('input.placeholder')}
            className="w-full rounded-xl border border-slate-300 px-4 py-3 text-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
            disabled={busy}
            aria-label={t('input.placeholder')}
            onKeyDown={e => { if (e.key === 'Enter') submit(); }}
          />
          <button
            onClick={submit}
            disabled={busy || (!input.trim() && !droppedFile)}
            className="w-full inline-flex justify-center items-center rounded-full bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-lg font-semibold px-6 py-4 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed focus:ring-2 focus:ring-indigo-400"
            aria-label={t('button.check')}
          >
            {busy ? t('progress.queue') : t('button.check')}
          </button>
          {/* What can I check? row, icons left-aligned */}
          <div className="flex items-center gap-4 w-full text-slate-500 text-sm">
            <span>{t('whatcanicheck') || 'What can I check?'}</span>
            <span className="flex gap-3">
              <span className="flex items-center gap-1"><InputTypeIcon type="link" />{t('type.link') || 'Link'}</span>
              <span className="flex items-center gap-1"><InputTypeIcon type="claim" />{t('type.claim') || 'Claim'}</span>
              <span className="flex items-center gap-1"><InputTypeIcon type="media" />{t('type.media') || 'Media'}</span>
            </span>
          </div>
          {/* Drag-and-drop area row (always visible) with file picker button */}
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
                <div className="text-lg font-semibold mb-2">{t('media.ready') || 'Media file ready to analyze'}</div>
                <div className="text-sm mb-2">{droppedFile.name}</div>
                <button className="text-indigo-700 underline text-sm" onClick={() => { setDroppedFile(null); setInputType('claim'); }}>{t('media.remove') || 'Remove file'}</button>
              </>
            ) : (
              <>
                <div className="text-base text-indigo-700 mb-2">{t('media.dragdrop') || 'Drag and drop an image or video here to analyze'}</div>
                <button
                  className="mt-2 px-4 py-2 rounded bg-indigo-600 text-white hover:bg-indigo-700 text-sm"
                  onClick={() => {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = 'image/*,video/*';
                    input.onchange = (e: any) => {
                      if (e.target.files && e.target.files.length > 0) {
                        setDroppedFile(e.target.files[0]);
                        setInputType('media');
                      }
                    };
                    input.click();
                  }}
                >{t('media.choosefile') || 'Choose file'}</button>
              </>
            )}
          </div>
          {/* Language selector row */}
          <div className="flex items-center gap-4 w-full justify-between">
            <LanguageSelector value={uiLang} onChange={setLang} />
          </div>
        </div>
        {/* Helper row for mobile (language only, paid removed) */}
        <div className="mt-3 flex items-center justify-between sm:hidden">
          <div className="flex items-center gap-3">
            <LanguageSelector value={uiLang} onChange={setLang} />
          </div>
          <button
            type="button"
            onClick={() => setInput('')}
            className="text-sm text-slate-600 hover:text-slate-900 underline underline-offset-2"
          >
            {t('clear') || 'Clear'}
          </button>
        </div>
      </section>
      <UpgradeModal open={showUpgrade} onClose={() => setShowUpgrade(false)} />
    </main>
  );
}

export default function HomePage() {
  return (
    <I18nProvider>
      <HomePageInner />
    </I18nProvider>
  );
}
