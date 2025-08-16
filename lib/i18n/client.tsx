"use client";
import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";

// Supported languages
const LANGS = ["en", "es", "pt", "fr"];

// Dynamically import translation files
async function loadMessages(lang: string): Promise<Record<string, string>> {
  switch (lang) {
    case "es":
      return (await import("./messages/es.json")).default;
    case "pt":
      return (await import("./messages/pt.json")).default;
    case "fr":
      return (await import("./messages/fr.json")).default;
    case "en":
      return (await import("./messages/en.json")).default;
    default:
      return (await import("./messages/en.json")).default;
  }
}

interface I18nContextType {
  lang: string;
  setLang: (lang: string) => void;
  t: (key: string) => string;
}

const I18nContext = createContext<I18nContextType>({
  lang: "en",
  setLang: () => {},
  t: (k) => k,
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState("en");
  const [messages, setMessages] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  // Detect browser language on first load
  useEffect(() => {
    const browserLang = typeof navigator !== "undefined" ? navigator.language?.slice(0, 2) : "en";
    if (LANGS.includes(browserLang) && browserLang !== lang) {
      setLang(browserLang);
    }
  }, []);

  // Load messages when lang changes
  useEffect(() => {
    setLoading(true);
    loadMessages(lang).then(msgs => {
      setMessages(msgs);
      setLoading(false);
    });
  }, [lang]);

  function t(key: string) {
    return messages[key] || key;
  }

  if (loading) {
    return (
      <div style={{minHeight: 200, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: 18, letterSpacing: 0.5}}>
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none" className="animate-spin mb-3" style={{animation: 'spin 1s linear infinite'}}>
          <circle cx="16" cy="16" r="14" stroke="#a5b4fc" strokeWidth="4" opacity="0.2" />
          <path d="M30 16a14 14 0 0 1-14 14" stroke="#6366f1" strokeWidth="4" strokeLinecap="round" />
        </svg>
        <span style={{opacity: 0.8}}>Loading…</span>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  return (
    <I18nContext.Provider value={{ lang, setLang, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}
